// Fixed SmartAddressInput.tsx - Properly isolated instances
// Replace your current SmartAddressInput.tsx with this version

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Star, Crosshair, Search, Loader2, Clock } from 'lucide-react';
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
  // Add unique identifier to prevent conflicts
  inputId?: string;
}

interface AddressSuggestion {
  id: string;
  address: string;
  type: 'saved' | 'live' | 'recent' | 'static';
  confidence: number;
  details?: {
    placeId?: string;
    mainText?: string;
    secondaryText?: string;
  };
}

// Fallback Louisiana addresses
const staticLouisianaAddresses = [
  "University of Louisiana at Lafayette, Lafayette, LA",
  "Lafayette Regional Airport, Lafayette, LA",
  "Acadiana Mall, Lafayette, LA",
  "Walmart Supercenter, Lafayette, LA",
  "Walmart Supercenter, Opelousas, LA",
  "Opelousas General Health System, Opelousas, LA",
  "926 Anthony Ave, Opelousas, LA 70570",
  "429 Cherry St, Lafayette, LA 70501",
  "LSU Eunice, Eunice, LA",
  "Crowley Rice Festival Grounds, Crowley, LA",
];

export const SmartAddressInput: React.FC<SmartAddressInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  onLocationSelect,
  inputId = Math.random().toString(36) // Generate unique ID if not provided
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'none' | 'valid' | 'warning' | 'error'>('none');
  const [validationMessage, setValidationMessage] = useState('');
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [placesReady, setPlacesReady] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number>();
  const placesServiceRef = useRef<PlacesService | null>(null);
  const lastSearchQuery = useRef<string>('');
  
  const { savedLocations, markAsUsed } = useSavedLocations();
  const { coordinates, getCurrentLocation, isLoading: isGettingLocation } = useGeolocation();

  // Debug logging with input ID
  const debugLog = (message: string, data?: any) => {
    console.log(`🔍 [${inputId.substring(0, 8)}] ${label}: ${message}`, data || '');
  };

  // Initialize Places service for this specific input
  useEffect(() => {
    const initializePlaces = async () => {
      try {
        debugLog('Initializing Places service...');
        const placesService = PlacesService.getInstance();
        await placesService.initialize();
        placesServiceRef.current = placesService;
        setPlacesReady(true);
        debugLog('✅ Places service ready');
      } catch (error) {
        debugLog('❌ Places service failed:', error);
        setPlacesReady(false);
      }
    };

    initializePlaces();
  }, [inputId]);

  // Load recent addresses from localStorage with unique key
  useEffect(() => {
    const storageKey = `recent-addresses-${inputId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const recent = JSON.parse(stored);
        setRecentAddresses(recent.slice(0, 5));
        debugLog('Loaded recent addresses:', recent.length);
      } catch (error) {
        debugLog('Failed to load recent addresses:', error);
      }
    }
  }, [inputId]);

  // Handle current location
  useEffect(() => {
    if (coordinates) {
      const coordString = `${coordinates.lat},${coordinates.lng}`;
      onChange(coordString);
      addToRecentAddresses(`Current Location (${coordString})`);
      debugLog('Set current location:', coordString);
    }
  }, [coordinates, onChange]);

  // Perform live search with proper error handling
  const performLiveSearch = useCallback(async (searchQuery: string): Promise<AddressSuggestion[]> => {
    if (!placesServiceRef.current || !placesReady || searchQuery.length < 2) {
      debugLog('Skipping live search - not ready or query too short');
      return [];
    }

    // Prevent duplicate searches
    if (lastSearchQuery.current === searchQuery) {
      debugLog('Skipping duplicate search');
      return [];
    }

    try {
      setIsLoadingSuggestions(true);
      lastSearchQuery.current = searchQuery;
      debugLog(`🔍 Live searching: "${searchQuery}"`);
      
      const predictions = await placesServiceRef.current.getPlacePredictions(searchQuery, {
        types: ['geocode'],
        componentRestrictions: { country: 'us' }
      });

      debugLog(`📍 Found ${predictions.length} live suggestions`);

      const liveSuggestions = predictions.map((prediction, index) => ({
        id: `live-${inputId}-${index}`,
        address: prediction.description,
        type: 'live' as const,
        confidence: 0.9,
        details: {
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text
        }
      }));

      return liveSuggestions;

    } catch (error) {
      debugLog('❌ Live search failed:', error);
      return [];
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [placesReady, inputId]);

  // Generate comprehensive suggestions
  const generateSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setSuggestions([]);
      debugLog('Clearing suggestions - input too short');
      return;
    }

    debugLog(`Generating suggestions for: "${input}"`);
    const inputLower = input.toLowerCase();
    const allSuggestions: AddressSuggestion[] = [];

    // 1. Saved locations (highest priority)
    const savedSuggestions = savedLocations
      .filter(loc => loc.address.toLowerCase().includes(inputLower))
      .map((loc, index) => ({
        id: `saved-${inputId}-${index}`,
        address: loc.address,
        type: 'saved' as const,
        confidence: 1.0
      }));

    debugLog(`Found ${savedSuggestions.length} saved suggestions`);

    // 2. Recent addresses
    const recentSuggestions = recentAddresses
      .filter(addr => addr.toLowerCase().includes(inputLower))
      .filter(addr => !savedLocations.some(loc => loc.address === addr))
      .map((addr, index) => ({
        id: `recent-${inputId}-${index}`,
        address: addr,
        type: 'recent' as const,
        confidence: 0.8
      }));

    debugLog(`Found ${recentSuggestions.length} recent suggestions`);

    // 3. Live Google Places suggestions
    const liveSuggestions = await performLiveSearch(input);
    debugLog(`Found ${liveSuggestions.length} live suggestions`);

    // 4. Static fallback suggestions
    const staticSuggestions = staticLouisianaAddresses
      .filter(addr => addr.toLowerCase().includes(inputLower))
      .filter(addr => 
        !savedLocations.some(loc => loc.address === addr) &&
        !recentAddresses.includes(addr) &&
        !liveSuggestions.some(live => live.address === addr)
      )
      .map((addr, index) => ({
        id: `static-${inputId}-${index}`,
        address: addr,
        type: 'static' as const,
        confidence: 0.6
      }));

    debugLog(`Found ${staticSuggestions.length} static suggestions`);

    // Combine and sort
    allSuggestions.push(...savedSuggestions, ...recentSuggestions, ...liveSuggestions, ...staticSuggestions);
    
    const typePriority = { saved: 4, recent: 3, live: 2, static: 1 };
    allSuggestions.sort((a, b) => {
      const priorityDiff = typePriority[b.type] - typePriority[a.type];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    const finalSuggestions = allSuggestions.slice(0, 8);
    setSuggestions(finalSuggestions);
    debugLog(`Set ${finalSuggestions.length} total suggestions`);
  }, [savedLocations, recentAddresses, performLiveSearch, inputId]);

  // Debounced search effect with unique timeout per input
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!showSuggestions) {
      debugLog('Skipping search - suggestions not shown');
      return;
    }

    debugLog(`Debouncing search for: "${value}"`);
    debounceTimeoutRef.current = setTimeout(() => {
      generateSuggestions(value);
    }, 300);

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

    // Check if it's coordinates
    if (/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(address)) {
      setValidationStatus('valid');
      setValidationMessage('Coordinates detected');
      return;
    }

    // Analyze address completeness
    const hasStreetNumber = /\d+/.test(address);
    const hasStreetType = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court)\b/i.test(address);
    const hasBusinessName = /\b(walmart|university|hospital|mall|airport|center|park|school|church|hotel|restaurant)\b/i.test(address);
    const hasCity = /\b(lafayette|opelousas|eunice|crowley|rayne|scott|carencro|broussard|youngsville)\b/i.test(address);
    const hasState = /\b(la|louisiana)\b/i.test(address);
    
    let score = 0;
    const missing = [];
    
    if (hasStreetNumber || hasBusinessName) score += 2;
    if (hasStreetType || hasBusinessName) score += 2;
    if (hasCity) score += 2;
    if (hasState) score += 2;
    
    if (!hasCity) missing.push('city');
    if (!hasState) missing.push('state');
    if (!hasStreetNumber && !hasBusinessName) missing.push('street number or business name');

    if (score >= 6) {
      setValidationStatus('valid');
      setValidationMessage('Complete address format');
    } else if (score >= 4) {
      setValidationStatus('warning');
      setValidationMessage(`Consider adding: ${missing.join(', ')}`);
    } else {
      setValidationStatus('error');
      setValidationMessage(`Missing: ${missing.join(', ')}`);
    }
  };

  const addToRecentAddresses = (address: string) => {
    const storageKey = `recent-addresses-${inputId}`;
    const updated = [address, ...recentAddresses.filter(addr => addr !== address)].slice(0, 5);
    setRecentAddresses(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    debugLog('Added to recent:', address);
  };

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    debugLog(`📍 Selected suggestion: ${suggestion.address} (${suggestion.type})`);
    
    let finalAddress = suggestion.address;

    // If it's a live Google Places suggestion, get full details
    if (suggestion.type === 'live' && suggestion.details?.placeId && placesServiceRef.current) {
      try {
        debugLog('Getting place details...');
        const placeDetails = await placesServiceRef.current.getPlaceDetails(suggestion.details.placeId);
        finalAddress = placeDetails.formatted_address;
        debugLog(`📍 Enhanced address: ${finalAddress}`);
      } catch (error) {
        debugLog('Failed to get place details:', error);
      }
    }

    onChange(finalAddress);
    setShowSuggestions(false);
    addToRecentAddresses(finalAddress);
    
    // Mark saved location as used
    if (suggestion.type === 'saved') {
      const savedLocation = savedLocations.find(loc => loc.address === suggestion.address);
      if (savedLocation) {
        markAsUsed(savedLocation.id);
        onLocationSelect?.(savedLocation);
      }
    }

    // Clear last search to allow future searches
    lastSearchQuery.current = '';
  };

  const autoEnhanceAddress = () => {
    let enhanced = value.trim();
    
    if (!enhanced.includes('LA') && !enhanced.includes('Louisiana')) {
      const louisianaKeywords = ['lafayette', 'opelousas', 'acadiana', 'eunice', 'crowley'];
      const isLouisiana = louisianaKeywords.some(keyword => 
        enhanced.toLowerCase().includes(keyword)
      );
      
      if (isLouisiana) {
        enhanced += ', LA';
      }
    }
    
    if (!enhanced.includes('USA')) {
      enhanced += ', USA';
    }
    
    onChange(enhanced);
    debugLog('Auto-enhanced address:', enhanced);
  };

  const handleFocus = () => {
    debugLog('Input focused');
    setShowSuggestions(true);
    if (value.length >= 2 && suggestions.length === 0) {
      generateSuggestions(value);
    }
  };

  const handleBlur = () => {
    debugLog('Input blurred');
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const getSuggestionIcon = (suggestion: AddressSuggestion) => {
    switch (suggestion.type) {
      case 'saved': return <Star className="w-3 h-3 text-yellow-500 fill-current" />;
      case 'recent': return <Clock className="w-3 h-3 text-blue-500" />;
      case 'live': return <Search className="w-3 h-3 text-green-500" />;
      default: return <MapPin className="w-3 h-3 text-gray-400" />;
    }
  };

  const getSuggestionLabel = (suggestion: AddressSuggestion) => {
    switch (suggestion.type) {
      case 'saved': return 'Saved';
      case 'recent': return 'Recent';
      case 'live': return 'Live';
      default: return 'Suggested';
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
        {/* Debug indicator */}
        {process.env.NODE_ENV === 'development' && (
          <span className="ml-2 text-xs text-gray-400">
            [{inputId.substring(0, 8)}] {placesReady ? '🟢' : '🔴'}
          </span>
        )}
      </label>
      
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            debugLog(`Input changed: "${e.target.value}"`);
            onChange(e.target.value);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
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
          
          {/* Auto-enhance Button */}
          {value && !value.includes('LA') && !value.includes('Louisiana') && validationStatus !== 'valid' && (
            <button
              type="button"
              onClick={autoEnhanceAddress}
              className="text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded transition-colors"
              title="Auto-enhance address"
            >
              + LA
            </button>
          )}
          
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

      {/* Live Suggestions Dropdown */}
      {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
              <Search className="w-3 h-3" />
              Address Suggestions
              {isLoadingSuggestions && (
                <Loader2 className="w-3 h-3 animate-spin ml-1" />
              )}
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <span className="ml-auto text-xs">
                  ({suggestions.length} found)
                </span>
              )}
            </div>
            
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-sm group"
              >
                <div className="flex items-start gap-2">
                  {getSuggestionIcon(suggestion)}
                  <div className="flex-1 min-w-0">
                    {suggestion.details ? (
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {suggestion.details.mainText}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {suggestion.details.secondaryText}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-900 dark:text-white truncate">
                        {suggestion.address}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {getSuggestionLabel(suggestion)}
                  </div>
                </div>
              </button>
            ))}
            
            {isLoadingSuggestions && suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                Searching for addresses...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!showSuggestions && value.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 Start typing for live address suggestions
        </div>
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-1 text-xs text-gray-400">
          Places: {placesReady ? 'Ready' : 'Not Ready'} | 
          Suggestions: {suggestions.length} | 
          Loading: {isLoadingSuggestions ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  );
};