import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMapsService } from '../services/googleMapsService';
import { StopLocation } from '../types';

interface PlanningMapComponentProps {
  origin: string;
  destination: string;
  stops: StopLocation[];
  onStopsChange: (stops: StopLocation[]) => void;
  onOriginChange: (origin: string) => void;
  onDestinationChange: (destination: string) => void;
  className?: string;
}

export const PlanningMapComponent: React.FC<PlanningMapComponentProps> = ({
  origin,
  destination,
  stops = [],
  onStopsChange,
  onOriginChange,
  onDestinationChange,
  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originMarker, setOriginMarker] = useState<google.maps.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<google.maps.Marker | null>(null);
  const [stopMarkers, setStopMarkers] = useState<google.maps.Marker[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [routePath, setRoutePath] = useState<google.maps.Polyline | null>(null);

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

      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#4299E1',
          strokeOpacity: 0.8,
          strokeWeight: 6
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
    if (!map || (!origin && !destination)) return;

    try {
      console.log('Updating map with addresses:', { origin, destination, stops: stops?.length || 0 });
      
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
      stopMarkers.forEach(marker => marker.setMap(null));
      setStopMarkers([]);

      // Clear existing route
      if (routePath) {
        routePath.setMap(null);
        setRoutePath(null);
      }

      const bounds = new google.maps.LatLngBounds();
      let hasValidPoints = false;

      // Add origin marker
      if (origin) {
        try {
          const originResults = await googleMapsService.geocodeAddress(origin);
          if (originResults.length > 0) {
            const originPos = originResults[0].geometry.location;
            const originMarkerInstance = createDraggableMarker(
              originPos,
              'Origin',
              '#22c55e',
              (newPosition) => handleMarkerDrag(newPosition, 'origin')
            );
            setOriginMarker(originMarkerInstance);
            bounds.extend(originPos);
            hasValidPoints = true;
          }
        } catch (error) {
          console.warn('Failed to geocode origin:', error);
        }
      }

      // Add destination marker
      if (destination) {
        try {
          const destResults = await googleMapsService.geocodeAddress(destination);
          if (destResults.length > 0) {
            const destPos = destResults[0].geometry.location;
            const destMarkerInstance = createDraggableMarker(
              destPos,
              'Destination',
              '#ef4444',
              (newPosition) => handleMarkerDrag(newPosition, 'destination')
            );
            setDestinationMarker(destMarkerInstance);
            bounds.extend(destPos);
            hasValidPoints = true;
          }
        } catch (error) {
          console.warn('Failed to geocode destination:', error);
        }
      }

      // Add stop markers
      if (stops && Array.isArray(stops)) {
        const newStopMarkers: google.maps.Marker[] = [];
        
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          if (stop.address) {
            try {
              const stopResults = await googleMapsService.geocodeAddress(stop.address);
              if (stopResults.length > 0) {
                const stopPos = stopResults[0].geometry.location;
                const stopMarkerInstance = createDraggableMarker(
                  stopPos,
                  `Stop ${i + 1}`,
                  '#f59e0b',
                  (newPosition) => handleMarkerDrag(newPosition, 'stop', i)
                );
                newStopMarkers.push(stopMarkerInstance);
                bounds.extend(stopPos);
                hasValidPoints = true;
              }
            } catch (error) {
              console.warn(`Failed to geocode stop ${i + 1}:`, error);
            }
          }
        }
        setStopMarkers(newStopMarkers);
      }

      // Fit map to bounds if we have valid points
      if (hasValidPoints && !bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50 });
      }

      // Draw route if we have origin and destination
      if (origin && destination) {
        await drawRoutePath();
      }

    } catch (error) {
      console.error('Error updating map with addresses:', error);
      setError('Failed to update map with addresses');
    }
  }, [map, origin, destination, stops, originMarker, destinationMarker, stopMarkers, routePath]);

  const createDraggableMarker = (
    position: google.maps.LatLng,
    title: string,
    color: string,
    onDragEnd: (position: google.maps.LatLng) => void
  ): google.maps.Marker => {
    const marker = new google.maps.Marker({
      position,
      map,
      title,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      }
    });

    // Add drag end listener with road snapping
    marker.addListener('dragend', async () => {
      const newPosition = marker.getPosition();
      if (newPosition) {
        // Snap to nearest road
        const snappedPosition = await snapToRoad(newPosition);
        if (snappedPosition) {
          marker.setPosition(snappedPosition);
          onDragEnd(snappedPosition);
        } else {
          onDragEnd(newPosition);
        }
      }
    });

    return marker;
  };

  const snapToRoad = async (position: google.maps.LatLng): Promise<google.maps.LatLng | null> => {
    try {
      // Use Google Roads API to snap to nearest road
      const response = await fetch(
        `https://roads.googleapis.com/v1/snapToRoads?path=${position.lat()},${position.lng()}&interpolate=true&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.snappedPoints && data.snappedPoints.length > 0) {
          const snappedPoint = data.snappedPoints[0];
          return new google.maps.LatLng(
            snappedPoint.location.latitude,
            snappedPoint.location.longitude
          );
        }
      }
    } catch (error) {
      console.warn('Failed to snap to road:', error);
    }

    // Fallback: Use Places API to find nearby roads
    try {
      const service = new google.maps.places.PlacesService(map!);
      
      return new Promise((resolve) => {
        const request = {
          location: position,
          radius: 50, // 50 meter radius
          type: 'route' // Look for roads/routes
        };

        service.nearbySearch(request, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Find the closest road
            let closestRoad = results[0];
            let minDistance = google.maps.geometry.spherical.computeDistanceBetween(
              position,
              closestRoad.geometry!.location!
            );

            for (let i = 1; i < results.length; i++) {
              const distance = google.maps.geometry.spherical.computeDistanceBetween(
                position,
                results[i].geometry!.location!
              );
              if (distance < minDistance) {
                minDistance = distance;
                closestRoad = results[i];
              }
            }

            resolve(closestRoad.geometry!.location!);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.warn('Failed to find nearby roads:', error);
      return null;
    }
  };

  const handleMarkerDrag = async (position: google.maps.LatLng, type: 'origin' | 'destination' | 'stop', stopIndex?: number) => {
    try {
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.reverseGeocode(position.lat(), position.lng());
      
      if (results.length > 0) {
        const address = results[0].formatted_address;
        
        if (type === 'origin') {
          onOriginChange(address);
        } else if (type === 'destination') {
          onDestinationChange(address);
        } else if (type === 'stop' && stopIndex !== undefined) {
          const updatedStops = [...stops];
          updatedStops[stopIndex] = {
            ...updatedStops[stopIndex],
            address
          };
          onStopsChange(updatedStops);
        }
      }
    } catch (error) {
      console.error('Failed to reverse geocode position:', error);
    }
  };

  const drawRoutePath = async () => {
    if (!map || !origin || !destination) return;

    try {
      const googleMapsService = GoogleMapsService.getInstance();
      
      const waypoints = stops && Array.isArray(stops) 
        ? stops.filter(stop => stop.address).map(stop => ({
            location: stop.address,
            stopover: true
          }))
        : [];

      const routeRequest = {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false
      };

      const result = await googleMapsService.getRoutes(routeRequest);
      
      if (directionsRenderer && result.routes.length > 0) {
        directionsRenderer.setDirections({
          routes: result.routes,
          request: routeRequest
        } as google.maps.DirectionsResult);
      }

    } catch (error) {
      console.error('Failed to draw route path:', error);
    }
  };

  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  useEffect(() => {
    if (map) {
      updateMapWithAddresses();
    }
  }, [map, origin, destination, stops, updateMapWithAddresses]);

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-red-900 dark:text-red-200 mb-2">Map Loading Error</h3>
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
            <p className="text-gray-600 dark:text-gray-400 text-sm">Loading interactive map...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Map Instructions */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Interactive Planning</div>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div>🟢 Green: Origin</div>
            <div>🔴 Red: Destination</div>
            <div>🟡 Yellow: Stops</div>
            <div className="pt-1 border-t border-gray-200 dark:border-gray-600">
              <strong>Drag markers</strong> to adjust locations
            </div>
            <div>Markers automatically snap to roads</div>
          </div>
        </div>
      )}
    </div>
  );
};