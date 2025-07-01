import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMapsService } from '../services/googleMapsService';
import { StopLocation } from '../types';

interface PlanningMapComponentProps {
  origin: string;
  destination: string;
  stops: StopLocation[];
  isReady: boolean;
  onMapUpdate: (origin: string, destination: string, stops: StopLocation[]) => void;
  className?: string;
  initialCenter?: { lat: number; lng: number };
  isLoop?: boolean;
}

export const PlanningMapComponent: React.FC<PlanningMapComponentProps> = ({
  origin,
  destination,
  stops = [],
  isReady,
  onMapUpdate,
  className = '',
  initialCenter = { lat: 30.2241, lng: -92.0198 }, // Default to Lafayette, LA
  isLoop = false
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
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMarkerType, setDraggedMarkerType] = useState<'origin' | 'destination' | 'stop' | null>(null);
  const [draggedStopIndex, setDraggedStopIndex] = useState<number | null>(null);

  // Initialize map
  useEffect(() => {
    initializeMap();
  }, []);

  // Update map when addresses change
  useEffect(() => {
    if (map && isReady) {
      updateMapWithAddresses();
    }
  }, [map, origin, destination, stops, isReady, isLoop]);

  const initializeMap = async () => {
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
        center: initialCenter,
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

      // Add click listener to allow adding stops by clicking on the map
      mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          handleMapClick(event.latLng);
        }
      });

      setMap(mapInstance);
      setError(null);
    } catch (err) {
      setError('Failed to load Google Maps. Please check your API key configuration.');
      console.error('Map initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMapWithAddresses = async () => {
    if (!map) return;

    try {
      console.log('Updating map with addresses:', { origin, destination, stops: stops?.length || 0, isLoop });
      
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
      let originPosition: google.maps.LatLng | null = null;

      // Add origin marker
      if (origin) {
        try {
          const originResults = await googleMapsService.geocodeAddress(origin);
          if (originResults.length > 0) {
            const originPos = originResults[0].geometry.location;
            originPosition = originPos; // Store for loop route
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
                  `Stop ${i + 1}${stop.name ? `: ${stop.name}` : ''}`,
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
        await drawRoutePath(originPosition);
      }

    } catch (error) {
      console.error('Error updating map with addresses:', error);
      setError('Failed to update map with addresses');
    }
  };

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
      },
      zIndex: 10
    });

    // Add drag start listener
    marker.addListener('dragstart', () => {
      setIsDragging(true);
      setDraggedMarkerType(title.toLowerCase().includes('origin') ? 'origin' : 
                           title.toLowerCase().includes('destination') ? 'destination' : 'stop');
      
      if (title.toLowerCase().includes('stop')) {
        const match = title.match(/Stop (\d+)/);
        if (match) {
          setDraggedStopIndex(parseInt(match[1]) - 1);
        }
      }
    });

    // Add drag end listener - use exact coordinates without snapping
    marker.addListener('dragend', () => {
      const newPosition = marker.getPosition();
      if (newPosition) {
        // Use the exact position where the user dropped the marker
        onDragEnd(newPosition);
      }
      
      setIsDragging(false);
      setDraggedMarkerType(null);
      setDraggedStopIndex(null);
    });

    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            ${title}
          </h4>
          <p style="margin: 0; color: #4B5563; font-size: 12px;">
            Drag to adjust position. Marker can be placed directly on roads.
          </p>
        </div>
      `
    });

    marker.addListener('click', () => {
      if (!isDragging) {
        infoWindow.open(map, marker);
      }
    });

    return marker;
  };

  const handleMarkerDrag = async (position: google.maps.LatLng, type: 'origin' | 'destination' | 'stop', stopIndex?: number) => {
    try {
      const googleMapsService = GoogleMapsService.getInstance();
      
      // Get the exact coordinates
      const lat = position.lat();
      const lng = position.lng();
      const coordString = `${lat},${lng}`;
      
      // Create a copy of the current state
      let newOrigin = origin;
      let newDestination = destination;
      let newStops = [...stops];
      
      // Update the appropriate address
      if (type === 'origin') {
        newOrigin = coordString;
      } else if (type === 'destination') {
        newDestination = coordString;
      } else if (type === 'stop' && stopIndex !== undefined) {
        newStops[stopIndex] = {
          ...newStops[stopIndex],
          address: coordString
        };
      }
      
      // Update the parent component
      onMapUpdate(newOrigin, newDestination, newStops);
      
      // Try to get a readable address for display purposes
      try {
        const results = await googleMapsService.reverseGeocode(lat, lng);
        if (results.length > 0) {
          const address = results[0].formatted_address;
          
          // Show a temporary info window with the address
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
                  ${type.charAt(0).toUpperCase() + type.slice(1)} Updated
                </h4>
                <p style="margin: 0; color: #4B5563; font-size: 12px;">
                  ${address}
                </p>
              </div>
            `
          });
          
          infoWindow.setPosition(position);
          infoWindow.open(map);
          setTimeout(() => infoWindow.close(), 3000);
        }
      } catch (error) {
        console.warn('Failed to reverse geocode position:', error);
      }
    } catch (error) {
      console.error('Failed to handle marker drag:', error);
    }
  };

  const handleMapClick = async (position: google.maps.LatLng) => {
    // Only add stops when clicking on the map (not for origin/destination)
    if (!origin || !destination) return;
    
    try {
      const lat = position.lat();
      const lng = position.lng();
      const coordString = `${lat},${lng}`;
      
      // Create a new stop
      const newStop: StopLocation = {
        id: `stop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        address: coordString,
        order: stops.length,
        estimatedStopTime: 15
      };
      
      // Add the new stop
      const newStops = [...stops, newStop];
      onMapUpdate(origin, destination, newStops);
      
      // Show a temporary info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
              Stop Added
            </h4>
            <p style="margin: 0; color: #4B5563; font-size: 12px;">
              New stop added at this location
            </p>
          </div>
        `
      });
      
      infoWindow.setPosition(position);
      infoWindow.open(map);
      setTimeout(() => infoWindow.close(), 3000);
    } catch (error) {
      console.error('Failed to handle map click:', error);
    }
  };

  const drawRoutePath = async (originPosition: google.maps.LatLng | null = null) => {
    if (!map || !origin || !destination || !directionsRenderer) return;

    try {
      const googleMapsService = GoogleMapsService.getInstance();
      
      // Convert stops to waypoints
      let waypoints = stops && Array.isArray(stops) 
        ? stops.filter(stop => stop.address).map(stop => ({
            location: stop.address,
            stopover: true
          }))
        : [];

      // If loop is enabled, add the origin as the final destination
      let finalDestination = destination;
      
      if (isLoop && origin) {
        console.log('🔄 Loop route enabled - adding origin as final destination');
        finalDestination = origin;
        
        // Add visual indicator for loop route
        if (originPosition) {
          const loopMarker = new google.maps.Marker({
            position: originPosition,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#22c55e',
              fillOpacity: 0.5,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              strokeDasharray: [2, 2] // Dashed outline
            },
            title: 'Return to Origin (Loop Route)',
            zIndex: 5
          });
          
          // Add to stop markers array for cleanup
          setStopMarkers(prev => [...prev, loopMarker]);
          
          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
                  🔄 Loop Route
                </h4>
                <p style="margin: 0; color: #4B5563; font-size: 12px;">
                  Route will return to starting point
                </p>
              </div>
            `
          });
          
          loopMarker.addListener('click', () => {
            infoWindow.open(map, loopMarker);
          });
        }
      }

      const routeRequest = {
        origin,
        destination: finalDestination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false
      };

      const result = await googleMapsService.getRoutes(routeRequest);
      
      if (result.routes.length > 0) {
        directionsRenderer.setDirections(result);
        
        // Add a visual indicator for the loop connection if needed
        if (isLoop && originPosition) {
          // The route already includes the return to origin
          console.log('🔄 Loop route displayed successfully');
        }
      }

    } catch (error) {
      console.error('Failed to draw route path:', error);
    }
  };

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
      
      {/* Dragging Indicator */}
      {isDragging && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-20">
          <div className="flex items-center gap-2">
            <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
            <span className="text-sm font-medium">
              {draggedMarkerType === 'origin' ? 'Moving origin...' : 
               draggedMarkerType === 'destination' ? 'Moving destination...' : 
               `Moving stop ${draggedStopIndex !== null ? draggedStopIndex + 1 : ''}...`}
            </span>
          </div>
        </div>
      )}
      
      {/* Map Instructions */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Interactive Planning</div>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div>🟢 Green: Origin</div>
            <div>🔴 Red: Destination</div>
            <div>🟠 Yellow: Stops</div>
            {isLoop && (
              <div className="text-green-600 dark:text-green-400">🔄 Loop route: Returns to origin</div>
            )}
            <div className="pt-1 border-t border-gray-200 dark:border-gray-600">
              <strong>Drag markers</strong> to adjust locations
            </div>
            <div><strong>Click map</strong> to add new stops</div>
            <div><strong>Markers can be placed directly on roads</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};