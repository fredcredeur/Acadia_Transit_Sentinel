import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, Star, AlertCircle, MapPin, CheckCircle } from 'lucide-react';
import { LocationInput } from './LocationInput';
import { SavedLocationsManager } from './SavedLocationsManager';
import { StopLocationsManager } from './StopLocationsManager';
import { SavedLocation, StopLocation } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';

interface RouteInputProps {
  onRouteRequest: (origin: string, destination: string, stops?: StopLocation[]) => void;
  isLoading?: boolean;
  initialOrigin?: string;
  initialDestination?: string;
  stops: StopLocation[];
  onStopsChange: (stops: StopLocation[]) => void;
}

export const RouteInput: React.FC<RouteInputProps> = ({
  onRouteRequest,
  isLoading = false,
  initialOrigin = '',
  initialDestination = '',
  stops,
  onStopsChange,
}) => {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [isLoop, setIsLoop] = useState(false); // New state for loop route
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  const [locationInputTarget, setLocationInputTarget] = useState<'origin' | 'destination' | null>(null);
  const [validationErrors, setValidationErrors] = useState<{origin?: string; destination?: string; stops?: string}>({});
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [apiError, setApiError] = useState<string>('');

  // Update local state when initial values change (from parent)
  useEffect(() => {
    if (initialOrigin && initialOrigin !== origin) {
      setOrigin(initialOrigin);
    }
  }, [initialOrigin]);

  useEffect(() => {
    if (initialDestination && initialDestination !== destination) {
      setDestination(initialDestination);
    }
  }, [initialDestination]);

  // Check API status on mount
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        console.log('Checking Google Maps API status...');
        const googleMapsService = GoogleMapsService.getInstance();
        const hasApiKey = googleMapsService.hasApiKey();
        
        if (!hasApiKey) {
          setApiStatus('error');
          setApiError('Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
          return;
        }

        console.log('API key found, initializing Google Maps...');
        await googleMapsService.initialize();
        console.log('Google Maps initialized successfully');
        setApiStatus('ready');
        setApiError('');
      } catch (error) {
        console.error('Google Maps initialization failed:', error);
        setApiStatus('error');
        setApiError(error instanceof Error ? error.message : 'Failed to initialize Google Maps');
      }
    };

    checkApiStatus();
  }, []);

  const validateAddress = (address: string): string | null => {
    if (!address.trim()) {
      return 'Address is required';
    }
    
    if (address.trim().length < 3) {
      return 'Address is too short';
    }

    // Check if it's just coordinates without context
    const coordOnlyPattern = /^[-+]?\d*\.?\d*,\s*[-+]?\d*\.?\d*$/;
    if (coordOnlyPattern.test(address.trim())) {
      return null; // Coordinates are valid
    }

    // Check if it has some basic address components
    const hasLetters = /[a-zA-Z]/.test(address);
    
    if (!hasLetters) {
      return 'Please enter a valid address with street name';
    }

    return null;
  };

  const validateStops = (): string | null => {
    if (stops.length === 0) return null;

    const emptyStops = stops.filter(stop => !stop.address.trim());
    if (emptyStops.length > 0) {
      return `${emptyStops.length} stop location${emptyStops.length > 1 ? 's' : ''} missing address`;
    }

    const invalidStops = stops.filter(stop => validateAddress(stop.address) !== null);
    if (invalidStops.length > 0) {
      return `${invalidStops.length} stop location${invalidStops.length > 1 ? 's have' : ' has'} invalid address`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted with:', { origin, destination, stops: stops.length, apiStatus });
    console.log('Valid stops being passed:', stops.filter(stop => stop.address.trim()));
    
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate addresses
    const originError = validateAddress(origin);
    const destinationError = validateAddress(destination);
    const stopsError = validateStops();
    
    if (originError || destinationError || stopsError) {
      setValidationErrors({
        origin: originError || undefined,
        destination: destinationError || undefined,
        stops: stopsError || undefined
      });
      return;
    }

    if (apiStatus !== 'ready') {
      console.log('API not ready, status:', apiStatus);
      return;
    }

    // Proceed with route analysis
    if (origin.trim() && destination.trim() && !isLoading) {
      console.log('Calling route analysis with stops...');
      let finalStops = stops.filter(stop => stop.address.trim());

      if (isLoop) {
        // Add origin as the last stop for a loop route
        finalStops = [...finalStops, { id: 'loop-return', address: origin.trim(), order: finalStops.length }];
        console.log('Loop route enabled. Added origin as final stop:', origin.trim());
      }

      onRouteRequest(origin.trim(), destination.trim(), finalStops.length > 0 ? finalStops : undefined);
    }
  };

  const handleLocationSelect = (location: SavedLocation) => {
    if (locationInputTarget === 'origin') {
      setOrigin(location.address);
      setValidationErrors(prev => ({ ...prev, origin: undefined }));
    } else if (locationInputTarget === 'destination') {
      setDestination(location.address);
      setValidationErrors(prev => ({ ...prev, destination: undefined }));
    }
    setLocationInputTarget(null);
  };

  const handleOriginChange = (value: string) => {
    setOrigin(value);
    if (validationErrors.origin) {
      setValidationErrors(prev => ({ ...prev, origin: undefined }));
    }
  };

  const handleDestinationChange = (value: string) => {
    setDestination(value);
    if (validationErrors.destination) {
      setValidationErrors(prev => ({ ...prev, destination: undefined }));
    }
  };

  const handleStopsChange = (newStops: StopLocation[]) => {
    onStopsChange(newStops);
    if (validationErrors.stops) {
      setValidationErrors(prev => ({ ...prev, stops: undefined }));
    }
  };

  const getTotalEstimatedTime = () => {
    return stops.reduce((total, stop) => total + (stop.estimatedStopTime || 0), 0);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Planning</h2>
            </div>
            
            <div className="flex items-center gap-3">
              {/* API Status Indicator */}
              <div className="flex items-center gap-2">
                {apiStatus === 'checking' && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
                    <span className="text-sm">Checking API...</span>
                  </div>
                )}
                {apiStatus === 'ready' && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Ready</span>
                  </div>
                )}
                {apiStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">API Error</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowSavedLocations(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              >
                <Star className="w-4 h-4" />
                Saved Locations
              </button>
            </div>
          </div>

          {/* API Error Display */}
          {apiStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Google Maps API Error</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <LocationInput
                label="Starting Location"
                value={origin}
                onChange={handleOriginChange}
                placeholder="Enter starting address (e.g., 926 Anthony Ave, Opelousas, LA)"
                disabled={isLoading || apiStatus !== 'ready'}
                onLocationSelect={(location) => {
                  setOrigin(location.address);
                  setValidationErrors(prev => ({ ...prev, origin: undefined }));
                }}
              />
              {validationErrors.origin && (
                <div className="mt-1 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.origin}
                </div>
              )}
            </div>

            <div>
              <LocationInput
                label="Destination"
                value={destination}
                onChange={handleDestinationChange}
                placeholder="Enter destination address (e.g., 429 Cherry St, Lafayette, LA)"
                disabled={isLoading || apiStatus !== 'ready'}
                onLocationSelect={(location) => {
                  setDestination(location.address);
                  setValidationErrors(prev => ({ ...prev, destination: undefined }));
                }}
              />
              {validationErrors.destination && (
                <div className="mt-1 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.destination}
                </div>
              )}
            </div>

            {/* Loop Route Checkbox */}
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                id="loopRoute"
                checked={isLoop}
                onChange={(e) => setIsLoop(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-600"
                disabled={isLoading || apiStatus !== 'ready'}
              />
              <label htmlFor="loopRoute" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                Loop route (return to start)
              </label>
            </div>

            {/* Stops Error Display */}
            {validationErrors.stops && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.stops}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!origin.trim() || !destination.trim() || isLoading || Object.keys(validationErrors).length > 0 || apiStatus !== 'ready'}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Routes...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  Analyze Routes {stops.length > 0 && `(${stops.length} stop${stops.length > 1 ? 's' : ''})`}
                </>
              )}
            </button>
          </form>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors duration-300">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Address Tips:
            </h4>
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <div>• Use complete addresses with street number, name, city, and state</div>
              <div>• Example: "926 Anthony Ave, Opelousas, LA" or "429 Cherry St, Lafayette, LA"</div>
              <div>• Business names work too: "Walmart, Lafayette, LA"</div>
              <div>• Click the crosshair icon to use your current location</div>
              {stops.length > 0 && (
                <div className="text-purple-700 dark:text-purple-400 font-medium">
                  • {stops.length} stop{stops.length > 1 ? 's' : ''} added (+{getTotalEstimatedTime()} min estimated)
                </div>
              )}
              {apiStatus === 'ready' && (
                <div className="text-green-700 dark:text-green-400 font-medium">✓ Google Maps API connected and ready</div>
              )}
            </div>
          </div>
        </div>

        {/* Stop Locations Manager */}
        <StopLocationsManager
          stops={stops}
          onStopsChange={handleStopsChange}
          disabled={isLoading || apiStatus !== 'ready'}
        />
      </div>

      <SavedLocationsManager
        isOpen={showSavedLocations}
        onClose={() => {
          setShowSavedLocations(false);
          setLocationInputTarget(null);
        }}
        onLocationSelect={handleLocationSelect}
      />
    </>
  );
};
