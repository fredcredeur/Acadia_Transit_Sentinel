// SmartAddressInput.tsx - Replace your current LocationInput with this
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Star, Crosshair, Search } from 'lucide-react';
import { SavedLocation } from '../types';
import { useSavedLocations } from '../hooks/useSavedLocations';
import { useGeolocation } from '../hooks/useGeolocation';

interface SmartAddressInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  onLocationSelect?: (location: SavedLocation) => void;
}

// Known good Louisiana addresses for suggestions
const commonLouisianaAddresses = [
  // Lafayette Area
  "University of Louisiana at Lafayette, Lafayette, LA",
  "Lafayette Regional Airport, Lafayette, LA",
  "Acadiana Mall, Lafayette, LA",
  "The Oil Center, Lafayette, LA",
  "Vermilionville Historic Village, Lafayette, LA",
  "Walmart Supercenter, Lafayette, LA",
  "Rouses Market, Lafayette, LA",
  "Lafayette General Medical Center, Lafayette, LA",
  
  // Opelousas Area  
  "Walmart Supercenter, Opelousas, LA",
  "Opelousas General Health System, Opelousas, LA",
  "926 Anthony Ave, Opelousas, LA 70570",
  "Le Vieux Village, Opelousas, LA",
  
  // Other Acadiana
  "LSU Eunice, Eunice, LA",
  "Crowley Rice Festival Grounds, Crowley, LA",
  "Rayne Civic Center, Rayne, LA",
  "Scott Town Hall, Scott, LA",
  "Carencro City Hall, Carencro, LA",
  "Broussard City Hall, Broussard, LA",
  
  // Specific Addresses (examples)
  "429 Cherry St, Lafayette, LA 70501",
  "1201 W Pinhook Rd, Lafayette, LA 70503",
  "2250 NW Evangeline Thruway, Lafayette, LA 70501",
  "100 Jefferson St, Lafayette, LA 70501"
];

export const SmartAddressInput: React.FC<SmartAddressInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  onLocationSelect
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'none' | 'valid' | 'warning' | 'error'>('none');
  const [validationMessage, setValidationMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { savedLocations, addLocation, markAsUsed } = useSavedLocations();
  const { coordinates, getCurrentLocation, isLoading: isGettingLocation } = useGeolocation();

  useEffect(() => {
    if (coordinates) {
      onChange(`${coordinates.lat},${coordinates.lng}`);
    }
  }, [coordinates, onChange]);

  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([]);
      setValidationStatus('none');
      setValidationMessage('');
      return;
    }

    // Generate suggestions
    generateSuggestions(value);
    
    // Validate address
    validateAddress(value);
  }, [value]);

  const generateSuggestions = (input: string) => {
    const inputLower = input.toLowerCase();
    
    // Combine saved locations and common addresses
    const allSuggestions = [
      ...savedLocations.map(loc => loc.address),
      ...commonLouisianaAddresses
    ];
    
    // Filter and rank suggestions
    const filtered = allSuggestions
      .filter(addr => addr.toLowerCase().includes(inputLower))
      .filter((addr, index, arr) => arr.indexOf(addr) === index) // Remove duplicates
      .slice(0, 8);
    
    setSuggestions(filtered);
  };

  const validateAddress = (address: string) => {
    // Check if it's coordinates
    if (/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(address)) {
      setValidationStatus('valid');
      setValidationMessage('Coordinates detected');
      return;
    }

    // Check for complete address components
    const hasStreetNumber = /\d+/.test(address);
    const hasStreetType = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court)\b/i.test(address);
    const hasBusinessName = /\b(walmart|university|hospital|mall|airport|center|park|school|church)\b/i.test(address);
    const hasCity = /\b(lafayette|opelousas|eunice|crowley|rayne|scott|carencro|broussard|youngsville)\b/i.test(address);
    const hasState = /\b(la|louisiana)\b/i.test(address);
    
    let score = 0;
    const issues = [];
    
    if (hasStreetNumber || hasBusinessName) score += 2;
    if (hasStreetType || hasBusinessName) score += 2;
    if (hasCity) score += 2;
    if (hasState) score += 2;
    
    if (!hasCity) issues.push('city');
    if (!hasState) issues.push('state');
    if (!hasStreetNumber && !hasBusinessName) issues.push('street number or business name');

    if (score >= 6) {
      setValidationStatus('valid');
      setValidationMessage('Good address format');
    } else if (score >= 4) {
      setValidationStatus('warning');
      setValidationMessage(`Consider adding: ${issues.join(', ')}`);
    } else {
      setValidationStatus('error');
      setValidationMessage(`Missing: ${issues.join(', ')}`);
    }
  };

  const autoEnhanceAddress = () => {
    let enhanced = value.trim();
    
    // Add state if missing
    if (!enhanced.includes('LA') && !enhanced.includes('Louisiana')) {
      const louisianaKeywords = ['lafayette', 'opelousas', 'acadiana', 'eunice', 'crowley'];
      const isLouisiana = louisianaKeywords.some(keyword => 
        enhanced.toLowerCase().includes(keyword)
      );
      
      if (isLouisiana) {
        enhanced += ', LA';
      }
    }
    
    // Add USA for better geocoding
    if (!enhanced.includes('USA')) {
      enhanced += ', USA';
    }
    
    onChange(enhanced);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    
    // Mark saved location as used if it's from saved locations
    const savedLocation = savedLocations.find(loc => loc.address === suggestion);
    if (savedLocation) {
      markAsUsed(savedLocation.id);
      onLocationSelect?.(savedLocation);
    }
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    // Delay hiding to allow click on suggestions
    setTimeout(() => setShowSuggestions(false), 200);
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
      </label>
      
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
          placeholder={placeholder}
          autoComplete="off"
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {/* Validation Icon */}
          {getValidationIcon()}
          
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

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
              <Search className="w-3 h-3" />
              Address Suggestions
            </div>
            
            {suggestions.map((suggestion, index) => {
              const isSavedLocation = savedLocations.some(loc => loc.address === suggestion);
              
              return (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-sm"
                >
                  <div className="flex items-center gap-2">
                    {isSavedLocation ? (
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    ) : (
                      <MapPin className="w-3 h-3 text-gray-400" />
                    )}
                    <span className="text-gray-900 dark:text-white truncate">
                      {suggestion}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!showSuggestions && value.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 Try: "Walmart, Lafayette, LA" or "123 Main St, Lafayette, LA"
        </div>
      )}
      
      {/* Address Format Examples */}
      {validationStatus === 'error' && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
          <div className="font-medium mb-1">Example formats:</div>
          <div>• University of Louisiana, Lafayette, LA</div>
          <div>• 123 Main Street, Lafayette, LA 70501</div>
          <div>• Walmart Supercenter, Opelousas, LA</div>
        </div>
      )}
    </div>
  );
};