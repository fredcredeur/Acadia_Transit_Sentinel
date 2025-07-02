import { useState, useEffect, useRef } from 'react';
import { Search, MapPin } from 'lucide-react';
import { useMapContext } from '../contexts/MapContext';
import { Location, LatLngCoordinates } from '../types';

export function LocationSearch() {
  const { map, setOrigin, setDestination, origin, destination } = useMapContext();
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  
  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!map || !originInputRef.current || !destinationInputRef.current) return;

    // Initialize Places Autocomplete for origin
    originAutocompleteRef.current = new google.maps.places.Autocomplete(originInputRef.current, {
      fields: ['place_id', 'geometry', 'name', 'formatted_address'],
      bounds: new google.maps.LatLngBounds(
        { lat: 44.2, lng: -68.4 }, // SW bound
        { lat: 44.4, lng: -68.1 }  // NE bound
      ),
      strictBounds: false,
    });

    // Initialize Places Autocomplete for destination
    destinationAutocompleteRef.current = new google.maps.places.Autocomplete(destinationInputRef.current, {
      fields: ['place_id', 'geometry', 'name', 'formatted_address'],
      bounds: new google.maps.LatLngBounds(
        { lat: 44.2, lng: -68.4 }, // SW bound
        { lat: 44.4, lng: -68.1 }  // NE bound
      ),
      strictBounds: false,
    });

    // Add event listeners
    const originListener = originAutocompleteRef.current.addListener('place_changed', () => {
      const place = originAutocompleteRef.current?.getPlace();
      if (place && place.geometry && place.geometry.location) {
        const newLocation: Location = {
          id: place.place_id || `origin-${Date.now()}`,
          name: place.name || 'Origin',
          address: place.formatted_address || '',
          position: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          } as LatLngCoordinates // Cast to LatLngCoordinates
        };
        setOrigin(newLocation);
        setOriginQuery(place.name || '');
      }
    });

    const destinationListener = destinationAutocompleteRef.current.addListener('place_changed', () => {
      const place = destinationAutocompleteRef.current?.getPlace();
      if (place && place.geometry && place.geometry.location) {
        const newLocation: Location = {
          id: place.place_id || `destination-${Date.now()}`,
          name: place.name || 'Destination',
          address: place.formatted_address || '',
          position: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          } as LatLngCoordinates // Cast to LatLngCoordinates
        };
        setDestination(newLocation);
        setDestinationQuery(place.name || '');
      }
    });

    return () => {
      google.maps.event.removeListener(originListener);
      google.maps.event.removeListener(destinationListener);
    };
  }, [map, setOrigin, setDestination]);

  // Update input values when origin/destination change
  useEffect(() => {
    if (origin) {
      setOriginQuery(origin.name);
    }
    if (destination) {
      setDestinationQuery(destination.name);
    }
  }, [origin, destination]);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Plan Your Route</h2>
      
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            ref={originInputRef}
            type="text"
            value={originQuery}
            onChange={(e) => setOriginQuery(e.target.value)}
            placeholder="Starting point"
            className="input pl-10"
          />
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            ref={destinationInputRef}
            type="text"
            value={destinationQuery}
            onChange={(e) => setDestinationQuery(e.target.value)}
            placeholder="Destination"
            className="input pl-10"
          />
        </div>
        
        <button 
          className="btn btn-primary w-full flex items-center justify-center"
          disabled={!origin || !destination}
        >
          <Search className="h-5 w-5 mr-2" />
          Find Routes
        </button>
      </div>
    </div>
  );
}
