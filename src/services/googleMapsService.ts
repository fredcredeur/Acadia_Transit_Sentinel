import { Loader } from '@googlemaps/js-api-loader';
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
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
  private placesService?: google.maps.places.PlacesService;
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
      
      // Make Google Maps globally available for other services
      (window as Window & typeof globalThis).google = google;
      
    } catch (error) {
      throw new Error(`Failed to initialize Google Maps: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateAndCleanAddress(address: string, preferredRegion?: { lat: number; lng: number; radius: number }): Promise<{ address: string; coordinates?: { lat: number; lng: number } }> {
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }

    // Clean the address first
    let cleanAddress = address.trim();
    
    // Handle current location coordinates
    const coordPattern = /\([-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+\)/;
    if (coordPattern.test(cleanAddress)) {
      const coordMatch = cleanAddress.match(/\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)/);
      if (coordMatch && cleanAddress.startsWith('Current Location')) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        return {
          address: `${lat},${lng}`,
          coordinates: { lat, lng }
        };
      }
      // Remove coordinate patterns from regular addresses
      cleanAddress = cleanAddress.replace(coordPattern, '').trim();
    }

    // If it's already coordinates, return as is
    const coordOnlyPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
    if (coordOnlyPattern.test(cleanAddress)) {
      const [latStr, lngStr] = cleanAddress.split(',');
      const lat = parseFloat(latStr.trim());
      const lng = parseFloat(lngStr.trim());
      return {
        address: cleanAddress,
        coordinates: { lat, lng }
      };
    }

    try {
      // Validate the address using geocoding with regional preference
      const results = await this.geocodeAddress(cleanAddress, preferredRegion);
      
      if (results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        
        // Return the formatted address and coordinates
        return {
          address: result.formatted_address,
          coordinates: {
            lat: location.lat(),
            lng: location.lng()
          }
        };
      }
    } catch (error) {
      // If geocoding fails, try the original address anyway
    }

    return { address: cleanAddress };
  }

  private limitWaypoints(waypoints: google.maps.DirectionsWaypoint[]): google.maps.DirectionsWaypoint[] {
    const MAX_WAYPOINTS = 25;
    
    if (waypoints.length <= MAX_WAYPOINTS) {
      return waypoints;
    }

    // If we have too many waypoints, we need to select the most important ones
    // For now, we'll take evenly distributed waypoints across the route
    const step = Math.ceil(waypoints.length / MAX_WAYPOINTS);
    const limitedWaypoints: google.maps.DirectionsWaypoint[] = [];
    
    for (let i = 0; i < waypoints.length && limitedWaypoints.length < MAX_WAYPOINTS; i += step) {
      limitedWaypoints.push(waypoints[i]);
    }
    
    return limitedWaypoints;
  }

  public async getRoutes(request: {
    origin: string;
    destination: string;
    waypoints?: string[] | google.maps.DirectionsWaypoint[];
    travelMode?: google.maps.TravelMode;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
    departureTime?: Date;
  }): Promise<google.maps.DirectionsResult> {
    
    if (!this.isInitialized()) {
      throw new Error('Google Maps service not initialized. Please ensure the API key is configured correctly.');
    }

    if (!this.directionsService) {
      throw new Error('Directions service not available');
    }

    try {
      // Validate and clean addresses
      const cleanOrigin = await this.validateAndCleanAddress(request.origin);
      const cleanDestination = await this.validateAndCleanAddress(request.destination);
      
      // Prepare waypoints - handle both string arrays and DirectionsWaypoint arrays
      let googleWaypoints: google.maps.DirectionsWaypoint[] = [];
      if (request.waypoints && request.waypoints.length > 0) {
        if (typeof request.waypoints[0] === 'string') {
          // Convert string array to DirectionsWaypoint array
          const stringWaypoints = request.waypoints as string[];
          for (const waypoint of stringWaypoints) {
            try {
              const cleanWaypoint = await this.validateAndCleanAddress(waypoint);
              googleWaypoints.push({
                location: cleanWaypoint.address,
                stopover: true
              });
            } catch (error) {
              // Skip invalid waypoints silently
            }
          }
        } else {
          // Already DirectionsWaypoint array
          googleWaypoints = request.waypoints as google.maps.DirectionsWaypoint[];
        }
      }

      // Limit waypoints to Google Maps API maximum
      googleWaypoints = this.limitWaypoints(googleWaypoints);

      // Enhanced directions request with traffic data
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
            resolve(result);
          } else {
            let errorMessage = `Directions request failed: ${status}`;
            
            switch (status) {
              case google.maps.DirectionsStatus.NOT_FOUND:
                errorMessage = 'Could not find a route between the specified locations. Please check that the addresses are valid and accessible by the selected travel mode.';
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
              case google.maps.DirectionsStatus.INVALID_REQUEST:
                errorMessage = 'Invalid directions request. Please check the origin, destination, and waypoints.';
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
    incidents: Array<{
      type: 'accident' | 'construction' | 'closure';
      description: string;
      severity: 'minor' | 'major';
    }>;
  }> {
    
    try {
      // Get current traffic conditions by requesting a short route in the area
      const testDestination = `${lat + 0.005},${lng + 0.005}`; // ~500m away
      const testOrigin = `${lat},${lng}`;
      
      const result = await this.getRoutes({
        origin: testOrigin,
        destination: testDestination,
        departureTime: new Date()
      });
      
      if (result.routes.length > 0) {
        const leg = result.routes[0].legs[0];
        const duration = leg.duration?.value || 0;
        const durationInTraffic = leg.duration_in_traffic?.value || duration;
        const distance = leg.distance?.value || 1;
        
        // Calculate current speed and congestion
        const currentSpeed = (distance / durationInTraffic) * 2.237;
        const congestionRatio = duration / durationInTraffic;
        
        let congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
        if (congestionRatio <= 1.1) congestionLevel = 'low';
        else if (congestionRatio <= 1.3) congestionLevel = 'moderate';
        else if (congestionRatio <= 1.7) congestionLevel = 'heavy';
        else congestionLevel = 'severe';
        
        return {
          congestionLevel,
          averageSpeed: currentSpeed,
          incidents: []
        };
      }
      
      return {
        congestionLevel: 'low',
        averageSpeed: 30,
        incidents: []
      };
      
    } catch (error) {
      return {
        congestionLevel: 'moderate',
        averageSpeed: 25,
        incidents: []
      };
    }
  }

  public async getEnhancedRoadData(lat: number, lng: number): Promise<RoadData & {
    liveTraffic: {
      congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
      currentSpeed: number;
      normalSpeed: number;
      trafficDelay: number;
    };
  }> {
    
    // Get base road data
    const baseData = await this.getRoadData(lat, lng);
    
    // Get live traffic data
    const trafficData = await this.getLiveTrafficData(lat, lng);
    
    // Estimate normal speed based on road type
    const normalSpeed = baseData.speedLimit || 35;
    const trafficDelay = trafficData.congestionLevel === 'low' ? 0 :
                        trafficData.congestionLevel === 'moderate' ? 30 :
                        trafficData.congestionLevel === 'heavy' ? 120 : 300;
    
    return {
      ...baseData,
      liveTraffic: {
        congestionLevel: trafficData.congestionLevel,
        currentSpeed: trafficData.averageSpeed,
        normalSpeed,
        trafficDelay
      }
    };
  }

  public async getRoadData(lat: number, lng: number): Promise<RoadData> {
    return this.simulateRoadData(lat, lng);
  }

  private simulateRoadData(lat: number, lng: number): RoadData {
    const hash = Math.abs(lat * lng * 1000) % 100;
    
    return {
      speedLimit: 25 + (hash % 40),
      roadWidth: 20 + (hash % 60),
      pedestrianTraffic: hash % 100,
      heightRestrictions: hash > 80 ? 13.5 : 0
    };
  }

  public calculateDistance(
    point1: google.maps.LatLng,
    point2: google.maps.LatLng
  ): number {
    return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
  }

  public async geocodeAddress(address: string, preferredRegion?: { lat: number; lng: number; radius: number }): Promise<google.maps.GeocoderResult[]> {
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const geocodeRequest: google.maps.GeocoderRequest = {
        address: address,
        region: 'US',
        componentRestrictions: {
          country: 'US'
        }
      };

      if (preferredRegion) {
        const { lat, lng, radius } = preferredRegion;
        const radiusInDegrees = radius / 111000;
        
        geocodeRequest.bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(lat - radiusInDegrees, lng - radiusInDegrees),
          new google.maps.LatLng(lat + radiusInDegrees, lng + radiusInDegrees)
        );
      } else {
        geocodeRequest.bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(28.0, -95.0),
          new google.maps.LatLng(33.5, -88.0)
        );
      }
      
      this.geocoder!.geocode(geocodeRequest, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) {
          resolve(results);
        } else {
          let errorMessage = 'Geocoding failed';
          switch (status) {
            case google.maps.GeocoderStatus.ZERO_RESULTS:
              errorMessage = `No results found for address: "${address}". Please try a more specific address with city and state.`;
              break;
            case google.maps.GeocoderStatus.OVER_QUERY_LIMIT:
              errorMessage = 'Too many geocoding requests. Please wait and try again.';
              break;
            case google.maps.GeocoderStatus.REQUEST_DENIED:
              errorMessage = 'Geocoding request denied. Please check API configuration and ensure the Geocoding API is enabled.';
              break;
            case google.maps.GeocoderStatus.UNKNOWN_ERROR:
              errorMessage = 'Geocoding service temporarily unavailable. Please ensure the Geocoding API is enabled in your Google Cloud Console and try again.';
              break;
            default:
              errorMessage = `Geocoding failed with status: ${status}`;
          }
          reject(new Error(errorMessage));
        }
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
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }

    return new Promise((resolve, reject) => {
      this.geocoder!.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) {
          resolve(results);
        } else {
          let errorMessage = 'Reverse geocoding failed';
          switch (status) {
            case google.maps.GeocoderStatus.ZERO_RESULTS:
              errorMessage = 'No address found for the specified coordinates.';
              break;
            case google.maps.GeocoderStatus.OVER_QUERY_LIMIT:
              errorMessage = 'Too many geocoding requests. Please wait and try again.';
              break;
            case google.maps.GeocoderStatus.REQUEST_DENIED:
              errorMessage = 'Reverse geocoding request denied. Please check API configuration and ensure the Geocoding API is enabled.';
              break;
            case google.maps.GeocoderStatus.UNKNOWN_ERROR:
              errorMessage = 'Geocoding service temporarily unavailable. Please ensure the Geocoding API is enabled in your Google Cloud Console and try again.';
              break;
            default:
              errorMessage = `Reverse geocoding failed with status: ${status}`;
          }
          reject(new Error(errorMessage));
        }
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
    
    if (constraints.preferLoops && request.waypoints && request.waypoints.length > 0) {
      return this.getBlockRoutingWithStops(request, vehicleClass);
    }
    
    return this.getConstrainedRoutes(request, constraints);
  }
  
  private async getBlockRoutingWithStops(request: {
    origin: string;
    destination: string;
    waypoints?: string[];
    vehicle: Vehicle;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
  }, vehicleClass: VehicleClass): Promise<google.maps.DirectionsResult> {
    
    const allPoints = [request.origin, ...(request.waypoints || []), request.destination];
    const optimizedWaypoints = await this.optimizeWaypointsForBlockRouting(allPoints, vehicleClass);
    
    return this.getConstrainedRoutes({
      ...request,
      waypoints: optimizedWaypoints
    }, VehicleClassificationService.getRoutingConstraints(vehicleClass));
  }
  
  private async optimizeWaypointsForBlockRouting(
    points: string[], 
    vehicleClass: VehicleClass
  ): Promise<string[]> {
    
    if (points.length <= 2) return points.slice(1, -1);
    
    const optimizedPoints: string[] = [];
    
    for (let i = 1; i < points.length - 1; i++) {
      const waypoint = points[i];
      
      try {
        const geocodeResults = await this.geocodeAddress(waypoint);
        if (geocodeResults.length > 0) {
          const location = geocodeResults[0].geometry.location;
          
          const optimizedPoint = await this.findOptimalApproachPoint(
            location.lat(), 
            location.lng(),
            vehicleClass
          );
          
          optimizedPoints.push(optimizedPoint || waypoint);
        } else {
          optimizedPoints.push(waypoint);
        }
      } catch (error) {
        optimizedPoints.push(waypoint);
      }
    }
    
    return optimizedPoints;
  }
  
  private async findOptimalApproachPoint(
    lat: number, 
    lng: number, 
    vehicleClass: VehicleClass
  ): Promise<string | null> {
    
    const searchPoints = [
      { lat: lat + 0.001, lng: lng },
      { lat: lat - 0.001, lng: lng },
      { lat: lat, lng: lng + 0.001 },
      { lat: lat, lng: lng - 0.001 },
      { lat: lat + 0.0007, lng: lng + 0.0007 },
      { lat: lat - 0.0007, lng: lng + 0.0007 },
      { lat: lat - 0.0007, lng: lng - 0.0007 },
      { lat: lat + 0.0007, lng: lng - 0.0007 },
    ];
    
    for (const point of searchPoints) {
      try {
        const reverseGeocode = await this.reverseGeocode(point.lat, point.lng);
        if (reverseGeocode.length > 0) {
          return reverseGeocode[0].formatted_address;
        }
      } catch (_error) {
        continue;
      }
    }
    
    return null;
  }
  
  private async getConstrainedRoutes(request: {
    origin: string;
    destination: string;
    waypoints?: string[];
    avoidHighways?: boolean;
    avoidTolls?: boolean;
  }, constraints: RoutingConstraints): Promise<google.maps.DirectionsResult> {
    
    // Convert string waypoints to DirectionsWaypoint format
    const googleWaypoints: google.maps.DirectionsWaypoint[] = [];
    if (request.waypoints && request.waypoints.length > 0) {
      for (const waypoint of request.waypoints) {
        try {
          const cleanWaypoint = await this.validateAndCleanAddress(waypoint);
          googleWaypoints.push({
            location: cleanWaypoint.address,
            stopover: true
          });
        } catch (error) {
          // Skip invalid waypoints
        }
      }
    }
    
    // Limit waypoints to Google Maps API maximum
    const limitedWaypoints = this.limitWaypoints(googleWaypoints);
    
    const directionsRequest: google.maps.DirectionsRequest = {
      origin: request.origin,
      destination: request.destination,
      waypoints: limitedWaypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: request.avoidHighways || constraints.avoidResidential,
      avoidTolls: request.avoidTolls,
      optimizeWaypoints: false,
      provideRouteAlternatives: true
    };
    
    return new Promise((resolve, reject) => {
      if (!this.directionsService) {
        reject(new Error('Directions service not available'));
        return;
      }
      
      this.directionsService.route(directionsRequest, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          
          const filteredRoutes = this.filterRoutesByConstraints(result.routes, constraints);
          
          if (filteredRoutes.length > 0) {
            result.routes = filteredRoutes;
            resolve(result);
          } else {
            reject(new Error('No suitable routes found for this vehicle type. Consider using a smaller vehicle or different addresses.'));
          }
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }
  
  private filterRoutesByConstraints(
    routes: google.maps.DirectionsRoute[], 
    constraints: RoutingConstraints
  ): google.maps.DirectionsRoute[] {
    
    return routes.filter(route => {
      for (const leg of route.legs) {
        for (const step of leg.steps) {
          const instructions = step.instructions.toLowerCase();
          
          if (constraints.avoidUTurns && this.containsUTurn(instructions)) {
            return false;
          }
          
          if (constraints.avoidSharpTurns && this.containsSharpTurn(instructions, constraints.maxTurnAngle)) {
            return false;
          }
          
          if (constraints.avoidResidential && this.isResidentialArea(instructions)) {
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  private containsUTurn(instructions: string): boolean {
    const uTurnIndicators = [
      'u-turn', 'u turn', 'make a u-turn', 'turn around',
      'reverse direction', 'head back', 'return'
    ];
    
    return uTurnIndicators.some(indicator => 
      instructions.includes(indicator)
    );
  }
  
  private containsSharpTurn(instructions: string, maxAngle: number): boolean {
    if (maxAngle >= 180) return false;
    
    const sharpTurnIndicators = [
      'sharp turn', 'sharp left', 'sharp right',
      'hairpin', 'tight turn', 'steep turn'
    ];
    
    if (maxAngle <= 90) {
      return sharpTurnIndicators.some(indicator => 
        instructions.includes(indicator)
      );
    }
    
    return false;
  }
  
  private isResidentialArea(instructions: string): boolean {
    const residentialIndicators = [
      'residential', 'neighborhood', 'subdivision',
      'cul-de-sac', 'dead end', 'private road'
    ];
    
    return residentialIndicators.some(indicator => 
      instructions.includes(indicator)
    );
  }
<<<<<<< HEAD
=======
import { Location, Route, RoutePoint } from '../types';

let googleMapsLoader: Promise<typeof google> | null = null;

export function initGoogleMaps(): Promise<typeof google> {
  if (googleMapsLoader) return googleMapsLoader;
  
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing'));
  }
  
  const loader = new Loader({
    apiKey,
    version: 'weekly',
    libraries: ['places', 'routes']
  });
  
  googleMapsLoader = loader.load();
  return googleMapsLoader;
}

export async function geocodeAddress(address: string): Promise<Location | null> {
  await initGoogleMaps();
  
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const result = results[0];
        const location: Location = {
          id: result.place_id || `location-${Date.now()}`,
          name: address,
          address: result.formatted_address || address,
          position: {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng()
          }
        };
        resolve(location);
      } else {
        resolve(null);
      }
    });
  });
}

export async function getDirections(
  origin: Location,
  destination: Location,
  waypoints: Location[] = []
): Promise<Route | null> {
  await initGoogleMaps();
  
  return new Promise((resolve) => {
    const directionsService = new google.maps.DirectionsService();
    
    const waypointsList = waypoints.map(wp => ({
      location: new google.maps.LatLng(wp.position.lat, wp.position.lng),
      stopover: true
    }));
    
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.position.lat, origin.position.lng),
        destination: new google.maps.LatLng(destination.position.lat, destination.position.lng),
        waypoints: waypointsList,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const route = result.routes[0];
          const leg = route.legs[0];
          
          if (!leg) {
            resolve(null);
            return;
          }
          
          const points: RoutePoint[] = [];
          
          // Add origin
          points.push({
            location: origin,
            departureTime: new Date().toLocaleTimeString(),
            isStop: true
          });
          
          // Add waypoints
          waypoints.forEach((waypoint, index) => {
            const waypointLeg = route.legs[index];
            points.push({
              location: waypoint,
              arrivalTime: new Date().toLocaleTimeString(),
              departureTime: new Date(Date.now() + 5 * 60000).toLocaleTimeString(),
              isStop: true
            });
          });
          
          // Add destination
          points.push({
            location: destination,
            arrivalTime: new Date(Date.now() + leg.duration.value * 1000).toLocaleTimeString(),
            isStop: true
          });
          
          const newRoute: Route = {
            id: `route-${Date.now()}`,
            name: `Route to ${destination.name}`,
            points,
            distance: leg.distance.value,
            duration: leg.duration.value
          };
          
          resolve(newRoute);
        } else {
          resolve(null);
        }
      }
    );
  });
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
}