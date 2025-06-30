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
  private autocomplete?: google.maps.places.Autocomplete;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): PlacesService {
    if (!PlacesService.instance) {
      PlacesService.instance = new PlacesService();
    }
    return PlacesService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if Google Maps is available
      if (typeof window === 'undefined' || !(window as Window & typeof globalThis).google?.maps?.places) {
        throw new Error('Google Maps Places API not available');
      }

      const _google = (window as Window & typeof globalThis).google;
      
      this.isInitialized = true;
      console.log('Places service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Places service:', error);
      throw error;
    }
  }

  public async getPlacePredictions(
    input: string,
    options?: {
      types?: string[];
      componentRestrictions?: google.maps.places.ComponentRestrictions;
    }
  ): Promise<PlacePrediction[]> {
    if (!this.isInitialized) {
      console.warn('Places service not initialized, attempting to initialize...');
      try {
        await this.initialize();
      } catch (error) {
        console.error('Failed to initialize Places service:', error);
        return [];
      }
    }

    if (!input.trim() || input.length < 2) {
      return [];
    }


    return new Promise((resolve, _reject) => {
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions({ input }, (predictions, status) => {
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
          resolve(formattedPredictions);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          console.warn(`Places prediction status: ${status}`);
          resolve([]); // Return empty array instead of rejecting
        }
      });
    });
  }

  public async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    if (!this.isInitialized) {
      throw new Error('Places service not initialized');
    }

    const place = new google.maps.places.Place({ id: placeId });
    await place.fetchFields({ fields: ['id', 'formattedAddress', 'location', 'displayName', 'types'] });

    if (!place.id) {
      throw new Error('Place details request failed');
    }

    return {
      place_id: place.id,
      formatted_address: place.formattedAddress || '',
      geometry: {
        location: {
          lat: place.location?.lat() || 0,
          lng: place.location?.lng() || 0
        }
      },
      name: place.displayName || '',
      types: place.types || []
    };
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}
