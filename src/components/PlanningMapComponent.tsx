import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StopLocation } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';
import { MapPin, AlertCircle, Loader2 } from 'lucide-react';

interface PlanningMapComponentProps {
  origin: string;
  destination: string;
  stops: StopLocation[];
  isReady: boolean;
  onMapUpdate: (origin: string, destination: string, stops: StopLocation[]) => void;
  className?: string;
  initialCenter?: { lat: number; lng: number };
}

export const PlanningMapComponent: React.FC<PlanningMapComponentProps> = ({
  origin,
  destination,
  stops,
  isReady,
  onMapUpdate,
  className = '',
  initialCenter = { lat: 39.8283, lng: -98.5795 }
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originMarker, setOriginMarker] = useState<google.maps.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<google.maps.Marker | null>(null);
  const [stopMarkers, setStopMarkers] = useState<google.maps.Marker[]>([]);
  const [routePath, setRoutePath] = useState<google.maps.Polyline | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPointType, setDraggedPointType] = useState<'origin' | 'destination' | 'stop' | null>(null);
  const [draggedStopIndex, setDraggedStopIndex] = useState<number | null>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (map && isReady) {
      updateMapWithAddresses();
    }
  }, [map, origin, destination, stops, isReady]);

  const initializeMap = async () => {
    if (!mapRef.current) {
      setError('Map container not found.');
      setIsLoading(false);
      return;
    }

    try {
      const googleMapsService = GoogleMapsService.getInstance();
      await googleMapsService.initialize();

      const newMap = new google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
      
      // Add click listener to allow adding stops by clicking on the map
      newMap.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (!isReady || !event.latLng) return;
        
        // If origin is not set, set it first
        if (!origin) {
          handleMapPointUpdate('origin', event.latLng);
        }
        // If destination is not set, set it next
        else if (!destination) {
          handleMapPointUpdate('destination', event.latLng);
        }
        // Otherwise add a stop
        else {
          handleAddStopAtLocation(event.latLng);
        }
      });
      
      setMap(newMap);
      setIsLoading(false);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to load Google Maps. Please check your API key and network connection.');
      setIsLoading(false);
    }
  };

  const updateMapWithAddresses = async () => {
    if (!map) return;
    
    // Clear existing markers and path
    clearMapOverlays();
    
    try {
      // Create origin marker if address is provided
      if (origin) {
        const originCoords = await geocodeAddress(origin);
        if (originCoords) {
          createOriginMarker(originCoords);
        }
      }
      
      // Create destination marker if address is provided
      if (destination) {
        const destCoords = await geocodeAddress(destination);
        if (destCoords) {
          createDestinationMarker(destCoords);
        }
      }
      
      // Create stop markers
      const newStopMarkers: google.maps.Marker[] = [];
      if (stops && stops.length > 0) {
        for (const stop of stops) {
          const stopCoords = await geocodeAddress(stop.address);
          if (stopCoords) {
            const marker = createStopMarker(stopCoords, stop.order, stop.id);
            newStopMarkers.push(marker);
          }
        }
      }
      setStopMarkers(newStopMarkers);
      
      // Draw route path if origin and destination are set
      if (origin && destination) {
        await drawRoutePath();
      }
      
      // Fit map to show all points
      fitMapToBounds();
      
    } catch (error) {
      console.error('Error updating map with addresses:', error);
      setError(`Failed to display addresses on map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearMapOverlays = () => {
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
    
    if (routePath) {
      routePath.setMap(null);
      setRoutePath(null);
    }
  };

  const geocodeAddress = async (address: string): Promise<google.maps.LatLng | null> => {
    try {
      // Check if it's already coordinates
      const coordPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
      if (coordPattern.test(address.trim())) {
        const [latStr, lngStr] = address.split(',');
        const lat = parseFloat(latStr.trim());
        const lng = parseFloat(lngStr.trim());
        return new google.maps.LatLng(lat, lng);
      }
      
      // Otherwise geocode the address
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.geocodeAddress(address);
      
      if (results.length > 0) {
        const location = results[0].geometry.location;
        return new google.maps.LatLng(location.lat(), location.lng());
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to geocode address "${address}":`, error);
      return null;
    }
  };

  const createOriginMarker = (position: google.maps.LatLng) => {
    if (!map) return null;
    
    const marker = new google.maps.Marker({
      position,
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#22c55e', // Green
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      },
      title: 'Origin - Drag to adjust',
      zIndex: 40
    });
    
    // Add drag listeners
    marker.addListener('dragstart', () => {
      setIsDragging(true);
      setDraggedPointType('origin');
    });
    
    marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
      setIsDragging(false);
      setDraggedPointType(null);
      
      if (event.latLng) {
        handleMapPointUpdate('origin', event.latLng);
      }
    });
    
    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            🟢 Starting Point
          </h4>
          <p style="margin: 0 0 8px 0; color: #4B5563; font-size: 12px;">
            ${origin}
          </p>
          <div style="padding: 4px 8px; background: #ECFDF5; border-radius: 4px; border: 1px solid #10B981;">
            <p style="margin: 0; color: #047857; font-size: 10px; font-weight: 500;">
              💡 Drag to adjust the starting location
            </p>
          </div>
        </div>
      `
    });
    
    marker.addListener('click', () => {
      if (!isDragging) {
        infoWindow.open(map, marker);
      }
    });
    
    setOriginMarker(marker);
    return marker;
  };

  const createDestinationMarker = (position: google.maps.LatLng) => {
    if (!map) return null;
    
    const marker = new google.maps.Marker({
      position,
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#ef4444', // Red
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      },
      title: 'Destination - Drag to adjust',
      zIndex: 40
    });
    
    // Add drag listeners
    marker.addListener('dragstart', () => {
      setIsDragging(true);
      setDraggedPointType('destination');
    });
    
    marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
      setIsDragging(false);
      setDraggedPointType(null);
      
      if (event.latLng) {
        handleMapPointUpdate('destination', event.latLng);
      }
    });
    
    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            🔴 Destination
          </h4>
          <p style="margin: 0 0 8px 0; color: #4B5563; font-size: 12px;">
            ${destination}
          </p>
          <div style="padding: 4px 8px; background: #FEF2F2; border-radius: 4px; border: 1px solid #EF4444;">
            <p style="margin: 0; color: #B91C1C; font-size: 10px; font-weight: 500;">
              💡 Drag to adjust the destination location
            </p>
          </div>
        </div>
      `
    });
    
    marker.addListener('click', () => {
      if (!isDragging) {
        infoWindow.open(map, marker);
      }
    });
    
    setDestinationMarker(marker);
    return marker;
  };

  const createStopMarker = (position: google.maps.LatLng, order: number, stopId: string) => {
    if (!map) return null;
    
    const marker = new google.maps.Marker({
      position,
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6', // Blue
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2
      },
      title: `Stop ${order + 1} - Drag to adjust`,
      zIndex: 35
    });
    
    // Add drag listeners
    marker.addListener('dragstart', () => {
      setIsDragging(true);
      setDraggedPointType('stop');
      setDraggedStopIndex(order);
    });
    
    marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
      setIsDragging(false);
      setDraggedPointType(null);
      
      if (event.latLng) {
        handleStopUpdate(order, event.latLng, stopId);
      }
      
      setDraggedStopIndex(null);
    });
    
    // Add info window
    const stopAddress = stops[order]?.address || 'Intermediate stop';
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            🔵 Stop ${order + 1}
          </h4>
          <p style="margin: 0 0 8px 0; color: #4B5563; font-size: 12px;">
            ${stopAddress}
          </p>
          <div style="padding: 4px 8px; background: #EFF6FF; border-radius: 4px; border: 1px solid #3B82F6;">
            <p style="margin: 0; color: #1E40AF; font-size: 10px; font-weight: 500;">
              💡 Drag to adjust stop location
            </p>
          </div>
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

  const drawRoutePath = async () => {
    if (!map || !originMarker || !destinationMarker) return;
    
    try {
      const directionsService = new google.maps.DirectionsService();
      
      // Use the actual marker positions instead of raw addresses
      const originPosition = originMarker.getPosition();
      const destinationPosition = destinationMarker.getPosition();
      
      if (!originPosition || !destinationPosition) {
        console.warn('Origin or destination marker position not available');
        return;
      }
      
      // Prepare waypoints from stop markers (use their positions, not addresses)
      const waypoints = stopMarkers.map(marker => {
        const position = marker.getPosition();
        if (!position) return null;
        return {
          location: position,
          stopover: true
        };
      }).filter(waypoint => waypoint !== null) as google.maps.DirectionsWaypoint[];
      
      const result = await directionsService.route({
        origin: originPosition,
        destination: destinationPosition,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      });
      
      if (result.routes.length > 0) {
        // Clear existing path
        if (routePath) {
          routePath.setMap(null);
        }
        
        // Create new path
        const newPath = new google.maps.Polyline({
          path: google.maps.geometry.encoding.decodePath(result.routes[0].overview_polyline),
          geodesic: true,
          strokeColor: '#6366F1', // Indigo
          strokeOpacity: 0.7,
          strokeWeight: 5,
          map
        });
        
        setRoutePath(newPath);
      }
    } catch (error) {
      console.error('Failed to draw route path:', error);
      // Don't show error to user, just don't draw the path
    }
  };

  const fitMapToBounds = () => {
    if (!map) return;
    
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    
    if (originMarker && originMarker.getPosition()) {
      bounds.extend(originMarker.getPosition()!);
      hasPoints = true;
    }
    
    if (destinationMarker && destinationMarker.getPosition()) {
      bounds.extend(destinationMarker.getPosition()!);
      hasPoints = true;
    }
    
    stopMarkers.forEach(marker => {
      if (marker.getPosition()) {
        bounds.extend(marker.getPosition()!);
        hasPoints = true;
      }
    });
    
    if (hasPoints) {
      map.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50
      });
    }
  };

  // Modified to use raw coordinates instead of geocoding for marker positions
  const handleMapPointUpdate = async (type: 'origin' | 'destination', position: google.maps.LatLng) => {
    const lat = position.lat();
    const lng = position.lng();
    const coordString = `${lat},${lng}`;
    
    try {
      // Try to get a formatted address for better display
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.reverseGeocode(lat, lng);
      
      const formattedAddress = results.length > 0 
        ? results[0].formatted_address 
        : coordString;
      
      // Update the appropriate address
      if (type === 'origin') {
        const newStops = [...stops];
        onMapUpdate(formattedAddress, destination, newStops);
      } else {
        const newStops = [...stops];
        onMapUpdate(origin, formattedAddress, newStops);
      }
      
      // Redraw route path after a short delay to ensure markers are updated
      setTimeout(async () => {
        if (originMarker && destinationMarker) {
          await drawRoutePath();
        }
      }, 100);
      
    } catch (error) {
      console.warn('Failed to reverse geocode position, using coordinates instead:', error);
      
      // Fall back to coordinates if geocoding fails
      if (type === 'origin') {
        onMapUpdate(coordString, destination, stops);
      } else {
        onMapUpdate(origin, coordString, stops);
      }
      
      // Still redraw route path
      setTimeout(async () => {
        if (originMarker && destinationMarker) {
          await drawRoutePath();
        }
      }, 100);
    }
  };

  // Modified to use raw coordinates instead of geocoding for marker positions
  const handleStopUpdate = async (index: number, position: google.maps.LatLng, stopId: string) => {
    const lat = position.lat();
    const lng = position.lng();
    const coordString = `${lat},${lng}`;
    
    try {
      // Try to get a formatted address for better display
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.reverseGeocode(lat, lng);
      
      const formattedAddress = results.length > 0 
        ? results[0].formatted_address 
        : coordString;
      
      // Update the stop address
      const newStops = [...stops];
      if (newStops[index]) {
        newStops[index] = {
          ...newStops[index],
          address: formattedAddress
        };
        
        onMapUpdate(origin, destination, newStops);
        
        // Redraw route path after a short delay to ensure markers are updated
        setTimeout(async () => {
          if (originMarker && destinationMarker) {
            await drawRoutePath();
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Failed to reverse geocode stop position, using coordinates instead:', error);
      
      // Fall back to coordinates if geocoding fails
      const newStops = [...stops];
      if (newStops[index]) {
        newStops[index] = {
          ...newStops[index],
          address: coordString
        };
        
        onMapUpdate(origin, destination, newStops);
        
        // Still redraw route path
        setTimeout(async () => {
          if (originMarker && destinationMarker) {
            await drawRoutePath();
          }
        }, 100);
      }
    }
  };

  // Modified to use raw coordinates instead of geocoding for marker positions
  const handleAddStopAtLocation = async (position: google.maps.LatLng) => {
    const lat = position.lat();
    const lng = position.lng();
    const coordString = `${lat},${lng}`;
    
    try {
      // Try to get a formatted address for better display
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.reverseGeocode(lat, lng);
      
      const formattedAddress = results.length > 0 
        ? results[0].formatted_address 
        : coordString;
      
      // Create a new stop
      const newStop: StopLocation = {
        id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        address: formattedAddress,
        order: stops.length,
        estimatedStopTime: 15
      };
      
      const newStops = [...stops, newStop];
      onMapUpdate(origin, destination, newStops);
      
    } catch (error) {
      console.warn('Failed to reverse geocode new stop position, using coordinates instead:', error);
      
      // Fall back to coordinates if geocoding fails
      const newStop: StopLocation = {
        id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        address: coordString,
        order: stops.length,
        estimatedStopTime: 15
      };
      
      const newStops = [...stops, newStop];
      onMapUpdate(origin, destination, newStops);
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
      
      {/* Map Instructions */}
      {!isLoading && !error && !isReady && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-lg">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md text-center">
            <MapPin className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Route Planning Map</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Enter your origin and destination addresses in the form to start planning your route.
            </p>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                Once your addresses are entered, you can fine-tune all stops directly on this map by dragging the markers.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Map Legend */}
      {!isLoading && !error && isReady && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Interactive Planning Map
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Origin (Draggable)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Destination (Draggable)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Stops (Draggable)</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Click</strong> on map to add stops
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Drag</strong> markers to fine-tune locations
            </p>
          </div>
        </div>
      )}

      {/* Dragging Indicator */}
      {isDragging && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-20">
          <div className="flex items-center gap-2">
            <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
            <span className="text-sm font-medium">
              {draggedPointType === 'origin' ? 'Moving starting point...' : 
               draggedPointType === 'destination' ? 'Moving destination...' : 
               `Moving stop ${draggedStopIndex !== null ? draggedStopIndex + 1 : ''}...`}
            </span>
          </div>
        </div>
      )}

      {/* Instructions Panel */}
      {!isDragging && isReady && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            🚌 Route Planning
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>• <strong>Drag markers</strong> to fine-tune locations</div>
            <div>• <strong>Click on map</strong> to add additional stops</div>
            <div>• <strong>Click markers</strong> for more information</div>
            <div>• Drag directly onto roads for precise positioning</div>
          </div>
        </div>
      )}
    </div>
  );
};