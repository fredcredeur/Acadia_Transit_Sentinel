# Acadia Transit Sentinel

This project provides advanced route analysis tailored for large vehicles. Use
the **Route Planning** tab to drop markers for your origin, destination, and
any stops. Only the pins appear on this map so you can position them precisely.
No route lines are drawn during planning so the map stays uncluttered.
Once the locations are set, click **Analyze Routes** to generate results.
The **Route Analysis** view displays the three safest routes ranked by overall
risk score on a read‑only map, keeping adjustments focused on the planning
stage.

## Backend Route Analyzer

A small Python script is included under `backend/route_analyzer.py` that
demonstrates how to compute the three safest routes using OpenStreetMap data.
It fetches the road network with `osmnx`, solves a simple TSP to order stops
and queries a Valhalla routing server to evaluate each candidate.  The script
requires `networkx`, `osmnx`, `pulp` and `requests` and expects a local
Valhalla instance running on `http://localhost:8002`.
