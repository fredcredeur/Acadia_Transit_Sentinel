// Fixed src/services/placesService.ts

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
  private initializationPromise?: Promise<void>;

  private constructor() {}

  public static getInstance(): PlacesService {
    if (!PlacesService.instance) {
      PlacesService.instance = new PlacesService();
    }
    return PlacesService.instance;
  }

  public async initialize(): Promise<void> {
    // ✅ FIXED: Prevent multiple initialization attempts
    if (this.isInitialized) {
      console.log('✅ Places service already initialized');
      return;
    }

    if (this.initializationPromise) {
      console.log('⏳ Places service initialization already in progress...');
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Places service for live search...');

      // ✅ FIXED: Better Google Maps availability check
      if (typeof window === 'undefined') {
        throw new Error('Window object not available (server-side environment)');
      }

      // ✅ FIXED: Wait for Google Maps to be available with timeout
      const maxWaitTime = 10000; // 10 seconds
      const checkInterval = 100; // Check every 100ms
      let elapsed = 0;

      while (elapsed < maxWaitTime) {
        if ((window as any).google?.maps?.places) {
          console.log('✅ Google Maps Places API found');
          break;
        }
        
        console.log(`⏳ Waiting for Google Maps Places API... (${elapsed}ms/${maxWaitTime}ms)`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }

      if (!(window as any).google?.maps?.places) {
        throw new Error(`Google Maps Places API not available after ${maxWaitTime}ms. Ensure the 'places' library is loaded.`);
      }

      // ✅ FIXED: Verify specific Places services are available
      if (!google.maps.places.AutocompleteService) {
        throw new Error('AutocompleteService not available - check Places library loading');
      }

      if (!google.maps.places.PlacesService) {
        throw new Error('PlacesService not available - check Places library loading');
      }

      console.log('🚀 Creating Places services...');

      // Create AutocompleteService
      this.autocompleteService = new google.maps.places.AutocompleteService();
      console.log('✅ AutocompleteService created');
      
      // Create PlacesService with dummy map
      const dummyMap = new google.maps.Map(document.createElement('div'), {
        center: { lat: 30.2241, lng: -92.0198 }, // Lafayette, LA
        zoom: 10
      });
      this.placesService = new google.maps.places.PlacesService(dummyMap);
      console.log('✅ PlacesService created with dummy map');

      // ✅ FIXED: Test the services to ensure they work
      await this.testServices();

      this.isInitialized = true;
      console.log('🎉 Places service initialized successfully and tested');
      
    } catch (error) {
      console.error('❌ Failed to initialize Places service:', error);
      this.isInitialized = false;
      this.initializationPromise = undefined;
      throw error;
    }
  }

  // ✅ NEW: Test method to verify services work
  private async testServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.autocompleteService) {
        reject(new Error('AutocompleteService not initialized'));
        return;
      }

      // Test with a simple query that should work
      const testRequest: google.maps.places.AutocompletionRequest = {
        input: 'lafayette',
        componentRestrictions: { country: 'us' }
      };

      const timeout = setTimeout(() => {
        reject(new Error('Places service test timed out'));
      }, 5000);

      this.autocompleteService.getPlacePredictions(testRequest, (predictions, status) => {
        clearTimeout(timeout);
        
        if (status === google.maps.places.PlacesServiceStatus.OK || 
            status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log('✅ Places service test passed:', status);
          resolve();
        } else {
          console.error('❌ Places service test failed:', status);
          reject(new Error(`Places service test failed with status: ${status}`));
        }
      });
    });
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
    // ✅ FIXED: Better validation and error handling
    if (!this.isInitialized || !this.autocompleteService) {
      console.warn('⚠️ Places service not initialized, attempting to initialize...');
      try {
        await this.initialize();
      } catch (error) {
        console.error('❌ Failed to initialize Places service:', error);
        return [];
      }
    }

    if (!input.trim() || input.length < 2) {
      console.log('📍 Input too short for predictions:', input);
      return [];
    }

    console.log(`🔍 Getting place predictions for: "${input}"`);

    return new Promise((resolve) => {
      if (!this.autocompleteService) {
        console.error('❌ AutocompleteService still not available');
        resolve([]);
        return;
      }

      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        ...options
      };

      // Add Louisiana bias for better local results if no location specified
      if (!request.location && !request.bounds) {
        request.location = new google.maps.LatLng(30.2241, -92.0198); // Lafayette, LA
        request.radius = 100000; // 100km radius
        console.log('📍 Added Louisiana location bias');
      }

      // ✅ FIXED: Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('⏰ Places prediction request timed out');
        resolve([]);
      }, 8000); // 8 second timeout

      this.autocompleteService!.getPlacePredictions(request, (_predictions, status) => {
        clearTimeout(timeout);
        
        console.log(`📡 Places API response: ${status}`);
        
        if (status === google.maps.places.PlacesServiceStatus.OK && _predictions) {
          const formattedPredictions: PlacePrediction[] = _predictions.map(prediction => ({
            place_id: prediction.place_id || '',
            description: prediction.description,
            structured_formatting: {
              main_text: prediction.structured_formatting?.main_text || prediction.description,
              secondary_text: prediction.structured_formatting?.secondary_text || ''
            },
            types: prediction.types || []
          }));

          console.log(`✅ Places API returned ${formattedPredictions.length} predictions for "${input}"`);
          resolve(formattedPredictions);
        } else {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.log(`📍 No places found for "${input}"`);
          } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
            console.warn(`⚠️ Places API quota exceeded for "${input}"`);
          } else if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
            console.error(`❌ Places API request denied for "${input}" - check API key and billing`);
          } else {
            console.warn(`⚠️ Places prediction failed with status: ${status}`);
          }
          resolve([]);
        }
      });
    });
  }

  public async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    if (!this.isInitialized || !this.placesService) {
      await this.initialize();
    }

    if (!this.placesService) {
      throw new Error('PlacesService not initialized');
    }

    console.log(`🔍 Getting place details for: ${placeId}`);

    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: ['place_id', 'formatted_address', 'geometry', 'name', 'types']
      };

      // ✅ FIXED: Add timeout for place details
      const timeout = setTimeout(() => {
        reject(new Error('Place details request timed out'));
      }, 8000);

      this.placesService!.getDetails(request, (place, status) => {
        clearTimeout(timeout);
        
        console.log(`📡 Place details response: ${status}`);
        
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

          console.log(`✅ Got place details for: ${placeDetails.formatted_address}`);
          resolve(placeDetails);
        } else {
          const errorMessage = `Place details request failed: ${status}`;
          console.error(`❌ ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });
    });
  }

  public isReady(): boolean {
    const ready = this.isInitialized && !!this.autocompleteService && !!this.placesService;
    console.log('🔍 Places service ready check:', ready);
    return ready;
  }

  // ✅ FIXED: Enhanced Louisiana search with better error handling
  public async getEnhancedLouisianaPredictions(input: string): Promise<PlacePrediction[]> {
    try {
      const _predictions = await this.getPlacePredictions(input, {
        componentRestrictions: { country: 'us' },
        types: ['geocode', 'establishment']
      });

      // Enhance results by boosting Louisiana addresses
      return _predictions.map(prediction => {
        // const isLouisiana = prediction.description.toLowerCase().includes('la') ||
        //                    prediction.description.toLowerCase().includes('louisiana');
        
        return prediction;
      }).sort((a, b) => {
        // Prioritize Louisiana addresses
        const aIsLA = a.description.toLowerCase().includes(', la');
        const bIsLA = b.description.toLowerCase().includes(', la');
        
        if (aIsLA && !bIsLA) return -1;
        if (!aIsLA && bIsLA) return 1;
        return 0;
      });
    } catch (error) {
      console.error('❌ Enhanced Louisiana predictions failed:', error);
      return [];
    }
  }

  // ✅ NEW: Diagnostic method to help debug issues
  public getDiagnosticInfo(): {
    isInitialized: boolean;
    hasAutocompleteService: boolean;
    hasPlacesService: boolean;
    hasGoogleMaps: boolean;
    hasPlacesLibrary: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      hasAutocompleteService: !!this.autocompleteService,
      hasPlacesService: !!this.placesService,
      hasGoogleMaps: typeof (window as any).google?.maps !== 'undefined',
      hasPlacesLibrary: typeof (window as any).google?.maps?.places !== 'undefined'
    };
  }
}
