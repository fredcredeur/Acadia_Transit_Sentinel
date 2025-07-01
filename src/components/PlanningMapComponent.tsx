import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMapsService } from '../services/googleMapsService';
import { MapPin, Navigation, AlertTriangle, RotateCcw } from 'lucide-react';

interface PlanningMapComponentProps {
  className?: string;
  onAddressesChange?: (addresses: { origin: string; destination: string }) => void;
  initialOrigin?: string;
  initialDestination?: string;
  isLoop?: boolean;
}

export const PlanningMapComponent: React.FC<PlanningMapComponentProps> = ({
  className = '',
  onAddressesChange,
  initialOrigin = '',
  initialDestination = '',
  isLoop = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originMarker, setOriginMarker] = useState<google.maps.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<google.maps.Marker | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [addresses, setAddresses] = useState({
    origin: initialOrigin,
    destination: initialDestination
  });

  const initializeMap = useCallback(async () => {
    if (!mapRef.current) {
      setError('Map container not found.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const googleMapsService = GoogleMapsService.getInstance();
      await googleMapsService.initialize();

      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 13,
        center: { lat: 30.2241, lng: -92.0198 }, // Lafayette, LA
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Create directions renderer
      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2563eb',
          strokeOpacity: 0.8,
          strokeWeight: 4
        }
      });
      renderer.setMap(mapInstance);
      setDirectionsRenderer(renderer);

      setMap(mapInstance);
      setError(null);
    } catch (err) {
      setError('Failed to load Google Maps. Please check your API key configuration.');
      console.error('Map initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateMapWithAddresses = useCallback(async () => {
    if (!map || !addresses.origin || !addresses.destination) return;

    try {
      console.log('Updating map with addresses:', addresses);
      console.log('Is loop route:', isLoop);

      const googleMapsService = GoogleMapsService.getInstance();
      
      // Clear existing markers
      if (originMarker) {
        originMarker.setMap(null);
        setOriginMarker(null);
      }
      if (destinationMarker) {
        destinationMarker.setMap(null);
        setDestinationMarker(null);
      }

      // Geocode addresses
      const originResults = await googleMapsService.geocodeAddress(addresses.origin);
      const destinationResults = await googleMapsService.geocodeAddress(addresses.destination);

      if (originResults.length === 0) {
        throw new Error(`Could not find location for origin: ${addresses.origin}`);
      }
      if (destinationResults.length === 0) {
        throw new Error(`Could not find location for destination: ${addresses.destination}`);
      }

      const originLocation = originResults[0].geometry.location;
      const destinationLocation = destinationResults[0].geometry.location;

      // Create markers
      const newOriginMarker = new google.maps.Marker({
        position: originLocation,
        map: map,
        title: 'Origin',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        draggable: true
      });

      const newDestinationMarker = new google.maps.Marker({
        position: destinationLocation,
        map: map,
        title: isLoop ? 'Destination (returns to origin)' : 'Destination',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: isLoop ? '#f59e0b' : '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        draggable: true
      });

      setOriginMarker(newOriginMarker);
      setDestinationMarker(newDestinationMarker);

      // Add drag listeners
      newOriginMarker.addListener('dragend', () => handleMarkerDrag(newOriginMarker, 'origin'));
      newDestinationMarker.addListener('dragend', () => handleMarkerDrag(newDestinationMarker, 'destination'));

      // Draw route
      await drawRoutePath(originLocation, destinationLocation);

    } catch (error) {
      console.error('Failed to update map with addresses:', error);
      setError(error instanceof Error ? error.message : 'Failed to update map');
    }
  }, [map, addresses, isLoop, originMarker, destinationMarker]);

  const drawRoutePath = useCallback(async (
    origin: google.maps.LatLng, 
    destination: google.maps.LatLng
  ) => {
    if (!directionsRenderer) return;

    try {
      console.log('Drawing route path...');
      console.log('Origin:', origin.lat(), origin.lng());
      console.log('Destination:', destination.lat(), destination.lng());
      console.log('Is loop:', isLoop);

      const directionsService = new google.maps.DirectionsService();
      
      // For loop routes, set destination back to origin
      const finalDestination = isLoop ? origin : destination;
      
      console.log('Final destination:', finalDestination.lat(), finalDestination.lng());

      const request: google.maps.DirectionsRequest = {
        origin: origin,
        destination: finalDestination,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false
      };

      // If it's a loop and origin != destination, add destination as waypoint
      if (isLoop && !origin.equals(destination)) {
        request.waypoints = [{
          location: destination,
          stopover: true
        }];
        console.log('Added waypoint for loop route:', destination.lat(), destination.lng());
      }

      directionsService.route(request, (result, status) => {
        console.log('Directions service response:', status);
        
        if (status === google.maps.DirectionsStatus.OK && result) {
          console.log('Route found successfully');
          directionsRenderer.setDirections(result);
          
          // Fit map to show the entire route
          const bounds = new google.maps.LatLngBounds();
          result.routes[0].legs.forEach(leg => {
            leg.steps.forEach(step => {
              if (step.path) {
                step.path.forEach(point => bounds.extend(point));
              }
            });
          });
          
          if (!bounds.isEmpty()) {
            map?.fitBounds(bounds, { padding: 50 });
            console.log('Map bounds updated to show full route');
          }
        } else {
          console.error('Directions request failed:', status);
          throw new Error(`Failed to draw route path: ${status}`);
        }
      });

    } catch (error) {
      console.error('Failed to draw route path:', error);
      setError(error instanceof Error ? error.message : 'Failed to draw route');
    }
  }, [directionsRenderer, map, isLoop]);

  const handleMarkerDrag = useCallback(async (
    marker: google.maps.Marker, 
    type: 'origin' | 'destination'
  ) => {
    const position = marker.getPosition();
    if (!position) return;

    try {
      // Snap to nearest road
      const googleMapsService = GoogleMapsService.getInstance();
      const snappedResults = await googleMapsService.reverseGeocode(
        position.lat(), 
        position.lng()
      );

      if (snappedResults.length > 0) {
        const snappedAddress = snappedResults[0].formatted_address;
        const snappedLocation = snappedResults[0].geometry.location;
        
        // Update marker position to snapped location
        marker.setPosition(snappedLocation);
        
        // Update addresses
        const newAddresses = {
          ...addresses,
          [type]: snappedAddress
        };
        setAddresses(newAddresses);
        onAddressesChange?.(newAddresses);

        // Redraw route if both markers exist
        if (originMarker && destinationMarker) {
          const originPos = originMarker.getPosition();
          const destPos = destinationMarker.getPosition();
          if (originPos && destPos) {
            await drawRoutePath(originPos, destPos);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to snap ${type} marker to road:`, error);
    }
  }, [addresses, onAddressesChange, originMarker, destinationMarker, drawRoutePath]);

  // Initialize map
  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  // Update map when addresses or loop status change
  useEffect(() => {
    if (map && addresses.origin && addresses.destination) {
      updateMapWithAddresses();
    }
  }, [map, addresses.origin, addresses.destination, isLoop, updateMapWithAddresses]);

  // Update addresses when props change
  useEffect(() => {
    setAddresses({
      origin: initialOrigin,
      destination: initialDestination
    });
  }, [initialOrigin, initialDestination]);

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-red-900 dark:text-red-200 mb-2">Map Error</h3>
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center z-10 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Loading map...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Map Controls */}
      <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-green-600" />
          <span className="text-gray-600 dark:text-gray-400">Origin</span>
        </div>
        <div className="flex items-center gap-2 text-sm mt-1">
          <MapPin className={`w-4 h-4 ${isLoop ? 'text-amber-600' : 'text-red-600'}`} />
          <span className="text-gray-600 dark:text-gray-400">
            {isLoop ? 'Destination (returns to origin)' : 'Destination'}
          </span>
        </div>
        {isLoop && (
          <div className="flex items-center gap-2 text-sm mt-1">
            <RotateCcw className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">Loop Route</span>
          </div>
        )}
      </div>

      {/* Route Info */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {isLoop ? 'Loop Route Active' : 'Point-to-Point Route'}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Drag markers to adjust route
          </div>
        </div>
      )}
    </div>
  );
};