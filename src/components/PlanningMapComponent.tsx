import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMapsService } from '../services/googleMapsService';
import { MapPin, AlertTriangle, RotateCcw } from 'lucide-react';
import { StopLocation } from '../types';

interface PlanningMapComponentProps {
  className?: string;
  origin: string;
  destination: string;
  stops?: StopLocation[];
  isReady?: boolean;
  onMapUpdate?: (
    origin: string,
    destination: string,
    stops: StopLocation[],
    originCoords?: { lat: number; lng: number },
    destinationCoords?: { lat: number; lng: number }
  ) => void;
  initialCenter?: { lat: number; lng: number };
  isLoop?: boolean;
  originCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
  showRoute?: boolean;
}

export const PlanningMapComponent: React.FC<PlanningMapComponentProps> = ({
  className = '',
  origin = '',
  destination = '',
  stops = [],
  isReady = false,
  onMapUpdate,
  initialCenter = { lat: 30.2241, lng: -92.0198 }, // Default to Lafayette, LA
  isLoop = false,
  originCoords,
  destinationCoords,
  showRoute = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originMarker, setOriginMarker] = useState<google.maps.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<google.maps.Marker | null>(null);
  const [stopMarkers, setStopMarkers] = useState<google.maps.Marker[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [routePolyline, setRoutePolyline] = useState<google.maps.Polyline | null>(null);
  const [loopMarker, setLoopMarker] = useState<google.maps.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    initializeMap();
  }, []);

  // Update map when addresses change
  useEffect(() => {
    if (map && isReady && origin && destination) {
      updateMapWithAddresses();
    }
  }, [map, isReady, origin, destination, stops, isLoop]);

  // Clear any existing route preview when disabled
  useEffect(() => {
    if (!showRoute) {
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] } as any);
      }
      if (routePolyline) {
        routePolyline.setMap(null);
        setRoutePolyline(null);
      }
    }
  }, [showRoute, directionsRenderer, routePolyline]);

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
  }, [initialCenter]);

  const updateMapWithAddresses = useCallback(async () => {
    if (!map || !origin || !destination) return;

    try {
      console.log('Updating map with addresses:', { origin, destination, stops: stops.length, isLoop });

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
      if (loopMarker) {
        loopMarker.setMap(null);
        setLoopMarker(null);
      }
      stopMarkers.forEach(marker => marker.setMap(null));
      setStopMarkers([]);

      // Clear existing route
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] } as any); // Cast to any to clear
      }
      if (routePolyline) {
        routePolyline.setMap(null);
        setRoutePolyline(null);
      }

      let originLocation: google.maps.LatLng;
      let destinationLocation: google.maps.LatLng;

      if (originCoords) {
        originLocation = new google.maps.LatLng(originCoords.lat, originCoords.lng);
      } else if (originMarker && originMarker.getPosition()) {
        originLocation = originMarker.getPosition()!;
      } else {
        const originResults = await googleMapsService.geocodeAddress(origin);
        if (originResults.length === 0) {
          throw new Error(`Could not find location for origin: ${origin}`);
        }
        originLocation = originResults[0].geometry.location;
      }

      if (destinationCoords) {
        destinationLocation = new google.maps.LatLng(destinationCoords.lat, destinationCoords.lng);
      } else if (destinationMarker && destinationMarker.getPosition()) {
        destinationLocation = destinationMarker.getPosition()!;
      } else {
        const destinationResults = await googleMapsService.geocodeAddress(destination);
        if (destinationResults.length === 0) {
          throw new Error(`Could not find location for destination: ${destination}`);
        }
        destinationLocation = destinationResults[0].geometry.location;
      }

      // Create origin marker
      const newOriginMarker = new google.maps.Marker({
        position: originLocation,
        map: map,
        title: 'Origin',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        draggable: true
      });

      // Create destination marker
      const newDestinationMarker = new google.maps.Marker({
        position: destinationLocation,
        map: map,
        title: 'Destination',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ef4444',
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

      // Add stop markers
      const newStopMarkers: google.maps.Marker[] = [];
      const updatedStops: StopLocation[] = [];
      let stopsChanged = false;
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        try {
          let stopLocation: google.maps.LatLng | null = null;
          if (stop.lat !== undefined && stop.lng !== undefined) {
            stopLocation = new google.maps.LatLng(stop.lat, stop.lng);
          } else if (stop.address.trim()) {
            const stopResults = await googleMapsService.geocodeAddress(stop.address);
            if (stopResults.length > 0) {
              stopLocation = stopResults[0].geometry.location;
            }
          } else {
            const ratio = (i + 1) / (stops.length + 1);
            const lat = originLocation.lat() + (destinationLocation.lat() - originLocation.lat()) * ratio;
            const lng = originLocation.lng() + (destinationLocation.lng() - originLocation.lng()) * ratio;
            stopLocation = new google.maps.LatLng(lat, lng);
            stopsChanged = true;
            updatedStops.push({ ...stop, lat, lng });
          }

          if (!stopLocation && updatedStops.length <= i) {
            updatedStops.push(stop);
          }

          if (stopLocation) {
            const distanceToOrigin = googleMapsService.calculateDistance(stopLocation, originLocation);
            const distanceToDestination = googleMapsService.calculateDistance(stopLocation, destinationLocation);
            if (distanceToOrigin < 20 || distanceToDestination < 20) {
              stopLocation = new google.maps.LatLng(stopLocation.lat() + 0.00015, stopLocation.lng() + 0.00015);
            }

            const stopMarker = new google.maps.Marker({
              position: stopLocation,
              map: map,
              title: stop.name || `Stop ${stop.order + 1}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              },
              draggable: true
            });

            stopMarker.addListener('dragend', () => handleStopMarkerDrag(stopMarker, stop.id));
            newStopMarkers.push(stopMarker);
          }
        } catch (error) {
          console.warn(`Failed to geocode stop: ${stop.address}`, error);
          if (updatedStops.length <= i) updatedStops.push(stop);
        }
      }
      setStopMarkers(newStopMarkers);

      if (stopsChanged && onMapUpdate) {
        onMapUpdate(
          origin,
          destination,
          updatedStops.length === stops.length ? updatedStops : stops,
          { lat: originLocation.lat(), lng: originLocation.lng() },
          { lat: destinationLocation.lat(), lng: destinationLocation.lng() }
        );
      }

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(originLocation);
      bounds.extend(destinationLocation);
      newStopMarkers.forEach(m => {
        const pos = m.getPosition();
        if (pos) bounds.extend(pos);
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }

      // If it's a loop route, add a visual indicator
      if (isLoop) {
        const loopIndicator = new google.maps.Marker({
          position: originLocation,
          map: map,
          title: 'Return to Origin (Loop Route)',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 16,
            fillColor: 'rgba(34, 197, 94, 0.2)', // Semi-transparent green
            fillOpacity: 0.5,
            strokeColor: '#22c55e',
            strokeWeight: 2
          },
          clickable: false,
          zIndex: 1 // Below other markers
        });
        setLoopMarker(loopIndicator);
      }

      // Optionally draw the route preview
      if (showRoute) {
        await drawRoutePath(originLocation, destinationLocation);
      }

    } catch (error) {
      console.error('Failed to update map with addresses:', error);
      setError(error instanceof Error ? error.message : 'Failed to update map');
    }
  }, [map, origin, destination, stops, isLoop, originMarker, destinationMarker, stopMarkers, directionsRenderer, routePolyline, loopMarker, originCoords, destinationCoords]);

  const drawRoutePath = useCallback(async (
    origin: google.maps.LatLng, 
    destination: google.maps.LatLng
  ) => {
    if (!map || !directionsRenderer) return;

    try {
      console.log('Drawing route path...');
      console.log('Origin:', origin.lat(), origin.lng());
      console.log('Destination:', destination.lat(), destination.lng());
      console.log('Is loop:', isLoop);
      console.log('Stops:', stops.length);

      const directionsService = new google.maps.DirectionsService();
      
      // For loop routes, set destination back to origin
      const finalDestination = isLoop ? origin : destination;
      
      console.log('Final destination:', finalDestination.lat(), finalDestination.lng());

      // Prepare waypoints
      const waypoints: google.maps.DirectionsWaypoint[] = [];
      
      // Add stops as waypoints
      for (const stop of stops) {
        try {
          if (stop.lat !== undefined && stop.lng !== undefined) {
            waypoints.push({ location: new google.maps.LatLng(stop.lat, stop.lng), stopover: true });
          } else if (stop.address.trim()) {
            const stopResults = await GoogleMapsService.getInstance().geocodeAddress(stop.address);
            if (stopResults.length > 0) {
              waypoints.push({ location: stopResults[0].geometry.location, stopover: true });
            }
          }
        } catch (error) {
          console.warn(`Failed to geocode stop: ${stop.address}`, error);
        }
      }
      
      // If it's a loop and origin != destination, add destination as waypoint
      if (isLoop && !origin.equals(destination)) {
        waypoints.push({
          location: destination,
          stopover: true
        });
        console.log('Added destination as waypoint for loop route:', destination.lat(), destination.lng());
      }

      const request: google.maps.DirectionsRequest = {
        origin: origin,
        destination: finalDestination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false
      };

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
            map.fitBounds(bounds);
            console.log('Map bounds updated to show full route');
          }
          
          // If it's a loop route, add a visual indicator connecting back to origin
          if (isLoop) {
            // Add a dashed line from the last waypoint back to origin
            const lastLeg = result.routes[0].legs[result.routes[0].legs.length - 1];
            if (lastLeg) {
              const lastStep = lastLeg.steps[lastLeg.steps.length - 1];
              if (lastStep && lastStep.end_location) {
                console.log('Adding visual loop indicator');
              }
            }
          }
        } else {
          console.error('Directions request failed:', status);
          setError(`Failed to draw route path: ${status}`);
          
          // If directions fail, draw a simple line
          if (routePolyline) {
            routePolyline.setMap(null);
          }
          
          const path = [origin];
          
          // Add waypoints to path
          waypoints.forEach(waypoint => {
            if (waypoint.location) {
              if (typeof waypoint.location === 'string') {
                // Skip string locations
              } else if ('lat' in waypoint.location && 'lng' in waypoint.location && typeof waypoint.location.lat === 'number' && typeof waypoint.location.lng === 'number') {
                path.push(new google.maps.LatLng(waypoint.location.lat, waypoint.location.lng));
              } else if (typeof (waypoint.location as google.maps.LatLng).lat === 'function' && typeof (waypoint.location as google.maps.LatLng).lng === 'function') {
                path.push(new google.maps.LatLng((waypoint.location as google.maps.LatLng).lat(), (waypoint.location as google.maps.LatLng).lng()));
              } else {
                // Invalid object type, skip
              }
            }
          });
          
          path.push(finalDestination);
          
          const newPolyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map
          });
          
          setRoutePolyline(newPolyline);
          
          // Fit bounds to show all points
          const bounds = new google.maps.LatLngBounds();
          path.forEach(point => bounds.extend(point));
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds);
          }
        }
      });

    } catch (error) {
      console.error('Failed to draw route path:', error);
      setError(error instanceof Error ? error.message : 'Failed to draw route');
    }
  }, [map, directionsRenderer, isLoop, stops, routePolyline]);

  const handleMarkerDrag = useCallback(async (
    marker: google.maps.Marker,
    type: 'origin' | 'destination'
  ) => {
    const position = marker.getPosition();
    if (!position || !map) return;

    // Clear current route preview while dragging
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] } as any);
    }
    if (routePolyline) {
      routePolyline.setMap(null);
      setRoutePolyline(null);
    }

    // Immediately update parent with new coordinates so analysis uses them even
    // if reverse geocoding hasn't finished yet
    if (onMapUpdate) {
      if (type === 'origin') {
        onMapUpdate(
          origin,
          destination,
          stops,
          { lat: position.lat(), lng: position.lng() },
          destinationMarker?.getPosition()
            ? {
                lat: destinationMarker!.getPosition()!.lat(),
                lng: destinationMarker!.getPosition()!.lng()
              }
            : undefined
        );
      } else {
        onMapUpdate(
          origin,
          destination,
          stops,
          originMarker?.getPosition()
            ? {
                lat: originMarker!.getPosition()!.lat(),
                lng: originMarker!.getPosition()!.lng()
              }
            : undefined,
          { lat: position.lat(), lng: position.lng() }
        );
      }
    }

    try {
      // Reverse geocode to get address
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.reverseGeocode(
        position.lat(),
        position.lng()
      );

      if (results.length > 0) {
        const address = results[0].formatted_address;

        if (type === 'origin' && originMarker && destinationMarker) {
          // Update preview if enabled
          if (showRoute) {
            const destPos = destinationMarker.getPosition();
            if (destPos) {
              await drawRoutePath(position, destPos);
            }
          }

          // If it's a loop route, update the loop marker
          if (isLoop && loopMarker) {
            loopMarker.setPosition(position);
          }

          // Notify parent with updated address
          if (onMapUpdate) {
            onMapUpdate(
              address,
              destination,
              stops,
              { lat: position.lat(), lng: position.lng() },
              destinationMarker?.getPosition()
                ? {
                    lat: destinationMarker!.getPosition()!.lat(),
                    lng: destinationMarker!.getPosition()!.lng()
                  }
                : undefined
            );
          }
        } else if (type === 'destination' && originMarker && destinationMarker) {
          // Update preview if enabled
          if (showRoute) {
            const originPos = originMarker.getPosition();
            if (originPos) {
              await drawRoutePath(originPos, position);
            }
          }

          // Notify parent with updated address
          if (onMapUpdate) {
            onMapUpdate(
              origin,
              address,
              stops,
              originMarker?.getPosition()
                ? {
                    lat: originMarker!.getPosition()!.lat(),
                    lng: originMarker!.getPosition()!.lng()
                  }
                : undefined,
              { lat: position.lat(), lng: position.lng() }
            );
          }
        }
      } else if (onMapUpdate) {
        const coordString = `${position.lat().toFixed(6)}, ${position
          .lng()
          .toFixed(6)}`;
        if (type === 'origin') {
          onMapUpdate(
            coordString,
            destination,
            stops,
            { lat: position.lat(), lng: position.lng() },
            destinationMarker?.getPosition()
              ? {
                  lat: destinationMarker.getPosition()!.lat(),
                  lng: destinationMarker.getPosition()!.lng()
                }
              : undefined
          );
        } else {
          onMapUpdate(
            origin,
            coordString,
            stops,
            originMarker?.getPosition()
              ? {
                  lat: originMarker.getPosition()!.lat(),
                  lng: originMarker.getPosition()!.lng()
                }
              : undefined,
            { lat: position.lat(), lng: position.lng() }
          );
        }
      }
    } catch (error) {
      console.error(`Failed to reverse geocode ${type} position:`, error);
      setError(
        `Failed to reverse geocode ${type} position: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }, [
    map,
    origin,
    destination,
    stops,
    onMapUpdate,
    originMarker,
    destinationMarker,
    drawRoutePath,
    isLoop,
    loopMarker,
    showRoute
  ]);

  const handleStopMarkerDrag = useCallback(async (
    marker: google.maps.Marker,
    stopId: string
  ) => {
    const position = marker.getPosition();
    if (!position || !map) return;

    // Clear current route preview while dragging
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] } as any);
    }
    if (routePolyline) {
      routePolyline.setMap(null);
      setRoutePolyline(null);
    }

    // Immediately update parent with new coordinates for this stop
    if (onMapUpdate) {
      const updatedStopsTemp = stops.map(stop =>
        stop.id === stopId
          ? { ...stop, lat: position.lat(), lng: position.lng() }
          : stop
      );
      onMapUpdate(
        origin,
        destination,
        updatedStopsTemp,
        originMarker?.getPosition()
          ? {
              lat: originMarker!.getPosition()!.lat(),
              lng: originMarker!.getPosition()!.lng()
            }
          : undefined,
        destinationMarker?.getPosition()
          ? {
              lat: destinationMarker!.getPosition()!.lat(),
              lng: destinationMarker!.getPosition()!.lng()
            }
          : undefined
      );
    }

    try {
      // Reverse geocode to get address
      const googleMapsService = GoogleMapsService.getInstance();
      const results = await googleMapsService.reverseGeocode(
        position.lat(), 
        position.lng()
      );

      if (results.length > 0) {
        const address = results[0].formatted_address;
        
        // Update stops
        const updatedStops = stops.map(stop =>
          stop.id === stopId
            ? { ...stop, address, lat: position.lat(), lng: position.lng() }
            : stop
        );
        
        // Update preview if enabled
        if (showRoute && originMarker && destinationMarker) {
          const originPos = originMarker.getPosition();
          const destPos = destinationMarker.getPosition();
          if (originPos && destPos) {
            await drawRoutePath(originPos, destPos);
          }
        }
        
        // Notify parent
        if (onMapUpdate) {
          onMapUpdate(
            origin,
            destination,
            updatedStops,
            originMarker?.getPosition() ? {
              lat: originMarker!.getPosition()!.lat(),
              lng: originMarker!.getPosition()!.lng(),
            } : undefined,
            destinationMarker?.getPosition() ? {
              lat: destinationMarker!.getPosition()!.lat(),
              lng: destinationMarker!.getPosition()!.lng(),
            } : undefined
          );
        }
      } else if (onMapUpdate) {
        const coordString = `${position.lat().toFixed(6)}, ${position
          .lng()
          .toFixed(6)}`;
        const updatedStops = stops.map(stop =>
          stop.id === stopId
            ? { ...stop, address: coordString, lat: position.lat(), lng: position.lng() }
            : stop
        );
        onMapUpdate(
          origin,
          destination,
          updatedStops,
          originMarker?.getPosition()
            ? { lat: originMarker!.getPosition()!.lat(), lng: originMarker!.getPosition()!.lng() }
            : undefined,
          destinationMarker?.getPosition()
            ? { lat: destinationMarker!.getPosition()!.lat(), lng: destinationMarker!.getPosition()!.lng() }
            : undefined
        );
      }
    } catch (error) {
      console.error('Failed to reverse geocode stop position:', error);
      setError(`Failed to reverse geocode stop position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [map, origin, destination, stops, onMapUpdate, originMarker, destinationMarker, drawRoutePath, showRoute]);

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
          <MapPin className="w-4 h-4 text-red-600" />
          <span className="text-gray-600 dark:text-gray-400">Destination</span>
        </div>
        {stops.length > 0 && (
          <div className="flex items-center gap-2 text-sm mt-1">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {stops.length} Stop{stops.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {isLoop && (
          <div className="flex items-center gap-2 text-sm mt-1">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span className="text-gray-600 dark:text-gray-400">Loop Route</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Route Planning
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>• Drag markers to set start, end and stops</div>
            <div>• Click Analyze Routes to view suggestions</div>
            {isLoop && (
              <div className="text-amber-600 dark:text-amber-400 font-medium">
                • Loop route will return to starting point
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
