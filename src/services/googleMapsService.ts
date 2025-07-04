import { Loader } from '@googlemaps/js-api-loader';
import { Vehicle, VehicleClass, RoutingConstraints } from '../types';
import { VehicleClassificationService } from './vehicleClassificationService';

export interface RouteRequest {
  origin: string;
  destination: string;
  waypoints?: google.maps.DirectionsWaypoint[];
  travelMode: google.maps.TravelMode;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
}


export interface RouteResponse {
  routes: google.maps.DirectionsRoute[];
  status: google.maps.DirectionsStatus;
}

export interface RoadData {
  speedLimit?: number;
  roadWidth?: number;
  pedestrianTraffic?: number;
  heightRestrictions?: number;
}

export class GoogleMapsService {
  private static instance: GoogleMapsService;
  private loader: Loader;
  private directionsService?: google.maps.DirectionsService;
  private geocoder?: google.maps.Geocoder;
  private isLoaded = false;

  private constructor() {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key is required. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
    }
    this.loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry', 'routes']
    });
  }

  public static getInstance(): GoogleMapsService {
    if (!GoogleMapsService.instance) {
      GoogleMapsService.instance = new GoogleMapsService();
    }
    return GoogleMapsService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isLoaded) {
      return;
    }
    try {
      const google = await this.loader.load();
      this.directionsService = new google.maps.DirectionsService();
      this.geocoder = new google.maps.Geocoder();
      this.isLoaded = true;
      (window as Window & typeof globalThis).google = google;
    } catch (error) {
      throw new Error(`Failed to initialize Google Maps: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateAndCleanAddress(address: string, preferredRegion?: { lat: number; lng: number; radius: number }): Promise<{ address: string; coordinates?: { lat: number; lng: number } }> {
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }
    let cleanAddress = address.trim();
    const coordPattern = /\([-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+\)/;
    if (coordPattern.test(cleanAddress)) {
      const coordMatch = cleanAddress.match(/\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)/);
      if (coordMatch && cleanAddress.startsWith('Current Location')) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        return { address: `${lat},${lng}`, coordinates: { lat, lng } };
      }
      cleanAddress = cleanAddress.replace(coordPattern, '').trim();
    }
    const coordOnlyPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
    if (coordOnlyPattern.test(cleanAddress)) {
      const [latStr, lngStr] = cleanAddress.split(',');
      const lat = parseFloat(latStr.trim());
      const lng = parseFloat(lngStr.trim());
      return { address: cleanAddress, coordinates: { lat, lng } };
    }
    try {
      const results = await this.geocodeAddress(cleanAddress, preferredRegion);
      if (results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        return {
          address: result.formatted_address,
          coordinates: { lat: location.lat(), lng: location.lng() }
        };
      }
    } catch {
      // fallback
    }
    return { address: cleanAddress };
  }

  private limitWaypoints(waypoints: google.maps.DirectionsWaypoint[]): google.maps.DirectionsWaypoint[] {
    const MAX_WAYPOINTS = 25;
    if (waypoints.length <= MAX_WAYPOINTS) {
      return waypoints;
    }
    const step = Math.ceil(waypoints.length / MAX_WAYPOINTS);
    const limitedWaypoints: google.maps.DirectionsWaypoint[] = [];
    for (let i = 0; i < waypoints.length && limitedWaypoints.length < MAX_WAYPOINTS; i += step) {
      limitedWaypoints.push(waypoints[i]);
    }
    return limitedWaypoints;
  }

  /**
   * Filter routes that contain U-turns or other problematic maneuvers for large vehicles.
   */
  private filterRoutesForLargeVehicles(routes: google.maps.DirectionsRoute[], vehicle: Vehicle): google.maps.DirectionsRoute[] {
    const isLarge = vehicle.length >= 30;
    if (!isLarge) return routes;

    const filtered = routes.filter(route => this.countUTurns(route) === 0);
    if (filtered.length > 0) return filtered;
    // fallback - return least number of U-turns
    let minRoute = routes[0];
    let min = this.countUTurns(minRoute);
    for (const r of routes.slice(1)) {
      const c = this.countUTurns(r);
      if (c < min) {
        min = c;
        minRoute = r;
      }
    }
    return [minRoute];
  }

  private countUTurns(route: google.maps.DirectionsRoute): number {
    let count = 0;
    route.legs.forEach(leg => {
      leg.steps.forEach(step => {
        const instr = step.instructions.replace(/<[^>]*>/g, ' ').toLowerCase();
        const maneuver = (step as any).maneuver?.toLowerCase() || '';
        if (instr.includes('u-turn') || instr.includes('u turn') || instr.includes('turn around') || maneuver.includes('uturn')) {
          count += 1;
        }
      });
    });
    return count;
  }

  public async getRoutes(request: {
    origin: string;
    destination: string;
    waypoints?: string[] | google.maps.DirectionsWaypoint[];
    travelMode?: google.maps.TravelMode;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
    departureTime?: Date;
    vehicle?: Vehicle;
  }): Promise<google.maps.DirectionsResult> {
    if (!this.isInitialized()) {
      throw new Error('Google Maps service not initialized. Please ensure the API key is configured correctly.');
    }
    if (!this.directionsService) {
      throw new Error('Directions service not available');
    }
    try {
      const cleanOrigin = await this.validateAndCleanAddress(request.origin);
      const cleanDestination = await this.validateAndCleanAddress(request.destination);
      let googleWaypoints: google.maps.DirectionsWaypoint[] = [];
      if (request.waypoints && request.waypoints.length > 0) {
        if (typeof request.waypoints[0] === 'string') {
          const stringWaypoints = request.waypoints as string[];
          for (const waypoint of stringWaypoints) {
            try {
              const cleanWaypoint = await this.validateAndCleanAddress(waypoint);
              googleWaypoints.push({ location: cleanWaypoint.address, stopover: true });
            } catch {
              // skip invalid
            }
          }
        } else {
          googleWaypoints = request.waypoints as google.maps.DirectionsWaypoint[];
        }
      }
      googleWaypoints = this.limitWaypoints(googleWaypoints);
      const directionsRequest: google.maps.DirectionsRequest = {
        origin: cleanOrigin.address,
        destination: cleanDestination.address,
        waypoints: googleWaypoints,
        travelMode: request.travelMode || google.maps.TravelMode.DRIVING,
        avoidHighways: request.avoidHighways || false,
        avoidTolls: request.avoidTolls || false,
        drivingOptions: {
          departureTime: request.departureTime || new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        },
        provideRouteAlternatives: true,
        optimizeWaypoints: false
      };
      return new Promise((resolve, reject) => {
        this.directionsService!.route(directionsRequest, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            if (request.vehicle && request.vehicle.length >= 30) {
              result.routes = this.filterRoutesForLargeVehicles(result.routes, request.vehicle);
            }
            resolve(result);
          } else {
            let errorMessage = `Directions request failed: ${status}`;
            switch (status) {
              case google.maps.DirectionsStatus.NOT_FOUND:
                errorMessage = 'Could not find a route between the specified locations. Please check that the addresses are valid.';
                break;
              case google.maps.DirectionsStatus.ZERO_RESULTS:
                errorMessage = 'No route could be found between the origin and destination.';
                break;
              case google.maps.DirectionsStatus.OVER_QUERY_LIMIT:
                errorMessage = 'Too many requests. Please wait and try again.';
                break;
              case google.maps.DirectionsStatus.REQUEST_DENIED:
                errorMessage = 'Directions request denied. Please check API configuration.';
                break;
            }
            reject(new Error(errorMessage));
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }

  public async getLiveTrafficData(lat: number, lng: number, _radiusMeters: number = 1000): Promise<{
    congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
    averageSpeed: number;
    incidents: Array<{ type: 'accident' | 'construction' | 'closure'; description: string; severity: 'minor' | 'major' }>;
  }> {
    try {
      const testDestination = `${lat + 0.005},${lng + 0.005}`;
      const testOrigin = `${lat},${lng}`;
      const result = await this.getRoutes({ origin: testOrigin, destination: testDestination, departureTime: new Date() });
      if (result.routes.length > 0) {
        const leg = result.routes[0].legs[0];
        if (leg) { // Ensure leg is defined
          const duration = Number(leg.duration?.value || 0);
          const durationInTraffic = Number((leg.duration_in_traffic?.value || duration) || 1); // Ensure not zero to prevent division by zero
          const distance = leg.distance?.value || 1;
          const currentSpeed = (distance / durationInTraffic) * 2.237;
          const congestionRatio = duration / durationInTraffic;
          let congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
          if (congestionRatio <= 1.1) congestionLevel = 'low';
          else if (congestionRatio <= 1.3) congestionLevel = 'moderate';
          else if (congestionRatio <= 1.7) congestionLevel = 'heavy';
          else congestionLevel = 'severe';
          return { congestionLevel, averageSpeed: currentSpeed, incidents: [] };
        }
      }
      return { congestionLevel: 'low', averageSpeed: 30, incidents: [] };
    } catch {
      return { congestionLevel: 'moderate', averageSpeed: 25, incidents: [] };
    }
  }

  public async getEnhancedRoadData(lat: number, lng: number): Promise<RoadData & {
    liveTraffic: { congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe'; currentSpeed: number; normalSpeed: number; trafficDelay: number; };
  }> {
    const baseData = await this.getRoadData(lat, lng);
    const trafficData = await this.getLiveTrafficData(lat, lng);
    const normalSpeed = baseData.speedLimit || 35;
    const trafficDelay = trafficData.congestionLevel === 'low' ? 0 :
                        trafficData.congestionLevel === 'moderate' ? 30 :
                        trafficData.congestionLevel === 'heavy' ? 120 : 300;
    return { ...baseData, liveTraffic: { congestionLevel: trafficData.congestionLevel, currentSpeed: trafficData.averageSpeed, normalSpeed, trafficDelay } };
  }

  public async getRoadData(lat: number, lng: number): Promise<RoadData> {
    return this.simulateRoadData(lat, lng);
  }

  private simulateRoadData(lat: number, lng: number): RoadData {
    const hash = Math.abs(lat * lng * 1000) % 100;
    return { speedLimit: 25 + (hash % 40), roadWidth: 20 + (hash % 60), pedestrianTraffic: hash % 100, heightRestrictions: hash > 80 ? 13.5 : 0 };
  }

  public calculateDistance(point1: google.maps.LatLng, point2: google.maps.LatLng): number {
    return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
  }

  public async geocodeAddress(address: string, preferredRegion?: { lat: number; lng: number; radius: number }): Promise<google.maps.GeocoderResult[]> {
    if (!this.geocoder) throw new Error('Geocoder not initialized');
    return new Promise((resolve, reject) => {
      const geocodeRequest: google.maps.GeocoderRequest = {
        address,
        region: 'US',
        componentRestrictions: { country: 'US' }
      };
      if (preferredRegion) {
        const { lat, lng, radius } = preferredRegion;
        const degrees = radius / 111000;
        geocodeRequest.bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(lat - degrees, lng - degrees),
          new google.maps.LatLng(lat + degrees, lng + degrees)
        );
      }
      this.geocoder!.geocode(geocodeRequest, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) resolve(results);
        else reject(new Error(`Geocoding failed with status: ${status}`));
      });
    });
  }

  public isInitialized(): boolean {
    return this.isLoaded;
  }

  public hasApiKey(): boolean {
    return !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  }

  public async reverseGeocode(lat: number, lng: number): Promise<google.maps.GeocoderResult[]> {
    if (!this.geocoder) throw new Error('Geocoder not initialized');
    return new Promise((resolve, reject) => {
      this.geocoder!.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) resolve(results);
        else reject(new Error(`Reverse geocoding failed with status: ${status}`));
      });
    });
  }

  public async getVehicleAwareRoutes(request: {
    origin: string;
    destination: string;
    waypoints?: string[];
    vehicle: Vehicle;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
  }): Promise<google.maps.DirectionsResult> {
    const vehicleClass = VehicleClassificationService.classifyVehicle(request.vehicle);
    const constraints = VehicleClassificationService.getRoutingConstraints(vehicleClass);
    if (request.vehicle.length >= 30) {
      return this.getLargeVehicleRoutes(request);
    }
    if (constraints.preferLoops && request.waypoints && request.waypoints.length > 0) {
      return this.getBlockRoutingWithStops(request, vehicleClass);
    }
    return this.getConstrainedRoutes(request, constraints);
  }

  private async getBlockRoutingWithStops(request: { origin: string; destination: string; waypoints?: string[]; vehicle: Vehicle; avoidHighways?: boolean; avoidTolls?: boolean }, _vehicleClass: VehicleClass): Promise<google.maps.DirectionsResult> {
    const allPoints = [request.origin, ...(request.waypoints || []), request.destination];
    const optimized = await this.optimizeWaypointsForBlockRouting(allPoints, _vehicleClass);
    return this.getConstrainedRoutes({ ...request, waypoints: optimized }, VehicleClassificationService.getRoutingConstraints(_vehicleClass));
  }

  private async optimizeWaypointsForBlockRouting(points: string[], _vehicleClass: VehicleClass): Promise<string[]> {
    if (points.length <= 2) return points.slice(1, -1);
    const optimized: string[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      try {
        const res = await this.geocodeAddress(points[i]);
        if (res.length > 0) {
          const loc = res[0].geometry.location;
          const candidate = await this.findOptimalApproachPoint(loc.lat(), loc.lng(), _vehicleClass);
          optimized.push(candidate || points[i]);
        } else optimized.push(points[i]);
      } catch {
        optimized.push(points[i]);
      }
    }
    return optimized;
  }

  private async findOptimalApproachPoint(lat: number, lng: number, _vehicleClass: VehicleClass): Promise<string | null> {
    const deltas = [0.001, -0.001, 0.0007];
    for (const dx of deltas) for (const dy of deltas) {
      try {
        const rev = await this.reverseGeocode(lat + dx, lng + dy);
        if (rev.length) return rev[0].formatted_address;
      } catch {}
    }
    return null;
  }

  private async getConstrainedRoutes(request: { origin: string; destination: string; waypoints?: string[]; avoidHighways?: boolean; avoidTolls?: boolean; vehicle?: Vehicle }, constraints: RoutingConstraints): Promise<google.maps.DirectionsResult> {
    const waypoints: google.maps.DirectionsWaypoint[] = [];
    if (request.waypoints) {
      for (const wp of request.waypoints) {
        try {
          const clean = await this.validateAndCleanAddress(wp);
          waypoints.push({ location: clean.address, stopover: true });
        } catch {}
      }
    }
    const limited = this.limitWaypoints(waypoints);
    const dr: google.maps.DirectionsRequest = {
      origin: request.origin,
      destination: request.destination,
      waypoints: limited,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: request.avoidHighways || constraints.avoidResidential,
      avoidTolls: request.avoidTolls,
      optimizeWaypoints: false,
      provideRouteAlternatives: true
    };
    return new Promise((resolve, reject) => {
  if (!this.directionsService) {
    reject(new Error('Directions service not available'));
    return; // Add this return statement
  }
  
  this.directionsService.route(dr, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK && result) {
      let filtered = this.filterRoutesByConstraints(result.routes, constraints);
      if (request.vehicle && request.vehicle.length >= 30) {
        filtered = this.filterRoutesForLargeVehicles(filtered, request.vehicle);
      }
      if (filtered.length) {
        result.routes = filtered;
        resolve(result);
      } else {
        reject(new Error('No suitable routes found for this vehicle type.'));
      }
    } else {
      reject(new Error(`Directions request failed: ${status}`));
    }
  });
  });
}

  /**
   * Public helper to request routes for large vehicles with automatic filtering.
   */
  public async getLargeVehicleRoutes(request: {
    origin: string;
    destination: string;
    waypoints?: string[];
    vehicle: Vehicle;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
  }): Promise<google.maps.DirectionsResult> {
    const result = await this.getRoutes({
      origin: request.origin,
      destination: request.destination,
      waypoints: request.waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: request.avoidHighways,
      avoidTolls: request.avoidTolls,
      vehicle: request.vehicle
    });
    return result;
  }

private filterRoutesByConstraints(routes: google.maps.DirectionsRoute[], constraints: RoutingConstraints): google.maps.DirectionsRoute[] {
  return routes.filter(route => {
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        const instr = step.instructions.replace(/<[^>]*>/g, ' ').toLowerCase();
        const maneuver = (step as any).maneuver?.toLowerCase() || '';
        const hasUTurn =
          instr.includes('u-turn') ||
          instr.includes('u turn') ||
          instr.includes('turn around') ||
          maneuver.includes('uturn');
        if (constraints.avoidUTurns && hasUTurn) return false;
        if (constraints.avoidSharpTurns && instr.includes('sharp turn')) return false;
        if (constraints.avoidResidential && instr.includes('residential')) return false;
      }
    }
    return true;
  });
}
}