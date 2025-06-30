// Google Maps Style Autocomplete Input - Prioritizes live Google suggestions
// Replace your current SmartAddressInput.tsx with this version

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Star, Crosshair, Search, Loader2, Clock, Navigation } from 'lucide-react';
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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number>();
  const placesServiceRef = useRef<PlacesService | null>(null);
  const currentSearchRef = useRef<string>('');
  
  const { savedLocations, markAsUsed } = useSavedLocations();
  const { coordinates, getCurrentLocation, isLoading: isGettingLocation } = useGeolocation();

  // Debug logging
  const debugLog = (message: string, data?: any) => {
    console.log(`🗺️ [${inputId.substring(0, 8)}] ${label}: ${message}`, data || '');
  };

  // Initialize Places service
  useEffect(() => {
    const initializePlaces = async () => {
      try {
        debugLog('Initializing Google Places...');
        const placesService = PlacesService.getInstance();
        await placesService.initialize();
        placesServiceRef.current = placesService;
        setPlacesReady(true);
        debugLog('✅ Google Places ready for live autocomplete');
      } catch (error) {
        debugLog('❌ Google Places failed:', error);
        setPlacesReady(false);
      }
    };

    initializePlaces();
  }, [inputId]);

  // Handle current location
  useEffect(() => {
    if (coordinates) {
      const coordString = `${coordinates.lat},${coordinates.lng}`;
      onChange(coordString);
      debugLog('Set current location:', coordString);
    }
  }, [coordinates, onChange]);

  // Live Google Places search with optimized settings
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
      
      // Enhanced Places request for better autocomplete
      const predictions = await placesServiceRef.current.getPlacePredictions(searchQuery, {
        types: ['geocode', 'establishment'], // Include both addresses and businesses
        componentRestrictions: { country: 'us' },
        // Add Louisiana bias for better local results
        location: new google.maps.LatLng(30.2241, -92.0198), // Lafayette, LA center
        radius: 50000 // 50km radius for Louisiana focus
      });

      debugLog(`📍 Google returned ${predictions.length} suggestions`);

      const googleSuggestions = predictions.map((prediction, index) => ({
        id: `google-${inputId}-${index}`,
        address: prediction.description,
        type: 'google' as const,
        confidence: 1.0, // Highest confidence for live Google results
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
      return [];
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [placesReady, inputId]);

  // Generate suggestions with Google-first priority
  const generateSuggestions = useCallback(async (input: string) => {
    if (input.length < 1) {
      setSuggestions([]);
      debugLog('Clearing suggestions - no input');
      return;
    }

    debugLog(`Generating suggestions for: "${input}"`);
    const allSuggestions: AddressSuggestion[] = [];

    // 1. PRIORITY: Live Google Places suggestions (like real Google Maps)
    if (input.length >= 2) {
      const googleSuggestions = await performGooglePlacesSearch(input);
      allSuggestions.push(...googleSuggestions);
      debugLog(`Added ${googleSuggestions.length} Google suggestions`);
    }

    // 2. SECONDARY: Current location if relevant
    if (coordinates && input.toLowerCase().includes('current')) {
      allSuggestions.push({
        id: `current-${inputId}`,
        address: `Current Location (${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)})`,
        type: 'current_location',
        confidence: 0.9
      });
    }

    // 3. FALLBACK: Saved locations (only if Google doesn't have enough results)
    if (allSuggestions.length < 3) {
      const inputLower = input.toLowerCase();
      const savedSuggestions = savedLocations
        .filter(loc => loc.address.toLowerCase().includes(inputLower))
        .slice(0, 2) // Limit saved suggestions
        .map((loc, index) => ({
          id: `saved-${inputId}-${index}`,
          address: loc.address,
          type: 'saved' as const,
          confidence: 0.7
        }));
      
      allSuggestions.push(...savedSuggestions);
      debugLog(`Added ${savedSuggestions.length} saved suggestions as fallback`);
    }

    // Sort by Google-first priority
    allSuggestions.sort((a, b) => {
      // Google suggestions always first
      if (a.type === 'google' && b.type !== 'google') return -1;
      if (a.type !== 'google' && b.type === 'google') return 1;
      
      // Then by confidence
      return b.confidence - a.confidence;
    });

    // Limit to 6 suggestions for clean UI (like Google Maps)
    const finalSuggestions = allSuggestions.slice(0, 6);
    setSuggestions(finalSuggestions);
    debugLog(`Final suggestions: ${finalSuggestions.length} (${finalSuggestions.filter(s => s.type === 'google').length} from Google)`);
  }, [performGooglePlacesSearch, savedLocations, coordinates, inputId]);

  // Fast debounced search (shorter delay for responsive feel)
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!showSuggestions) {
      return;
    }

    // Shorter debounce for more responsive autocomplete
    debounceTimeoutRef.current = setTimeout(() => {
      generateSuggestions(value);
    }, 150); // Reduced from 300ms to 150ms for faster response

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [value, showSuggestions, generateSuggestions]);

  // Validate address
  useEffect(() => {
    validateAddress(value);
  }, [value]);

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

    // Basic address validation
    const hasNumbers = /\d/.test(address);
    const hasStreetTypes = /\b(st|street|ave|avenue|blvd|rd|road|dr|drive|ln|way|ct)\b/i.test(address);
    const hasCities = /\b(lafayette|opelousas|eunice|crowley|rayne|scott|carencro|broussard)\b/i.test(address);
    const hasState = /\b(la|louisiana)\b/i.test(address);
    const hasBusinesses = /\b(walmart|university|hospital|mall|airport|center|hotel|school)\b/i.test(address);

    if ((hasNumbers && hasStreetTypes) || hasBusinesses) {
      if (hasCities && hasState) {
        setValidationStatus('valid');
        setValidationMessage('Complete address');
      } else {
        setValidationStatus('warning');
        setValidationMessage('Consider selecting a suggestion for better accuracy');
      }
    } else {
      setValidationStatus('none');
      setValidationMessage('Continue typing for suggestions');
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

    onChange(finalAddress);
    setShowSuggestions(false);
    currentSearchRef.current = ''; // Reset search to allow new searches
    
    // Mark saved location as used
    if (suggestion.type === 'saved') {
      const savedLocation = savedLocations.find(loc => loc.address === suggestion.address);
      if (savedLocation) {
        markAsUsed(savedLocation.id);
        onLocationSelect?.(savedLocation);
      }
    }
  };

  const handleFocus = () => {
    debugLog('Input focused');
    setShowSuggestions(true);
    
    // Immediately search if there's content
    if (value.length >= 1) {
      generateSuggestions(value);
    }
  };

  const handleBlur = () => {
    debugLog('Input blurred');
    // Longer delay to allow clicking suggestions
    setTimeout(() => setShowSuggestions(false), 300);
  };

  const handleInputChange = (newValue: string) => {
    debugLog(`Input changed: "${newValue}"`);
    onChange(newValue);
    
    // Reset search reference to allow new searches
    currentSearchRef.current = '';
    
    // Show suggestions immediately if there's content
    if (newValue.length >= 1 && !showSuggestions) {
      setShowSuggestions(true);
    }
  };

  const getSuggestionIcon = (suggestion: AddressSuggestion) => {
    switch (suggestion.type) {
      case 'google': 
        // Use different icons based on place type
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
        {/* Live indicator */}
        {placesReady && (
          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">
            • Live
          </span>
        )}
      </label>
      
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-full pl-10 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
          placeholder={placeholder}
          autoComplete="off"
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {/* Loading indicator for live search */}
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

      {/* Google Maps Style Suggestions Dropdown */}
      {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              <Search className="w-3 h-3" />
              <span>Google Maps Suggestions</span>
              {isLoadingSuggestions && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {placesReady && !isLoadingSuggestions && (
                <span className="ml-auto text-green-600 dark:text-green-400">Live</span>
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
                      // Google Places suggestion with structured formatting
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
                      // Other suggestion types
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
          </div>
        </div>
      )}

      {/* Help Text */}
      {!showSuggestions && value.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 Powered by Google Maps - start typing for live suggestions
        </div>
      )}
    </div>
  );
};