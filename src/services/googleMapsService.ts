import { Loader } from '@googlemaps/js-api-loader';

export interface GoogleMapsConfig {
  apiKey: string;
  libraries: string[];
}

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

  public async getRoutes(request: RouteRequest): Promise<RouteResponse> {
    if (!this.directionsService) {
      throw new Error('Google Maps service not initialized. Please ensure the API key is configured correctly.');
    }

    try {
      console.log('Getting routes from', request.origin, 'to', request.destination);
      if (request.waypoints && request.waypoints.length > 0) {
        console.log('With waypoints:', request.waypoints);
      }
      
      // First, try to geocode the origin to establish a regional preference
      let preferredRegion: { lat: number; lng: number; radius: number } | undefined;
      
      try {
        // Try to geocode the origin first to establish regional context
        const originGeocode = await this.geocodeAddress(request.origin);
        if (originGeocode.length > 0) {
          const originLocation = originGeocode[0].geometry.location;
          preferredRegion = {
            lat: originLocation.lat(),
            lng: originLocation.lng(),
            radius: 50000 // 50km radius for local preference
          };
          console.log('Established regional preference around:', preferredRegion);
        }
      } catch (error) {
        console.warn('Could not establish regional preference:', error);
      }

      // Validate and clean origin and destination
      const [originResult, destinationResult] = await Promise.all([
        this.validateAndCleanAddress(request.origin, preferredRegion),
        this.validateAndCleanAddress(request.destination, preferredRegion)
      ]);

      console.log('Cleaned addresses:', originResult.address, '→', destinationResult.address);

      // Validate and clean waypoints if provided
      let waypointResults: { address: string; coordinates?: { lat: number; lng: number } }[] = [];
      if (request.waypoints && request.waypoints.length > 0) {
        console.log('Validating waypoints...');
        waypointResults = await Promise.all(
          request.waypoints.map(waypoint => this.validateAndCleanAddress(waypoint, preferredRegion))
        );
        console.log('Cleaned waypoints:', waypointResults.map(w => w.address));
      }

      // Check if addresses have coordinates and calculate total distance
      if (originResult.coordinates && destinationResult.coordinates) {
        const distance = this.calculateDistanceInMiles(
          originResult.coordinates.lat,
          originResult.coordinates.lng,
          destinationResult.coordinates.lat,
          destinationResult.coordinates.lng
        );
        
        console.log('Distance between origin and destination:', distance, 'miles');
        
        // If distance is very large (>200 miles), warn the user
        if (distance > 200) {
          console.warn('Large distance detected, addresses may be in different regions');
          throw new Error(`The distance between these addresses is ${Math.round(distance)} miles. Please verify:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"\n\nIf this seems incorrect, try adding city and state to both addresses.`);
        }
      }

      // Prepare waypoints for Google Maps API
      let googleWaypoints: google.maps.DirectionsWaypoint[] = [];
      if (waypointResults.length > 0) {
        googleWaypoints = waypointResults.map(waypoint => ({
          location: waypoint.coordinates 
            ? new google.maps.LatLng(waypoint.coordinates.lat, waypoint.coordinates.lng)
            : waypoint.address,
          stopover: true
        }));
      }

      // Use coordinates if available, otherwise use the cleaned address
      const originForDirections = originResult.coordinates 
        ? new google.maps.LatLng(originResult.coordinates.lat, originResult.coordinates.lng)
        : originResult.address;
        
      const destinationForDirections = destinationResult.coordinates
        ? new google.maps.LatLng(destinationResult.coordinates.lat, destinationResult.coordinates.lng)
        : destinationResult.address;

      return new Promise((resolve, reject) => {
        const directionsRequest: google.maps.DirectionsRequest = {
          origin: originForDirections,
          destination: destinationForDirections,
          waypoints: googleWaypoints.length > 0 ? googleWaypoints : undefined,
          travelMode: request.travelMode,
          avoidHighways: request.avoidHighways || false,
          avoidTolls: request.avoidTolls || false,
          provideRouteAlternatives: googleWaypoints.length === 0, // Only provide alternatives if no waypoints
          unitSystem: google.maps.UnitSystem.IMPERIAL,
          optimizeWaypoints: false, // Keep waypoints in order
          region: 'US' // Bias results to US
        };

        console.log('Sending directions request to Google Maps:', directionsRequest);

        this.directionsService!.route(directionsRequest, (result, status) => {
          console.log('Directions response status:', status);
          
          if (status === google.maps.DirectionsStatus.OK && result) {
            console.log('Directions successful, found', result.routes.length, 'routes');
            
            // Log route details for debugging
            result.routes.forEach((route, index) => {
              const totalDistance = route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
              const totalDuration = route.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
              const distanceText = (totalDistance / 1609.34).toFixed(1) + ' miles';
              const durationText = Math.round(totalDuration / 60) + ' min';
              console.log(`Route ${index + 1}: ${distanceText}, ${durationText}`);
              
              // Log waypoint info if present
              if (route.legs.length > 1) {
                console.log(`  - ${route.legs.length} legs (${route.legs.length - 1} waypoints)`);
              }
            });
            
            resolve({ routes: result.routes, status });
          } else {
            console.error('Directions request failed with status:', status);
            
            // Provide more specific error messages
            let errorMessage = 'Directions request failed';
            
            switch (status) {
              case google.maps.DirectionsStatus.NOT_FOUND:
                errorMessage = `Address not found. Please check:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"`;
                if (request.waypoints && request.waypoints.length > 0) {
                  errorMessage += `\n• Waypoints: ${request.waypoints.join(', ')}`;
                }
                errorMessage += '\n\nTry using more specific addresses with city and state.';
                break;
              case google.maps.DirectionsStatus.ZERO_RESULTS:
                errorMessage = `No route found between the specified locations:\n• From: "${request.origin}"\n• To: "${request.destination}"`;
                if (request.waypoints && request.waypoints.length > 0) {
                  errorMessage += `\n• Via: ${request.waypoints.join(', ')}`;
                }
                errorMessage += '\n\nTry different addresses or check if all locations are accessible by road.';
                break;
              case google.maps.DirectionsStatus.OVER_QUERY_LIMIT:
                errorMessage = 'Too many requests. Please wait a moment and try again.';
                break;
              case google.maps.DirectionsStatus.REQUEST_DENIED:
                errorMessage = 'Directions request denied. Please check your API key configuration and ensure the Directions API is enabled.';
                break;
              case google.maps.DirectionsStatus.INVALID_REQUEST:
                errorMessage = `Invalid request. Please check your addresses:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"`;
                if (request.waypoints && request.waypoints.length > 0) {
                  errorMessage += `\n• Waypoints: ${request.waypoints.join(', ')}`;
                }
                break;
              default:
                errorMessage = `Directions request failed with status: ${status}`;
            }
            
            reject(new Error(errorMessage));
          }
        });
      });
    } catch (error) {
      console.error('Error in getRoutes:', error);
      throw error;
    }
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
}
