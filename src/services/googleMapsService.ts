import { Loader } from '@googlemaps/js-api-loader';

export interface GoogleMapsConfig {
  apiKey: string;
  libraries: string[];
}

export interface RouteRequest {
  origin: string;
  destination: string;
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
    if (this.isLoaded) return;

    try {
      const google = await this.loader.load();
      this.directionsService = new google.maps.DirectionsService();
      this.geocoder = new google.maps.Geocoder();
      this.isLoaded = true;
      
      // Make Google Maps globally available for other services
      (window as any).google = google;
    } catch (error) {
      console.error('Failed to load Google Maps:', error);
      throw error;
    }
  }

  private async validateAndCleanAddress(address: string): Promise<{ address: string; coordinates?: { lat: number; lng: number } }> {
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
      // Validate the address using geocoding with Louisiana bias
      const results = await this.geocodeAddress(cleanAddress);
      
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
      console.warn('Geocoding validation failed:', error);
      // If geocoding fails, try the original address anyway
    }

    return { address: cleanAddress };
  }

  public async getRoutes(request: RouteRequest): Promise<RouteResponse> {
    if (!this.directionsService) {
      throw new Error('Google Maps service not initialized');
    }

    try {
      // Validate and clean both addresses
      const [originResult, destinationResult] = await Promise.all([
        this.validateAndCleanAddress(request.origin),
        this.validateAndCleanAddress(request.destination)
      ]);

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
          travelMode: request.travelMode,
          avoidHighways: request.avoidHighways || false,
          avoidTolls: request.avoidTolls || false,
          provideRouteAlternatives: true,
          unitSystem: google.maps.UnitSystem.IMPERIAL,
          optimizeWaypoints: false,
          region: 'US' // Bias results to US
        };

        this.directionsService!.route(directionsRequest, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve({ routes: result.routes, status });
          } else {
            // Provide more specific error messages
            let errorMessage = 'Directions request failed';
            
            switch (status) {
              case google.maps.DirectionsStatus.NOT_FOUND:
                errorMessage = `Address not found. Please check:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"\n\nTry using more specific addresses with city and state.`;
                break;
              case google.maps.DirectionsStatus.ZERO_RESULTS:
                errorMessage = `No route found between the specified locations:\n• From: "${request.origin}"\n• To: "${request.destination}"\n\nTry different addresses or check if the locations are accessible by road.`;
                break;
              case google.maps.DirectionsStatus.OVER_QUERY_LIMIT:
                errorMessage = 'Too many requests. Please wait a moment and try again.';
                break;
              case google.maps.DirectionsStatus.REQUEST_DENIED:
                errorMessage = 'Directions request denied. Please check your API key configuration.';
                break;
              case google.maps.DirectionsStatus.INVALID_REQUEST:
                errorMessage = `Invalid request. Please check your addresses:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"`;
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

  public async geocodeAddress(address: string): Promise<google.maps.GeocoderResult[]> {
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }
    
    return new Promise((resolve, reject) => {
      // Enhanced geocoding request with Louisiana bias
      const geocodeRequest: google.maps.GeocoderRequest = {
        address: address,
        region: 'US',
        componentRestrictions: {
          country: 'US'
        },
        // Add bounds bias for Louisiana area
        bounds: new google.maps.LatLngBounds(
          new google.maps.LatLng(28.8, -94.0), // Southwest Louisiana
          new google.maps.LatLng(33.0, -88.8)  // Northeast Louisiana
        )
      };
      
      this.geocoder!.geocode(geocodeRequest, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) {
          resolve(results);
        } else {
          let errorMessage = 'Geocoding failed';
          switch (status) {
            case google.maps.GeocoderStatus.ZERO_RESULTS:
              errorMessage = `No results found for address: "${address}". Please try a more specific address.`;
              break;
            case google.maps.GeocoderStatus.OVER_QUERY_LIMIT:
              errorMessage = 'Too many geocoding requests. Please wait and try again.';
              break;
            case google.maps.GeocoderStatus.REQUEST_DENIED:
              errorMessage = 'Geocoding request denied. Please check API configuration.';
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
}