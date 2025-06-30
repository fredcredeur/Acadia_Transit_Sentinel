// Updated RouteInput.tsx - Replace your existing RouteInput with this
import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { SmartAddressInput } from './SmartAddressInput';
import { StopLocationsManager } from './StopLocationsManager';
import { SavedLocation, StopLocation } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';

interface RouteInputProps {
  onRouteRequest: (origin: string, destination: string, stops?: StopLocation[], isLoop?: boolean) => void;
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
  const [isLoop, setIsLoop] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{origin?: string; destination?: string; stops?: string}>({});
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [apiError, setApiError] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update local state when initial values change
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
        console.log('🔧 Checking Google Maps API status...');
        const googleMapsService = GoogleMapsService.getInstance();
        const hasApiKey = googleMapsService.hasApiKey();
        
        if (!hasApiKey) {
          setApiStatus('error');
          setApiError('Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
          return;
        }

        console.log('🔧 API key found, testing initialization...');
        await googleMapsService.initialize();
        console.log('✅ Google Maps initialized successfully');
        setApiStatus('ready');
        setApiError('');
      } catch (error) {
        console.error('❌ Google Maps initialization failed:', error);
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
    
    console.log('📝 Form submitted:', { origin, destination, stops: stops.length, apiStatus });
    
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
      console.log('⚠️ API not ready, status:', apiStatus);
      return;
    }

    // Proceed with route analysis
    if (origin.trim() && destination.trim() && !isLoading) {
      console.log('🚀 Starting route analysis...');
      const finalStops = stops.filter(stop => stop.address.trim());
      onRouteRequest(origin.trim(), destination.trim(), finalStops.length > 0 ? finalStops : undefined, isLoop);
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

  const getTotalStopTime = () => {
    return stops.reduce((total, stop) => total + (stop.estimatedStopTime || 0), 0);
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Smart Route Planning</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enhanced address processing with intelligent suggestions
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
            <SmartAddressInput
              label="Starting Location"
              value={origin}
              onChange={handleOriginChange}
              placeholder="Enter starting address or select from suggestions"
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
            <SmartAddressInput
              label="Destination"
              value={destination}
              onChange={handleDestinationChange}
              placeholder="Enter destination address or select from suggestions"
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
                    checked={isLoop}
                    onChange={(e) => setIsLoop(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                    disabled={isLoading || apiStatus !== 'ready'}
                  />
                  <label htmlFor="loopRoute" className="ml-2 text-sm text-gray-900 dark:text-gray-200">
                    Loop route (return to starting location)
                  </label>
                </div>
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
                Analyzing Routes...
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                Analyze Routes {stops.length > 0 && `(${stops.length} stop${stops.length > 1 ? 's' : ''})`}
              </>
            )}
          </button>
        </form>

        {/* Smart Features Info */}
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Smart Address Features:
          </h4>
          <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <div>✅ <strong>Intelligent Suggestions:</strong> Louisiana businesses and landmarks</div>
            <div>✅ <strong>Auto-Enhancement:</strong> Automatically adds state and formatting</div>
            <div>✅ <strong>Address Validation:</strong> Real-time feedback on address quality</div>
            <div>✅ <strong>Coordinate Support:</strong> Direct latitude,longitude input</div>
            <div>✅ <strong>Saved Locations:</strong> Quick access to frequently used addresses</div>
            {stops.length > 0 && (
              <div className="text-purple-700 dark:text-purple-400 font-medium">
                📍 {stops.length} stop{stops.length > 1 ? 's' : ''} configured (+{getTotalStopTime()} min estimated)
              </div>
            )}
            {apiStatus === 'ready' && (
              <div className="text-green-700 dark:text-green-400 font-medium">🟢 Google Maps API connected and ready</div>
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
  );
};