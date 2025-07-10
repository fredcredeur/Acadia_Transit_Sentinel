import json
from typing import List, Tuple

import networkx as nx
import osmnx as ox
import pulp
import requests

# Type aliases
Coordinate = Tuple[float, float]  # (lon, lat)


def get_osm_graph(points: List[Coordinate]) -> nx.MultiDiGraph:
    """Download OSM road network for the bounding box containing the points."""
    lats = [p[1] for p in points]
    lons = [p[0] for p in points]
    north, south = max(lats) + 0.1, min(lats) - 0.1
    east, west = max(lons) + 0.1, min(lons) - 0.1
    bbox = (north, south, east, west)
    return ox.graph_from_bbox(bbox, network_type="drive")


def compute_distance_matrix(G: nx.MultiDiGraph, points: List[Coordinate]) -> List[List[float]]:
    """Build a distance matrix between each pair of coordinates."""
    nodes = [ox.nearest_nodes(G, lon, lat) for lon, lat in points]
    matrix = []
    for i, node_i in enumerate(nodes):
        row = []
        for j, node_j in enumerate(nodes):
            if i == j:
                row.append(0.0)
            else:
                try:
                    dist = nx.shortest_path_length(G, node_i, node_j, weight="length")
                except nx.NetworkXNoPath:
                    dist = float("inf")
                row.append(dist)
        matrix.append(row)
    return matrix


def get_top_stop_orders(dist_matrix: List[List[float]], num_orders: int = 5) -> List[List[int]]:
    """Solve a simple TSP to order stops; return a few permutations."""
    n = len(dist_matrix) - 2  # exclude origin and destination
    prob = pulp.LpProblem("tsp", pulp.LpMinimize)
    x = pulp.LpVariable.dicts(
        "x", ((i, j) for i in range(n) for j in range(n) if i != j), cat="Binary"
    )
    u = pulp.LpVariable.dicts("u", range(n), lowBound=1, upBound=n, cat="Integer")

    prob += pulp.lpSum(dist_matrix[i + 1][j + 1] * x[i, j] for i in range(n) for j in range(n) if i != j)

    for i in range(n):
        prob += pulp.lpSum(x[i, j] for j in range(n) if j != i) == 1
        prob += pulp.lpSum(x[j, i] for j in range(n) if j != i) == 1

    for i in range(n):
        for j in range(n):
            if i != j:
                prob += u[i] - u[j] + n * x[i, j] <= n - 1

    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    order = [0]
    current = 0
    for _ in range(n):
        for j in range(n):
            if pulp.value(x[current, j]) == 1:
                order.append(j + 1)
                current = j
                break
    order.append(len(dist_matrix) - 1)
    orders = [order]

    for i in range(1, min(n, 4)):
        alt = order.copy()
        alt[i], alt[i + 1] = alt[i + 1], alt[i]
        orders.append(alt)
    return orders[:num_orders]


def get_safe_route(order: List[int], points: List[Coordinate], valhalla_url: str = "http://localhost:8002/route") -> dict:
    """Call Valhalla API to compute a route and estimate risk."""
    locations = [
        {"lon": points[i][0], "lat": points[i][1]} for i in order
    ]
    payload = {
        "locations": locations,
        "costing": "truck",
        "costing_options": {
            "truck": {
                "u_turn_penalty": 10000,
                "left_hand_turn_penalty": 5000,
                "maneuver_penalty": 2000,
                "height": 4.5,
                "width": 3.0,
                "weight": 20000,
            }
        },
        "directions_options": {"units": "miles"},
        "alternatives": 1,
    }
    try:
        response = requests.post(valhalla_url, json=payload, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Valhalla request failed: {exc}") from exc

    data = response.json()
    leg = data["trip"]["legs"][0]
    left_turns = sum(
        1
        for m in leg["maneuvers"]
        if m.get("turn_degree", 0) > 90 and "left" in m.get("verbal_turn_alert", "")
    )
    risk_score = leg["summary"]["length"] + left_turns * 5
    return {
        "polyline": leg["shape"],
        "distance": leg["summary"]["length"],
        "time": leg["summary"]["time"] / 60,
        "risk_score": risk_score,
        "maneuvers": leg["maneuvers"],
    }


def analyze_routes(origin: Coordinate, destination: Coordinate, stops: List[Coordinate]) -> List[dict]:
    points = [origin] + stops + [destination]
    G = get_osm_graph(points)
    dist_matrix = compute_distance_matrix(G, points)
    orders = get_top_stop_orders(dist_matrix, num_orders=5)
    routes = []
    for order in orders:
        try:
            route = get_safe_route(order, points)
            routes.append(route)
        except RuntimeError:
            continue
    routes.sort(key=lambda r: r["risk_score"])
    return routes[:3]


if __name__ == "__main__":
    example_origin = (-90.1234, 30.5678)
    example_destination = (-90.5678, 30.1234)
    example_stops = [
        (-90.2345, 30.3456),
        (-90.3456, 30.4567),
        (-90.4567, 30.5678),
    ]
    best = analyze_routes(example_origin, example_destination, example_stops)
    print(json.dumps(best, indent=2))
