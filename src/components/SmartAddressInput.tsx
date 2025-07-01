// Fixed SmartAddressInput.tsx - Resolves state synchronization issue

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Star, Crosshair, Search, Loader2, Clock, Navigation, AlertCircle } from 'lucide-react';
import { SavedLocation } from '../types';
import { useSavedLocations } from '../hooks/useSavedLocations';
import { useGeolocation } from '../hooks/useGeolocation';
import { PlacesService } from '../services/placesService';

interface SmartAddressInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  onLocationSelect?: (location: SavedLocation) => void;
  inputId?: string;
}

interface AddressSuggestion {
  id: string;
  address: string;
  type: 'google' | 'saved' | 'recent' | 'current_location';
  confidence: number;
  details?: {
    placeId?: string;
    mainText?: string;
    secondaryText?: string;
    types?: string[];
  };
}

export const SmartAddressInput: React.FC<SmartAddressInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  onLocationSelect,
  inputId = Math.random().toString(36)
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'none' | 'valid' | 'warning' | 'error'>('none');
  const [validationMessage, setValidationMessage] = useState('');
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string>('');
  
  // 🔧 FIX: Separate internal input state from prop value
  const [internalValue, setInternalValue] = useState(value);
  const [isSelectingFromSuggestion, setIsSelectingFromSuggestion] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number>();
  const placesServiceRef = useRef<PlacesService | null>(null);
  const currentSearchRef = useRef<string>('');
  const initializationAttempts = useRef<number>(0);
  
  const { savedLocations, markAsUsed } = useSavedLocations();
  const { coordinates, getCurrentLocation, isLoading: isGettingLocation } = useGeolocation();

  // Debug logging
  const debugLog = (message: string, data?: any) => {
    console.log(`🗺️ [${inputId.substring(0, 8)}] ${label}: ${message}`, data || '');
  };

  // 🔧 FIX: Sync internal value with prop value, but only when not selecting from suggestions
  useEffect(() => {
    if (!isSelectingFromSuggestion && value !== internalValue) {
      debugLog(`Syncing prop value to internal: "${value}"`);
      setInternalValue(value);
    }
  }, [value, isSelectingFromSuggestion, internalValue]);

  // 🔧 FIX: Reset selection flag after a brief delay
  useEffect(() => {
    if (isSelectingFromSuggestion) {
      const resetTimer = setTimeout(() => {
        setIsSelectingFromSuggestion(false);
        debugLog('Reset suggestion selection flag');
      }, 100);
      return () => clearTimeout(resetTimer);
    }
  }, [isSelectingFromSuggestion]);

  // Enhanced Places service initialization with retries
  useEffect(() => {
    const initializePlaces = async () => {
      const maxAttempts = 3;
      const attemptDelay = 1000;
      
      while (initializationAttempts.current < maxAttempts) {
        try {
          initializationAttempts.current++;
          debugLog(`Initializing Google Places (attempt ${initializationAttempts.current}/${maxAttempts})...`);
          
          const placesService = PlacesService.getInstance();
          await placesService.initialize();
          
          const diagnostics = placesService.getDiagnosticInfo();
          debugLog('Places service diagnostics:', diagnostics);
          
          if (!diagnostics.hasPlacesLibrary) {
            throw new Error('Places library not available - check Google Maps initialization');
          }
          
          if (!placesService.isReady()) {
            throw new Error('Places service not ready after initialization');
          }
          
          placesServiceRef.current = placesService;
          setPlacesReady(true);
          setPlacesError('');
          debugLog('✅ Google Places ready for live autocomplete');
          break;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          debugLog(`❌ Google Places attempt ${initializationAttempts.current} failed:`, errorMessage);
          setPlacesError(errorMessage);
          
          if (initializationAttempts.current < maxAttempts) {
            debugLog(`⏳ Retrying in ${attemptDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, attemptDelay));
          } else {
            debugLog('❌ All Places initialization attempts failed');
            setPlacesReady(false);
            setPlacesError(`Failed to initialize Places service after ${maxAttempts} attempts: ${errorMessage}`);
          }
        }
      }
    };

    initializePlaces();
  }, [inputId]);

  // Handle current location
  useEffect(() => {
    if (coordinates) {
      const coordString = `${coordinates.lat},${coordinates.lng}`;
      setIsSelectingFromSuggestion(true);
      setInternalValue(coordString);
      onChange(coordString);
      debugLog('Set current location:', coordString);
    }
  }, [coordinates, onChange]);

  // Enhanced Google Places search with better error handling
  const performGooglePlacesSearch = useCallback(async (searchQuery: string): Promise<AddressSuggestion[]> => {
    if (!placesServiceRef.current || !placesReady || searchQuery.length < 2) {
      return [];
    }

    // Prevent duplicate API calls
    if (currentSearchRef.current === searchQuery) {
      return [];
    }

    try {
      setIsLoadingSuggestions(true);
      currentSearchRef.current = searchQuery;
      debugLog(`🔍 Google Places search: "${searchQuery}"`);
      
      const predictions = await placesServiceRef.current.getPlacePredictions(searchQuery, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'us' },
        location: new google.maps.LatLng(30.2241, -92.0198),
        radius: 50000
      });

      debugLog(`📍 Google returned ${predictions.length} suggestions`);

      const googleSuggestions = predictions.map((prediction, index) => ({
        id: `google-${inputId}-${index}`,
        address: prediction.description,
        type: 'google' as const,
        confidence: 1.0,
        details: {
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text,
          types: prediction.types
        }
      }));

      return googleSuggestions;

    } catch (error) {
      debugLog('❌ Google Places search failed:', error);
      
      if (error instanceof Error && error.message.includes('not initialized')) {
        debugLog('🔄 Attempting to reinitialize Places service...');
        try {
          await placesServiceRef.current?.initialize();
          setPlacesReady(true);
          setPlacesError('');
        } catch (reinitError) {
          debugLog('❌ Reinitialization failed:', reinitError);
          setPlacesError('Places service connection lost');
        }
      }
      
      return [];
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [placesReady, inputId]);

  // Enhanced suggestion generation with fallback strategies
  const generateSuggestions = useCallback(async (input: string) => {
    if (input.length < 1) {
      setSuggestions([]);
      debugLog('Clearing suggestions - no input');
      return;
    }

    debugLog(`Generating suggestions for: "${input}"`);
    const allSuggestions: AddressSuggestion[] = [];

    // Strategy 1: Google Places (if available)
    if (placesReady && input.length >= 2) {
      try {
        const googleSuggestions = await performGooglePlacesSearch(input);
        allSuggestions.push(...googleSuggestions);
        debugLog(`Added ${googleSuggestions.length} Google suggestions`);
      } catch (error) {
        debugLog('Google Places search failed:', error);
      }
    }

    // Strategy 2: Current location (if relevant)
    if (coordinates && input.toLowerCase().includes('current')) {
      allSuggestions.push({
        id: `current-${inputId}`,
        address: `Current Location (${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)})`,
        type: 'current_location',
        confidence: 0.9
      });
    }

    // Strategy 3: Saved locations (always available as fallback)
    const inputLower = input.toLowerCase();
    const savedSuggestions = savedLocations
      .filter(loc => 
        loc.address.toLowerCase().includes(inputLower) ||
        loc.name.toLowerCase().includes(inputLower)
      )
      .slice(0, allSuggestions.length < 3 ? 3 : 2)
      .map((loc, index) => ({
        id: `saved-${inputId}-${index}`,
        address: loc.address,
        type: 'saved' as const,
        confidence: 0.7
      }));
    
    allSuggestions.push(...savedSuggestions);
    debugLog(`Added ${savedSuggestions.length} saved suggestions`);

    // Sort by priority: Google first, then by confidence
    allSuggestions.sort((a, b) => {
      if (a.type === 'google' && b.type !== 'google') return -1;
      if (a.type !== 'google' && b.type === 'google') return 1;
      return b.confidence - a.confidence;
    });

    const finalSuggestions = allSuggestions.slice(0, 6);
    setSuggestions(finalSuggestions);
    debugLog(`Final suggestions: ${finalSuggestions.length} (${finalSuggestions.filter(s => s.type === 'google').length} from Google)`);
  }, [performGooglePlacesSearch, savedLocations, coordinates, inputId, placesReady]);

  // Enhanced debounced search - use internalValue instead of value
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!showSuggestions) {
      return;
    }

    const debounceDelay = placesReady ? 200 : 500;

    debounceTimeoutRef.current = setTimeout(() => {
      generateSuggestions(internalValue); // 🔧 FIX: Use internalValue
    }, debounceDelay);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [internalValue, showSuggestions, generateSuggestions, placesReady]); // 🔧 FIX: Depend on internalValue

  // Validate address - use internalValue
  useEffect(() => {
    validateAddress(internalValue); // 🔧 FIX: Use internalValue
  }, [internalValue]);

  const validateAddress = (address: string) => {
    if (address.length < 2) {
      setValidationStatus('none');
      setValidationMessage('');
      return;
    }

    // Coordinates are always valid
    if (/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(address)) {
      setValidationStatus('valid');
      setValidationMessage('Coordinates detected');
      return;
    }

    // Enhanced address validation
    const hasNumbers = /\d/.test(address);
    const hasStreetTypes = /\b(st|street|ave|avenue|blvd|rd|road|dr|drive|ln|way|ct)\b/i.test(address);
    const hasCities = /\b(lafayette|opelousas|eunice|crowley|rayne|scott|carencro|broussard)\b/i.test(address);
    const hasState = /\b(la|louisiana)\b/i.test(address);
    const hasBusinesses = /\b(walmart|university|hospital|mall|airport|center|hotel|school)\b/i.test(address);

    if ((hasNumbers && hasStreetTypes) || hasBusinesses) {
      if (hasCities && hasState) {
        setValidationStatus('valid');
        setValidationMessage('Complete address');
      } else if (placesReady) {
        setValidationStatus('warning');
        setValidationMessage('Select a suggestion for better accuracy');
      } else {
        setValidationStatus('warning');
        setValidationMessage('Live search unavailable - add city and state');
      }
    } else {
      setValidationStatus('none');
      setValidationMessage(placesReady ? 'Continue typing for live suggestions' : 'Continue typing');
    }
  };

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    debugLog(`📍 Selected: ${suggestion.address} (${suggestion.type})`);
    
    let finalAddress = suggestion.address;

    // For Google Places suggestions, get detailed address
    if (suggestion.type === 'google' && suggestion.details?.placeId && placesServiceRef.current) {
      try {
        debugLog('Getting detailed place info...');
        const placeDetails = await placesServiceRef.current.getPlaceDetails(suggestion.details.placeId);
        finalAddress = placeDetails.formatted_address;
        debugLog(`✅ Enhanced address: ${finalAddress}`);
      } catch (error) {
        debugLog('Failed to get place details, using description');
      }
    }

    // 🔧 FIX: Set the selection flag BEFORE updating values
    setIsSelectingFromSuggestion(true);
    setInternalValue(finalAddress);
    onChange(finalAddress);
    setShowSuggestions(false);
    currentSearchRef.current = '';
    
    // Mark saved location as used
    if (suggestion.type === 'saved') {
      const savedLocation = savedLocations.find(loc => loc.address === suggestion.address);
      if (savedLocation) {
        markAsUsed(savedLocation.id);
        onLocationSelect?.(savedLocation);
      }
    }

    debugLog(`🔧 Suggestion selected, final address: "${finalAddress}"`);
  };

  const handleFocus = () => {
    debugLog('Input focused');
    setShowSuggestions(true);
    
    if (internalValue.length >= 1) { // 🔧 FIX: Use internalValue
      generateSuggestions(internalValue);
    }
  };

  const handleBlur = () => {
    debugLog('Input blurred');
    setTimeout(() => setShowSuggestions(false), 300);
  };

  // 🔧 FIX: Handle input changes properly
  const handleInputChange = (newValue: string) => {
    debugLog(`Input changed: "${newValue}"`);
    
    // Only update if we're not in the middle of selecting a suggestion
    if (!isSelectingFromSuggestion) {
      setInternalValue(newValue);
      onChange(newValue);
      currentSearchRef.current = '';
      
      if (newValue.length >= 1 && !showSuggestions) {
        setShowSuggestions(true);
      }
    }
  };

  const getSuggestionIcon = (suggestion: AddressSuggestion) => {
    switch (suggestion.type) {
      case 'google': 
        if (suggestion.details?.types?.includes('establishment')) {
          return <Navigation className="w-3 h-3 text-blue-600" />;
        }
        return <MapPin className="w-3 h-3 text-blue-600" />;
      case 'saved': 
        return <Star className="w-3 h-3 text-yellow-500 fill-current" />;
      case 'recent': 
        return <Clock className="w-3 h-3 text-gray-500" />;
      case 'current_location': 
        return <Crosshair className="w-3 h-3 text-green-600" />;
      default: 
        return <MapPin className="w-3 h-3 text-gray-400" />;
    }
  };

  const getSuggestionLabel = (suggestion: AddressSuggestion) => {
    switch (suggestion.type) {
      case 'google': return 'Google Maps';
      case 'saved': return 'Saved';
      case 'recent': return 'Recent';
      case 'current_location': return 'Current';
      default: return '';
    }
  };

  const getValidationIcon = () => {
    switch (validationStatus) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getValidationColor = () => {
    switch (validationStatus) {
      case 'valid': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {/* Status indicators */}
        {placesReady && (
          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">
            • Live
          </span>
        )}
        {placesError && (
          <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-medium">
            • Offline
          </span>
        )}
      </label>
      
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        <input
          ref={inputRef}
          type="text"
          value={internalValue} {/* 🔧 FIX: Use internalValue for display */}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-full pl-10 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
          placeholder={placeholder}
          autoComplete="off"
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {/* Loading indicator */}
          {isLoadingSuggestions && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          
          {/* Validation Icon */}
          {!isLoadingSuggestions && getValidationIcon()}
          
          {/* Current Location Button */}
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={disabled || isGettingLocation}
            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
            title="Use current location"
          >
            <Crosshair className={`w-4 h-4 ${isGettingLocation ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>

      {/* Validation Message */}
      {validationMessage && (
        <div className={`mt-1 text-xs ${getValidationColor()} flex items-center gap-1`}>
          <span>{validationMessage}</span>
        </div>
      )}

      {/* Places Error Message */}
      {placesError && !placesReady && (
        <div className="mt-1 text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>Live search unavailable - using saved locations</span>
        </div>
      )}

      {/* Google Maps Style Suggestions Dropdown */}
      {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              <Search className="w-3 h-3" />
              <span>Address Suggestions</span>
              {isLoadingSuggestions && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {placesReady && !isLoadingSuggestions && (
                <span className="ml-auto text-green-600 dark:text-green-400">Live</span>
              )}
              {!placesReady && !isLoadingSuggestions && suggestions.length > 0 && (
                <span className="ml-auto text-orange-600 dark:text-orange-400">Saved</span>
              )}
            </div>
          </div>
          
          {/* Suggestions */}
          <div className="py-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {getSuggestionIcon(suggestion)}
                  <div className="flex-1 min-w-0">
                    {suggestion.type === 'google' && suggestion.details ? (
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {suggestion.details.mainText}
                        </div>
                        {suggestion.details.secondaryText && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {suggestion.details.secondaryText}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-900 dark:text-white truncate">
                        {suggestion.address}
                      </div>
                    )}
                  </div>
                  {suggestion.type === 'google' && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 opacity-75">
                      {getSuggestionLabel(suggestion)}
                    </div>
                  )}
                </div>
              </button>
            ))}
            
            {isLoadingSuggestions && suggestions.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching Google Maps...
                </div>
              </div>
            )}
            
            {/* No results message */}
            {!isLoadingSuggestions && suggestions.length === 0 && internalValue.length >= 2 && (
              <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {placesReady ? (
                  <div>
                    <div>No suggestions found for "{internalValue}"</div>
                    <div className="text-xs mt-1">Try being more specific or check spelling</div>
                  </div>
                ) : (
                  <div>
                    <div>Live search unavailable</div>
                    <div className="text-xs mt-1">Using saved locations only</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!showSuggestions && internalValue.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {placesReady ? (
            <span>💡 Powered by Google Maps - start typing for live suggestions</span>
          ) : (
            <span>💡 Start typing to search saved locations{placesError && ' (live search unavailable)'}</span>
          )}
        </div>
      )}

      {/* Debug Info in Development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
          <div><strong>Debug:</strong></div>
          <div>Internal: "{internalValue}"</div>
          <div>Prop: "{value}"</div>
          <div>Selecting: {isSelectingFromSuggestion ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};