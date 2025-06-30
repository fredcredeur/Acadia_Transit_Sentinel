// Enhanced placesService.ts -

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

export interface PlaceDetails {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name: string;
  types: string[];
}

export class PlacesService {
  private static instance: PlacesService;
  private isInitialized = false;
  private autocompleteService?: google.maps.places.AutocompleteService;
  private placesService?: google.maps.places.PlacesService;

  private constructor() {}

  public static getInstance(): PlacesService {
    if (!PlacesService.instance) {
      PlacesService.instance = new PlacesService();
    }
    return PlacesService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Wait for Google Maps to be available
      if (typeof window === 'undefined' || !(window as any).google?.maps?.places) {
        throw new Error('Google Maps Places API not available');
      }

      console.log('🔧 Initializing Places service for live search...');

      // Create services
      this.autocompleteService = new google.maps.places.AutocompleteService();
      
      // Create a dummy map for PlacesService (required by Google)
      const dummyMap = new google.maps.Map(document.createElement('div'));
      this.placesService = new google.maps.places.PlacesService(dummyMap);

      this.isInitialized = true;
      console.log('✅ Places service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Places service:', error);
      throw error;
    }
  }

  public async getPlacePredictions(
    input: string,
    options?: {
      types?: string[];
      componentRestrictions?: google.maps.places.ComponentRestrictions;
      bounds?: google.maps.LatLngBounds;
      radius?: number;
      location?: google.maps.LatLng;
    }
  ): Promise<PlacePrediction[]> {
    if (!this.isInitialized || !this.autocompleteService) {
      console.warn('Places service not initialized');
      return [];
    }

    if (!input.trim() || input.length < 2) {
      return [];
    }

    return new Promise((resolve) => {
      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        ...options
      };

      // Add Louisiana bias for better local results
      if (!request.location && !request.bounds) {
        request.location = new google.maps.LatLng(30.2241, -92.0198); // Lafayette, LA
        request.radius = 100000; // 100km radius
      }

      this.autocompleteService!.getPlacePredictions(request, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          const formattedPredictions: PlacePrediction[] = predictions.map(prediction => ({
            place_id: prediction.place_id || '',
            description: prediction.description,
            structured_formatting: {
              main_text: prediction.structured_formatting?.main_text || prediction.description,
              secondary_text: prediction.structured_formatting?.secondary_text || ''
            },
            types: prediction.types || []
          }));

          console.log(`📍 Places API returned ${formattedPredictions.length} predictions for "${input}"`);
          resolve(formattedPredictions);
        } else {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.log(`📍 No places found for "${input}"`);
          } else {
            console.warn(`📍 Places prediction failed with status: ${status}`);
          }
          resolve([]);
        }
      });
    });
  }

  public async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    if (!this.isInitialized || !this.placesService) {
      throw new Error('Places service not initialized');
    }

    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: ['place_id', 'formatted_address', 'geometry', 'name', 'types']
      };

      this.placesService!.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const placeDetails: PlaceDetails = {
            place_id: place.place_id || placeId,
            formatted_address: place.formatted_address || '',
            geometry: {
              location: {
                lat: place.geometry?.location?.lat() || 0,
                lng: place.geometry?.location?.lng() || 0
              }
            },
            name: place.name || '',
            types: place.types || []
          };

          console.log(`📍 Got place details for: ${placeDetails.formatted_address}`);
          resolve(placeDetails);
        } else {
          console.error(`❌ Place details request failed: ${status}`);
          reject(new Error(`Place details request failed: ${status}`));
        }
      });
    });
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.autocompleteService && !!this.placesService;
  }

  // Utility method to enhance search with Louisiana-specific tweaks
  public async getEnhancedLouisianaPredictions(input: string): Promise<PlacePrediction[]> {
    const predictions = await this.getPlacePredictions(input, {
      componentRestrictions: { country: 'us' },
      types: ['geocode', 'establishment']
    });

    // Enhance results by boosting Louisiana addresses
    return predictions.map(prediction => {
      const isLouisiana = prediction.description.toLowerCase().includes('la') ||
                         prediction.description.toLowerCase().includes('louisiana');
      
      // You could add custom scoring here if needed
      return prediction;
    }).sort((a, b) => {
      // Prioritize Louisiana addresses
      const aIsLA = a.description.toLowerCase().includes(', la');
      const bIsLA = b.description.toLowerCase().includes(', la');
      
      if (aIsLA && !bIsLA) return -1;
      if (!aIsLA && bIsLA) return 1;
      return 0;
    });
  }
}