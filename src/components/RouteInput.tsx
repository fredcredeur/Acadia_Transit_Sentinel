import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, Star, AlertCircle, MapPin } from 'lucide-react';
import { LocationInput } from './LocationInput';
import { SavedLocationsManager } from './SavedLocationsManager';
import { SavedLocation } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';

interface RouteInputProps {
  onRouteRequest: (origin: string, destination: string) => void;
  isLoading?: boolean;
  initialOrigin?: string;
  initialDestination?: string;
}

export const RouteInput: React.FC<RouteInputProps> = ({ 
  onRouteRequest, 
  isLoading = false,
  initialOrigin = '',
  initialDestination = ''
}) => {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  const [locationInputTarget, setLocationInputTarget] = useState<'origin' | 'destination' | null>(null);
  const [validationErrors, setValidationErrors] = useState<{origin?: string; destination?: string}>({});
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'error'>('checking');

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
        const googleMapsService = GoogleMapsService.getInstance();
        const hasApiKey = googleMapsService.hasApiKey();
        
        if (!hasApiKey) {
          setApiStatus('error');
          return;
        }

        await googleMapsService.initialize();
        setApiStatus('ready');
      } catch (error) {
        setApiStatus('error');
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
    const coordOnlyPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate addresses
    const originError = validateAddress(origin);
    const destinationError = validateAddress(destination);
    
    if (originError || destinationError) {
      setValidationErrors({
        origin: originError || undefined,
        destination: destinationError || undefined
      });
      return;
    }

    if (apiStatus !== 'ready') {
      return;
    }

    // Proceed with route analysis
    if (origin.trim() && destination.trim() && !isLoading) {
      onRouteRequest(origin.trim(), destination.trim());
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

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Planning</h2>
          </div>
          
          <button
            onClick={() => setShowSavedLocations(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
          >
            <Star className="w-4 h-4" />
            Saved Locations
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <LocationInput
              label="Starting Location"
              value={origin}
              onChange={handleOriginChange}
              placeholder="Enter starting address (e.g., 926 Anthony Ave, Opelousas, LA)"
              disabled={isLoading}
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
              disabled={isLoading}
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
                Analyze Routes
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
          </div>
        </div>
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