import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { LocationInput } from './LocationInput';
import { StopLocationsManager } from './StopLocationsManager';
import { StopLocation } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';

interface RouteInputProps {
  onRouteRequest: (origin: string, destination: string, stops?: StopLocation[], isLoop?: boolean) => void;
  isLoading?: boolean;
  initialOrigin?: string;
  initialDestination?: string;
  stops: StopLocation[];
  onStopsChange: (stops: StopLocation[]) => void;
  isLoop?: boolean;
  onLoopChange?: (isLoop: boolean) => void;
}

export const RouteInput: React.FC<RouteInputProps> = ({
  onRouteRequest,
  isLoading = false,
  initialOrigin = '',
  initialDestination = '',
  stops = [], // Provide default empty array
  onStopsChange,
  isLoop = false,
  onLoopChange
}) => {
  // Keep local state persistent and sync with props properly
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [localIsLoop, setLocalIsLoop] = useState(isLoop);
  const [validationErrors, setValidationErrors] = useState<{origin?: string; destination?: string; stops?: string}>({});
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [apiError, setApiError] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Only update local state when props change AND we're not currently loading
  useEffect(() => {
    if (!isLoading) {
      if (initialOrigin && initialOrigin !== origin) {
        setOrigin(initialOrigin);
      }
      if (initialDestination && initialDestination !== destination) {
        setDestination(initialDestination);
      }
    }
  }, [initialOrigin, initialDestination, isLoading]);

  // Sync isLoop with props
  useEffect(() => {
    if (isLoop !== localIsLoop) {
      setLocalIsLoop(isLoop);
    }
  }, [isLoop]);

  // Check API status on mount
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const googleMapsService = GoogleMapsService.getInstance();
        const hasApiKey = googleMapsService.hasApiKey();
        
        if (!hasApiKey) {
          setApiStatus('error');
          setApiError('Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
          return;
        }

        await googleMapsService.initialize();
        setApiStatus('ready');
        setApiError('');
      } catch (error) {
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

    // Check if it's coordinates (always valid)
    const coordPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
    if (coordPattern.test(address.trim())) {
      return null;
    }

    // Check for basic address components
    const hasLettersOrNumbers = /[a-zA-Z0-9]/.test(address);
    if (!hasLettersOrNumbers) {
      return 'Please enter a valid address';
    }

    return null;
  };

  const validateStops = (): string | null => {
    if (stops.length === 0) return null;

    const invalidStops = stops.filter(stop => stop.address.trim() && validateAddress(stop.address) !== null);
    if (invalidStops.length > 0) {
      return `${invalidStops.length} stop location${invalidStops.length > 1 ? 's have' : ' has'} invalid address`;
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
      return;
    }

    // Proceed with route planning
    if (origin.trim() && destination.trim() && !isLoading) {
      let finalStops = stops.filter(stop => stop.address.trim());
      onRouteRequest(origin.trim(), destination.trim(), finalStops.length > 0 ? finalStops : undefined, localIsLoop);
    }
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

  const handleLoopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIsLoop = e.target.checked;
    setLocalIsLoop(newIsLoop);
    if (onLoopChange) {
      onLoopChange(newIsLoop);
    }
  };

  const getTotalStopTime = () => {
    let totalTime = stops.reduce((total, stop) => total + (stop.estimatedStopTime || 0), 0);
    
    // Add loop return time if loop is enabled
    if (localIsLoop) {
      totalTime += 5; // 5 minutes for loop return
    }
    
    return totalTime;
  };

  const getApiStatusColor = () => {
    switch (apiStatus) {
      case 'ready': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-amber-600 dark:text-amber-400';
    }
  };

  const getApiStatusIcon = () => {
    switch (apiStatus) {
      case 'ready': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Planning</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter origin and destination for route analysis
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* API Status Indicator */}
            <div className={`flex items-center gap-2 ${getApiStatusColor()}`}>
              {getApiStatusIcon()}
              <span className="text-sm font-medium">
                {apiStatus === 'checking' && 'Checking...'}
                {apiStatus === 'ready' && 'Ready'}
                {apiStatus === 'error' && 'Error'}
              </span>
            </div>
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
          {/* Origin Input */}
          <div>
            <LocationInput
              label="Starting Location"
              value={origin}
              onChange={handleOriginChange}
              placeholder="Enter starting address"
              disabled={isLoading || apiStatus !== 'ready'}
            />
            {validationErrors.origin && (
              <div className="mt-1 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validationErrors.origin}
              </div>
            )}
          </div>

          {/* Destination Input */}
          <div>
            <LocationInput
              label="Destination"
              value={destination}
              onChange={handleDestinationChange}
              placeholder="Enter destination address"
              disabled={isLoading || apiStatus !== 'ready'}
            />
            {validationErrors.destination && (
              <div className="mt-1 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validationErrors.destination}
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <span>Advanced Options</span>
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                {/* Loop Route Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="loopRoute"
                    checked={localIsLoop}
                    onChange={handleLoopChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                    disabled={isLoading || apiStatus !== 'ready'}
                  />
                  <label htmlFor="loopRoute" className="ml-2 text-sm text-gray-900 dark:text-gray-200">
                    Loop route (return to starting location)
                  </label>
                </div>
                
                {/* Loop Route Info */}
                {localIsLoop && (
                  <div className="ml-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <div className="font-medium mb-1">🔄 Loop Route Enabled</div>
                      <div className="text-xs">
                        • Route will return to starting location
                        • Adds ~5 minutes for final return
                        • Useful for delivery routes or round trips
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!origin.trim() || !destination.trim() || isLoading || Object.keys(validationErrors).length > 0 || apiStatus !== 'ready'}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading Map...
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                Show on Map
                {(stops.length > 0 || localIsLoop) && (
                  <span className="ml-1">
                    ({stops.length} stop{stops.length !== 1 ? 's' : ''}{localIsLoop ? ' + loop' : ''})
                  </span>
                )}
              </>
            )}
          </button>
        </form>

        {/* Route Summary */}
        {(stops.length > 0 || localIsLoop) && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium mb-1">Route Summary:</div>
              <div className="space-y-1 text-xs">
                {stops.length > 0 && (
                  <div>• {stops.length} intermediate stop{stops.length !== 1 ? 's' : ''}</div>
                )}
                {localIsLoop && (
                  <div>• Loop route: returns to starting location</div>
                )}
                <div>• Total estimated stop time: <strong>{getTotalStopTime()} minutes</strong></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stop Locations Manager */}
      <StopLocationsManager
        stops={stops}
        onStopsChange={handleStopsChange}
        disabled={isLoading || apiStatus !== 'ready'}
      />
    </div>
  );
};