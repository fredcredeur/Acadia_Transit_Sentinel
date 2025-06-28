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
  private autocompleteService?: google.maps.places.AutocompleteService;
  private placesService?: google.maps.places.PlacesService;
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
      if (typeof window === 'undefined' || !(window as any).google?.maps?.places) {
        throw new Error('Google Maps Places API not available');
      }

      const google = (window as any).google;
      
      this.autocompleteService = new google.maps.places.AutocompleteService();
      
      // Create a dummy div for PlacesService (required by Google Maps API)
      const dummyDiv = document.createElement('div');
      dummyDiv.style.display = 'none';
      document.body.appendChild(dummyDiv);
      
      const dummyMap = new google.maps.Map(dummyDiv, {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 1
      });
      
      this.placesService = new google.maps.places.PlacesService(dummyMap);
      
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
    if (!this.autocompleteService) {
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

    return new Promise((resolve, reject) => {
      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        types: options?.types || ['address'],
        componentRestrictions: options?.componentRestrictions || { country: 'us' }
      };

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
    if (!this.placesService) {
      throw new Error('Places service not initialized');
    }

    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: ['place_id', 'formatted_address', 'geometry', 'name', 'types']
      };

      this.placesService!.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const placeDetails: PlaceDetails = {
            place_id: place.place_id || '',
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
          resolve(placeDetails);
        } else {
          reject(new Error(`Place details request failed: ${status}`));
        }
      });
    });
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.autocompleteService;
  }
}