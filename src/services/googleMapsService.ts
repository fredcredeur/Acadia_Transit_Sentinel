import { Loader } from '@googlemaps/js-api-loader';
import { Vehicle, VehicleClass, RoutingConstraints } from '../types';
import { VehicleClassificationService } from './vehicleClassificationService';

export interface RouteRequest {
  origin: string;
  destination: string;
  waypoints?: string[];
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
      console.warn('Google Maps API key not found in environment variables');
      throw new Error('Google Maps API key is required. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
    }

    console.log('Initializing Google Maps with API key:', apiKey.substring(0, 10) + '...');

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
      console.log('Google Maps already initialized');
      return;
    }

    try {
      console.log('Loading Google Maps...');
      const google = await this.loader.load();
      console.log('Google Maps loaded successfully');
      
      this.directionsService = new google.maps.DirectionsService();
      this.geocoder = new google.maps.Geocoder();
      this.isLoaded = true;
      
      // Make Google Maps globally available for other services
      (window as any).google = google;
      
      console.log('Google Maps services initialized');
    } catch (error) {
      console.error('Failed to load Google Maps:', error);
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
        console.log('Using current location coordinates:', lat, lng);
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
      console.log('Using coordinate address:', lat, lng);
      return {
        address: cleanAddress,
        coordinates: { lat, lng }
      };
    }

    try {
      console.log('Validating address via geocoding:', cleanAddress);
      // Validate the address using geocoding with regional preference
      const results = await this.geocodeAddress(cleanAddress, preferredRegion);
      
      if (results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        
        console.log('Address validated:', result.formatted_address);
        console.log('Coordinates:', location.lat(), location.lng());
        
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
      console.warn('Geocoding validation failed for:', cleanAddress, error);
      // If geocoding fails, try the original address anyway
    }

    console.log('Using original address:', cleanAddress);
    return { address: cleanAddress };
  }

  public async getRoutes(request: {
    origin: string;
    destination: string;
    waypoints?: string[];
    travelMode?: google.maps.TravelMode;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
    departureTime?: Date; // NEW: For live traffic
  }): Promise<google.maps.DirectionsResult> {
    
    if (!this.isInitialized) {
      throw new Error('Google Maps service not initialized. Please ensure the API key is configured correctly.');
    }

    try {
      console.log('🚦 Getting routes with live traffic data...');
      
      // Prepare waypoints
      let googleWaypoints: google.maps.DirectionsWaypoint[] = [];
      if (request.waypoints && request.waypoints.length > 0) {
        googleWaypoints = request.waypoints.map(waypoint => ({
          location: waypoint,
          stopover: true
        }));
      }

      // Enhanced directions request with traffic data
      const directionsRequest: google.maps.DirectionsRequest = {
        origin: request.origin,
        destination: request.destination,
        waypoints: googleWaypoints,
        travelMode: request.travelMode || google.maps.TravelMode.DRIVING,
        avoidHighways: request.avoidHighways || false,
        avoidTolls: request.avoidTolls || false,
        
        // 🚦 LIVE TRAFFIC CONFIGURATION
        drivingOptions: {
          departureTime: request.departureTime || new Date(), // Current time = live traffic
          trafficModel: google.maps.TrafficModel.BEST_GUESS   // Use live traffic data
        },
        
        // Request multiple route alternatives to compare traffic
        provideRouteAlternatives: true,
        
        // Optimize waypoints for better traffic analysis
        optimizeWaypoints: false // Keep user-specified order
      };

      console.log('📡 Requesting routes with traffic model:', directionsRequest.drivingOptions?.trafficModel);

      return new Promise((resolve, reject) => {
        const directionsService = new google.maps.DirectionsService();
        
        directionsService.route(directionsRequest, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            console.log('✅ Routes received with live traffic data');
            console.log(`📊 Found ${result.routes.length} route(s) with traffic information`);
            
            // Log traffic information for debugging
            result.routes.forEach((route, index) => {
              route.legs.forEach((leg, legIndex) => {
                console.log(`Route ${index + 1}, Leg ${legIndex + 1}:`);
                console.log(`  📍 ${leg.start_address} → ${leg.end_address}`);
                console.log(`  📏 Distance: ${leg.distance?.text}`);
                console.log(`  ⏱️ Duration: ${leg.duration?.text}`);
                
                // Check for traffic-aware duration
                if (leg.duration_in_traffic) {
                  console.log(`  🚦 Duration in traffic: ${leg.duration_in_traffic.text}`);
                  console.log(`  ⚡ Traffic delay: ${leg.duration_in_traffic.value - leg.duration!.value} seconds`);
                } else {
                  console.log('  ⚠️ No traffic data available for this leg');
                }
              });
            });
            
            resolve(result);
          } else {
            console.error('❌ Directions request failed:', status);
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('Error in getRoutes:', error);
      throw error;
    }
  }

  public async getLiveTrafficData(lat: number, lng: number, radiusMeters: number = 1000): Promise<{
    congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
    averageSpeed: number;
    incidents: Array<{
      type: 'accident' | 'construction' | 'closure';
      description: string;
      severity: 'minor' | 'major';
    }>;
  }> {
    
    // Note: This would require Google Traffic API or Distance Matrix API
    // For now, we'll enhance the existing route-based traffic detection
    
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
        const normalSpeed = (distance / duration) * 2.237; // m/s to mph
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
          incidents: [] // Would be populated from traffic incidents API
        };
      }
      
      return {
        congestionLevel: 'low',
        averageSpeed: 30,
        incidents: []
      };
      
    } catch (error) {
      console.warn('Could not get live traffic data:', error);
      return {
        congestionLevel: 'moderate',
        averageSpeed: 25,
        incidents: []
      };
    }
  }

  // NEW: Enhanced road data with live traffic integration
  public async getEnhancedRoadData(lat: number, lng: number): Promise<RoadData & {
    liveTraffic: {
      congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
      currentSpeed: number;
      normalSpeed: number;
      trafficDelay: number; // seconds
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
    // This would integrate with Google Roads API and other data sources
    // For now, we'll simulate the data based on location characteristics
    return this.simulateRoadData(lat, lng);
  }

  private simulateRoadData(lat: number, lng: number): RoadData {
    // Simulate road data based on coordinates
    // In production, this would call Google Roads API and other services
    const hash = Math.abs(lat * lng * 1000) % 100;
    
    return {
      speedLimit: 25 + (hash % 40), // 25-65 mph
      roadWidth: 20 + (hash % 60), // 20-80 (risk factor, not actual width)
      pedestrianTraffic: hash % 100, // 0-100 risk factor
      heightRestrictions: hash > 80 ? 13.5 : 0 // Occasional height restrictions
    };
  }

  public calculateDistance(
    point1: google.maps.LatLng,
    point2: google.maps.LatLng
  ): number {
    return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
  }

  private calculateDistanceInMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  public async geocodeAddress(address: string, preferredRegion?: { lat: number; lng: number; radius: number }): Promise<google.maps.GeocoderResult[]> {
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }
    
    console.log('Geocoding address:', address, preferredRegion ? 'with regional preference' : '');
    
    return new Promise((resolve, reject) => {
      // Enhanced geocoding request with better regional bias
      const geocodeRequest: google.maps.GeocoderRequest = {
        address: address,
        region: 'US',
        componentRestrictions: {
          country: 'US'
        }
      };

      // Add regional bounds if provided
      if (preferredRegion) {
        const { lat, lng, radius } = preferredRegion;
        const radiusInDegrees = radius / 111000; // Rough conversion from meters to degrees
        
        geocodeRequest.bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(lat - radiusInDegrees, lng - radiusInDegrees),
          new google.maps.LatLng(lat + radiusInDegrees, lng + radiusInDegrees)
        );
        
        console.log('Using regional bounds for geocoding');
      } else {
        // Default to Louisiana/surrounding area bounds for better local results
        geocodeRequest.bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(28.0, -95.0), // Southwest Louisiana/Texas border
          new google.maps.LatLng(33.5, -88.0)  // Northeast Louisiana/Mississippi border
        );
        
        console.log('Using default Louisiana regional bounds');
      }
      
      this.geocoder!.geocode(geocodeRequest, (results, status) => {
        console.log('Geocoding status:', status, 'Results:', results?.length || 0);
        
        if (results && results.length > 0) {
          // Log the first few results for debugging
          results.slice(0, 3).forEach((result, index) => {
            const location = result.geometry.location;
            console.log(`Result ${index + 1}:`, result.formatted_address, `(${location.lat()}, ${location.lng()})`);
          });
        }
        
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
            default:
              errorMessage = `Geocoding failed with status: ${status}`;
          }
          console.error('Geocoding error:', errorMessage);
          reject(new Error(errorMessage));
        }
      });
    });
  }

  public isInitialized(): boolean {
    return this.isLoaded;
  }

  public hasApiKey(): boolean {
    const hasKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    console.log('Has API key:', hasKey);
    return hasKey;
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
          reject(new Error(`Reverse geocoding failed with status: ${status}`));
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
    
    console.log('🚗 Vehicle Classification:', vehicleClass.type);
    console.log('🛣️ Routing Constraints:', constraints);
    
    // For large vehicles that require block routing, modify the approach
    if (constraints.preferLoops && request.waypoints && request.waypoints.length > 0) {
      return this.getBlockRoutingWithStops(request, vehicleClass);
    }
    
    // Standard routing with vehicle constraints
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
    
    console.log('🔄 Using block routing for large vehicle');
    
    // For buses/large trucks, create a route that goes around blocks
    // instead of requiring U-turns at stops
    
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
    console.log('🧭 Optimizing waypoints for block routing...');
    
    if (points.length <= 2) return points.slice(1, -1); // Remove origin/destination
    
    // For each waypoint, try to find a nearby point that allows 
    // for easier block navigation
    const optimizedPoints: string[] = [];
    
    for (let i = 1; i < points.length - 1; i++) {
      const waypoint = points[i];
      
      try {
        // Geocode the waypoint to get coordinates
        const geocodeResults = await this.geocodeAddress(waypoint);
        if (geocodeResults.length > 0) {
          const location = geocodeResults[0].geometry.location;
          
          // For large vehicles, try to find a point that's on a corner
          // or intersection that allows for easier turning
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
        console.warn('Could not optimize waypoint:', waypoint);
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
    
    // For large vehicles, look for nearby intersections or corners
    // that would allow for easier block-style navigation
    
    const radius = vehicleClass.type === 'bus' ? 200 : 150; // meters
    const searchPoints = [
      { lat: lat + 0.001, lng: lng }, // North
      { lat: lat - 0.001, lng: lng }, // South  
      { lat: lat, lng: lng + 0.001 }, // East
      { lat: lat, lng: lng - 0.001 }, // West
      { lat: lat + 0.0007, lng: lng + 0.0007 }, // Northeast corner
      { lat: lat - 0.0007, lng: lng + 0.0007 }, // Southeast corner
      { lat: lat - 0.0007, lng: lng - 0.0007 }, // Southwest corner
      { lat: lat + 0.0007, lng: lng - 0.0007 }, // Northwest corner
    ];
    
    // Return the first viable alternative point
    // In a full implementation, this would use Google Roads API
    // to find actual intersection points
    for (const point of searchPoints) {
      try {
        const reverseGeocode = await this.reverseGeocode(point.lat, point.lng);
        if (reverseGeocode.length > 0) {
          return reverseGeocode[0].formatted_address;
        }
      } catch (error) {
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
    
    console.log('🚦 Applying routing constraints:', constraints);
    
    // Build Google Maps request with constraints
    const directionsRequest: google.maps.DirectionsRequest = {
      origin: request.origin,
      destination: request.destination,
      waypoints: request.waypoints?.map(waypoint => ({
        location: waypoint,
        stopover: true
      })) || [],
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: request.avoidHighways || constraints.avoidResidential,
      avoidTolls: request.avoidTolls,
      optimizeWaypoints: false, // Keep waypoint order for large vehicles
      provideRouteAlternatives: true
    };
    
    return new Promise((resolve, reject) => {
      const directionsService = new google.maps.DirectionsService();
      
      directionsService.route(directionsRequest, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          
          // Filter routes based on vehicle constraints
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
      // Check each leg and step for constraint violations
      for (const leg of route.legs) {
        for (const step of leg.steps) {
          const instructions = step.instructions.toLowerCase();
          
          // Check for U-turn violations
          if (constraints.avoidUTurns && this.containsUTurn(instructions)) {
            console.log('❌ Route rejected: Contains U-turn');
            return false;
          }
          
          // Check for sharp turn violations  
          if (constraints.avoidSharpTurns && this.containsSharpTurn(instructions, constraints.maxTurnAngle)) {
            console.log('❌ Route rejected: Contains sharp turn');
            return false;
          }
          
          // Check for residential area violations
          if (constraints.avoidResidential && this.isResidentialArea(instructions)) {
            console.log('❌ Route rejected: Goes through residential area');
            return false;
          }
        }
      }
      
      console.log('✅ Route approved for vehicle constraints');
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
    if (maxAngle >= 180) return false; // No restrictions
    
    const sharpTurnIndicators = [
      'sharp turn', 'sharp left', 'sharp right',
      'hairpin', 'tight turn', 'steep turn'
    ];
    
    // If max angle is 90 degrees, avoid any "sharp" language
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
}
