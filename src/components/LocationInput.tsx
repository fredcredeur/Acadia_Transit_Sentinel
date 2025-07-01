import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Crosshair, Star, Search, X, Home, Building, Warehouse, Truck, Clock } from 'lucide-react';
import { SavedLocation } from '../types';
import { useSavedLocations } from '../hooks/useSavedLocations';
import { useToast } from '../hooks/useToast';
import { useGeolocation } from '../hooks/useGeolocation';
import { PlacesService, PlacePrediction } from '../services/placesService';
import { GoogleMapsService } from '../services/googleMapsService';

interface LocationInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  onLocationSelect?: (location: SavedLocation) => void;
  onPlaceSelect?: (placeId: string, address: string) => void;
}

export const LocationInput: React.FC<LocationInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  onLocationSelect,
  onPlaceSelect,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { showToast } = useToast();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationCategory, setNewLocationCategory] = useState<SavedLocation['category']>('other');
  const [searchQuery, setSearchQuery] = useState('');
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [hasGoogleMaps, setHasGoogleMaps] = useState(false);
  const [placesInitialized, setPlacesInitialized] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number>();
  
  const { savedLocations, addLocation, markAsUsed, searchLocations } = useSavedLocations();
  const { coordinates, isLoading: isGettingLocation, error: locationError, getCurrentLocation } = useGeolocation();

  // Check if Google Maps is available and initialize
  useEffect(() => {
    const initializeGoogleMaps = async () => {
      try {
        const googleMapsService = GoogleMapsService.getInstance();
        const hasApiKey = googleMapsService.hasApiKey();
        
        if (hasApiKey) {
          await googleMapsService.initialize();
          
          const placesService = PlacesService.getInstance();
          await placesService.initialize();
          
          setHasGoogleMaps(true);
          setPlacesInitialized(true);
        } else {
          setHasGoogleMaps(false);
        }
      } catch (_error) { // Changed 'error' to '_error'
        setHasGoogleMaps(false);
        setPlacesInitialized(false);
      }
    };

    initializeGoogleMaps();
  }, []);

  // Debounced function to fetch place predictions
  const fetchPlacePredictions = useCallback(async (query: string) => {
    if (!hasGoogleMaps || !placesInitialized || !query.trim() || query.length < 2) {
      setPlacePredictions([]);
      return;
    }

    setIsLoadingPredictions(true);
    try {
      const placesService = PlacesService.getInstance();
      const predictions = await placesService.getPlacePredictions(query, {
        types: ['geocode'],
        componentRestrictions: { country: 'us' }
      });
      setPlacePredictions(predictions);
    } catch (error) {
      setPlacePredictions([]);
    } finally {
      setIsLoadingPredictions(false);
    }
  }, [hasGoogleMaps, placesInitialized]);

  // Debounce place predictions
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Skip API call if we're programmatically selecting a location
    if (isSelecting) {
      setIsSelecting(false);
      setPlacePredictions([]);
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchPlacePredictions(searchQuery);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchPlacePredictions, isSelecting]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update coordinates when geolocation is successful
  useEffect(() => {
    if (coordinates) {
      setIsSelecting(true);
      onChange(`Current Location (${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)})`);
      setIsDropdownOpen(false);
    }
  }, [coordinates, onChange]);

  const handleInputFocus = () => {
    setIsSelecting(false);
    setIsDropdownOpen(true);
    setSearchQuery(value);
  };

  const handleInputChange = (newValue: string) => {
    setIsSelecting(false);
    onChange(newValue);
    setSearchQuery(newValue);
    setIsDropdownOpen(true);
  };

  const handleLocationClick = (location: SavedLocation) => {
    setIsSelecting(true);
    onChange(location.address);
    markAsUsed(location.id);
    onLocationSelect?.(location);
    setIsDropdownOpen(false);
  };

  const handlePlaceClick = async (prediction: PlacePrediction) => {
    try {
      setIsSelecting(true);
      if (hasGoogleMaps && placesInitialized) {
        const placesService = PlacesService.getInstance();
        const placeDetails = await placesService.getPlaceDetails(prediction.place_id);
        const fullAddress = placeDetails.formatted_address;
        onChange(fullAddress);
        onPlaceSelect?.(prediction.place_id, fullAddress);
      } else {
        onChange(prediction.description);
      }
      setIsDropdownOpen(false);
    } catch (_error) { // Changed 'error' to '_error'
      onChange(prediction.description);
      setIsDropdownOpen(false);
    }
  };

  const handleCurrentLocationClick = () => {
    getCurrentLocation();
  };

  const handleSaveLocation = () => {
    if (!newLocationName.trim()) {
      showToast('Please enter a location name', 'error');
      return;
    }
    
    if (!value.trim()) {
      showToast('Please enter an address', 'error');
      return;
    }

    try {
      const newLocation = addLocation({
        name: newLocationName.trim(),
        address: value.trim(),
        category: newLocationCategory,
      });
      
      // Success feedback
      setSaveSuccess(true);
      showToast(`"${newLocation.name}" saved successfully!`, 'success', 'save');
      
      // Reset form
      setShowSaveDialog(false);
      setNewLocationName('');
      setNewLocationCategory('other');
      
      // Clear success state after animation
      setTimeout(() => setSaveSuccess(false), 2000);
      
    } catch (error) {
      showToast('Failed to save location. Please try again.', 'error');
    }
  };

  const getCategoryIcon = (category: SavedLocation['category']) => {
    switch (category) {
      case 'home': return Home;
      case 'work': return Building;
      case 'warehouse': return Warehouse;
      case 'depot': return Truck;
      default: return MapPin;
    }
  };

  const getCategoryColor = (category: SavedLocation['category']) => {
    switch (category) {
      case 'home': return 'text-green-600 dark:text-green-400';
      case 'work': return 'text-blue-600 dark:text-blue-400';
      case 'warehouse': return 'text-purple-600 dark:text-purple-400';
      case 'depot': return 'text-orange-600 dark:text-orange-400';
      case 'customer': return 'text-pink-600 dark:text-pink-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const filteredLocations = searchQuery.trim() 
    ? searchLocations(searchQuery)
    : savedLocations.slice(0, 5); // Limit to 5 when showing all

  const recentLocations = savedLocations
    .filter(loc => loc.lastUsed)
    .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
    .slice(0, 3);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-300"
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        
        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {value.trim() && !disabled && (
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              className={`
                p-1 transition-all duration-300 transform
                ${saveSuccess 
                  ? 'text-green-500 scale-110 animate-pulse' 
                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110'
                }
              `}
              title="Save this location"
            >
              <Star className={`w-4 h-4 transition-all duration-300 ${saveSuccess ? 'fill-current' : ''}`} />
            </button>
          )}
          
          <button
            type="button"
            onClick={handleCurrentLocationClick}
            disabled={disabled || isGettingLocation}
            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
            title="Use current location"
          >
            <Crosshair className={`w-4 h-4 ${isGettingLocation ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>

      {locationError && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{locationError}</p>
      )}

      {/* Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-80 overflow-y-auto"
        >
          {/* Loading indicator */}
          {isLoadingPredictions && (
            <div className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Searching addresses...</span>
              </div>
            </div>
          )}

          {/* Google Places predictions */}
          {hasGoogleMaps && placesInitialized && placePredictions.length > 0 && !isLoadingPredictions && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Address Suggestions
              </div>
              {placePredictions.slice(0, 5).map((prediction) => (
                <button
                  key={prediction.place_id}
                  onClick={() => handlePlaceClick(prediction)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                >
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {prediction.structured_formatting.main_text}
                    </div>
                    {prediction.structured_formatting.secondary_text && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent locations */}
          {!searchQuery.trim() && recentLocations.length > 0 && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              {recentLocations.map((location) => {
                const Icon = getCategoryIcon(location.category);
                return (
                  <button
                    key={location.id}
                    onClick={() => handleLocationClick(location)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                  >
                    <Icon className={`w-4 h-4 ${getCategoryColor(location.category)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {location.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {location.address}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Saved locations */}
          {filteredLocations.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                <Star className="w-3 h-3" />
                {searchQuery.trim() ? 'Matching Saved Locations' : 'Saved Locations'}
              </div>
              {filteredLocations.map((location) => {
                const Icon = getCategoryIcon(location.category);
                return (
                  <button
                    key={location.id}
                    onClick={() => handleLocationClick(location)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                  >
                    <Icon className={`w-4 h-4 ${getCategoryColor(location.category)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {location.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {location.address}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {searchQuery.trim() && 
           filteredLocations.length === 0 && 
           placePredictions.length === 0 && 
           !isLoadingPredictions && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No addresses found matching "{searchQuery}"
            </div>
          )}

          {/* Empty state */}
          {!searchQuery.trim() && 
           savedLocations.length === 0 && 
           recentLocations.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              {hasGoogleMaps && placesInitialized
                ? "Start typing to search for addresses, or save frequently used locations for quick access."
                : "No saved locations yet. Save frequently used addresses for quick access."
              }
            </div>
          )}
        </div>
      )}

      {/* Save location dialog */}
      {showSaveDialog && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 transform animate-slideUp">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Save Location</h3>
        </div>
        <button
          onClick={() => setShowSaveDialog(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Location Name *
          </label>
          <input
            type="text"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
            placeholder="e.g., Main Warehouse, Home Office"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category
          </label>
          <select
            value={newLocationCategory}
            onChange={(e) => setNewLocationCategory(e.target.value as SavedLocation['category'])}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
          >
            <option value="home">🏠 Home</option>
            <option value="work">🏢 Work</option>
            <option value="warehouse">🏭 Warehouse</option>
            <option value="depot">🚛 Depot</option>
            <option value="customer">👥 Customer</option>
            <option value="other">📍 Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Address
          </label>
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400">
            {value || 'No address entered'}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setShowSaveDialog(false)}
          className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-all duration-200 transform hover:scale-105"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveLocation}
          disabled={!newLocationName.trim() || !value.trim()}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 disabled:hover:scale-100"
        >
          <Star className="w-4 h-4" />
          Save Location
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};
