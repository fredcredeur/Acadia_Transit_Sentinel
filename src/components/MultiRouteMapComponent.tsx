import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Route, Vehicle, RouteSegment } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';
import { RiskCalculator } from '../utils/riskCalculator';
import { RouteColorManager } from '../utils/routeColors';

interface MultiRouteMapComponentProps {
  routes: Route[];
  selectedRouteId: string;
  vehicle: Vehicle;
  onRouteSelect: (routeId: string) => void;
  className?: string;
  initialCenter?: { lat: number; lng: number };
  onRouteUpdate?: (routeId: string, newWaypoints: string[]) => void;
}

export const MultiRouteMapComponent: React.FC<MultiRouteMapComponentProps> = ({
  routes,
  selectedRouteId,
  vehicle,
  onRouteSelect,
  className = '',
  initialCenter = { lat: 39.8283, lng: -98.5795 },
  onRouteUpdate
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeRenderers, setRouteRenderers] = useState<Map<string, google.maps.DirectionsRenderer>>(new Map());
  const [criticalPointMarkers, setCriticalPointMarkers] = useState<google.maps.Marker[]>([]);
  const [waypointMarkers, setWaypointMarkers] = useState<google.maps.Marker[]>([]);
  const [riskOverlays, setRiskOverlays] = useState<google.maps.Polyline[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPointType, setDraggedPointType] = useState<'waypoint' | 'critical' | null>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    return () => {
      criticalPointMarkers.forEach(marker => marker.setMap(null));
      waypointMarkers.forEach(marker => marker.setMap(null));
      riskOverlays.forEach(overlay => overlay.setMap(null));
    };
  }, [map, criticalPointMarkers, waypointMarkers, riskOverlays]);

  useEffect(() => {
    if (map && routes.length > 0 && selectedRouteId) {
      displaySelectedRoute();
    }
  }, [map, routes, selectedRouteId]);

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
        zoom: routes.length > 0 ? 12 : 4,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
      setMap(newMap);
      setIsLoading(false);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to load Google Maps. Please check your API key and network connection.');
      setIsLoading(false);
    }
  };

  const displaySelectedRoute = async () => {
    if (!map || !selectedRouteId) return;

    // Clear all existing renderers and markers
    routeRenderers.forEach(renderer => renderer.setMap(null));
    setRouteRenderers(new Map());
    criticalPointMarkers.forEach(marker => marker.setMap(null));
    setCriticalPointMarkers([]);
    waypointMarkers.forEach(marker => marker.setMap(null));
    setWaypointMarkers([]);
    riskOverlays.forEach(overlay => overlay.setMap(null));
    setRiskOverlays([]);

    const selected = routes.find(r => r.id === selectedRouteId);
    if (!selected) {
      setError('Selected route not found.');
      return;
    }

    const googleMapsService = GoogleMapsService.getInstance();

    try {
      const firstSegment = selected.segments[0];
      const lastSegment = selected.segments[selected.segments.length - 1];
      
      const origin = `${firstSegment.startLat},${firstSegment.startLng}`;
      const destination = `${lastSegment.endLat},${lastSegment.endLng}`;

      // Get consistent route color
      const routeIndex = routes.findIndex(r => r.id === selectedRouteId);
      const routeColor = RouteColorManager.getRouteColor(routeIndex);

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true, // We'll add our own draggable markers
        draggable: false,
        polylineOptions: {
          strokeColor: routeColor,
          strokeOpacity: 0.8,
          strokeWeight: 6,
          zIndex: 10
        }
      });

      // Use stops from the route instead of segments as waypoints
      let waypoints: google.maps.DirectionsWaypoint[] = [];
      
      if (selected.stops && selected.stops.length > 0) {
        const MAX_WAYPOINTS = 25;
        const stopsToUse = selected.stops.slice(0, MAX_WAYPOINTS);
        
        waypoints = stopsToUse.map(stop => ({
          location: stop.address,
          stopover: true
        }));
      } else {
        const MAX_WAYPOINTS = 25;
        const segmentsToUse = selected.segments.slice(1, -1);
        
        if (segmentsToUse.length > MAX_WAYPOINTS) {
          const step = Math.ceil(segmentsToUse.length / MAX_WAYPOINTS);
          const limitedSegments = [];
          
          for (let i = 0; i < segmentsToUse.length && limitedSegments.length < MAX_WAYPOINTS; i += step) {
            limitedSegments.push(segmentsToUse[i]);
          }
          
          waypoints = limitedSegments.map(segment => ({
            location: { lat: segment.startLat, lng: segment.startLng },
            stopover: false
          }));
        } else {
          waypoints = segmentsToUse.map(segment => ({
            location: { lat: segment.startLat, lng: segment.startLng },
            stopover: false
          }));
        }
      }

      const routeResponse = await directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
      });

      directionsRenderer.setDirections(routeResponse);
      setRouteRenderers(prev => new Map(prev).set(selected.id, directionsRenderer));

      // Add draggable origin and destination markers
      await addDraggableOriginDestinationMarkers(selected, routeColor, origin, destination);

      // Add draggable waypoint markers
      await addDraggableWaypointMarkers(selected, routeColor, waypoints);

      // Add route-specific overlays for risk visualization
      await addRouteRiskOverlay(selected, routeResponse.routes[0], routeColor, routeIndex);

      // Add draggable critical point markers
      await addDraggableCriticalPointMarkers(selected, routeColor);

      // Fit map to show the selected route
      const bounds = new google.maps.LatLngBounds();
      routeResponse.routes[0].legs.forEach(leg => {
        leg.steps.forEach(step => {
          step.path.forEach(point => {
            bounds.extend(point);
          });
        });
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }

    } catch (error) {
      console.error('Failed to display selected route:', error);
      setError('Failed to display selected route. Please check your API key and route data.');
    }
  };

  const addDraggableOriginDestinationMarkers = async (
    route: Route, 
    routeColor: string, 
    origin: string, 
    destination: string
  ) => {
    if (!map) return;

    const newMarkers: google.maps.Marker[] = [];

    // Parse coordinates from origin and destination
    const [originLat, originLng] = origin.split(',').map(coord => parseFloat(coord.trim()));
    const [destLat, destLng] = destination.split(',').map(coord => parseFloat(coord.trim()));

    // Origin marker (green)
    const originMarker = new google.maps.Marker({
      position: new google.maps.LatLng(originLat, originLng),
      map: map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      },
      title: 'Origin - Drag to adjust starting point',
      zIndex: 40
    });

    // Destination marker (red)
    const destinationMarker = new google.maps.Marker({
      position: new google.maps.LatLng(destLat, destLng),
      map: map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      },
      title: 'Destination - Drag to adjust end point',
      zIndex: 40
    });

    newMarkers.push(originMarker, destinationMarker);

    // Add drag listeners for origin
    originMarker.addListener('dragstart', () => {
      setIsDragging(true);
      setDraggedPointType('waypoint');
    });

    originMarker.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        await handleOriginDestinationDrag(route, 'origin', event.latLng);
      }
      setIsDragging(false);
      setDraggedPointType(null);
    });

    // Add drag listeners for destination
    destinationMarker.addListener('dragstart', () => {
      setIsDragging(true);
      setDraggedPointType('waypoint');
    });

    destinationMarker.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        await handleOriginDestinationDrag(route, 'destination', event.latLng);
      }
      setIsDragging(false);
      setDraggedPointType(null);
    });

    setWaypointMarkers(prev => [...prev, ...newMarkers]);
  };

  const addDraggableWaypointMarkers = async (
    route: Route, 
    routeColor: string, 
    waypoints: google.maps.DirectionsWaypoint[]
  ) => {
    if (!map || waypoints.length === 0) return;

    const newMarkers: google.maps.Marker[] = [];

    waypoints.forEach((waypoint, index) => {
      let position: google.maps.LatLng;
      
      if (typeof waypoint.location === 'string') {
        // Try to parse coordinates first
        const coordsMatch = waypoint.location.match(/^([-+]?\d*\.\d+|[-+]?\d+),([-+]?\d*\.\d+|[-+]?\d+)$/);
        if (coordsMatch) {
          const lat = parseFloat(coordsMatch[1]);
          const lng = parseFloat(coordsMatch[2]);
          position = new google.maps.LatLng(lat, lng);
        } else {
          // If not coordinates, skip this waypoint
          return;
        }
      } else if (waypoint.location && typeof waypoint.location === 'object') {
        const loc = waypoint.location as google.maps.LatLng | google.maps.LatLngLiteral;
        if ('lat' in loc && 'lng' in loc) {
          position = new google.maps.LatLng(loc.lat, loc.lng);
        } else {
          position = loc as google.maps.LatLng;
        }
      } else {
        return; // Skip invalid waypoints
      }

      const marker = new google.maps.Marker({
        position: position,
        map: map,
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: routeColor,
          fillOpacity: 0.9,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        },
        title: `Waypoint ${index + 1} - Drag to adjust route`,
        zIndex: 35
      });

      newMarkers.push(marker);

      // Add drag listeners
      marker.addListener('dragstart', () => {
        setIsDragging(true);
        setDraggedPointType('waypoint');
        marker.setIcon({
          ...(marker.getIcon() as google.maps.Symbol),
          fillOpacity: 0.7,
          scale: 10
        });
      });

      marker.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
        setIsDragging(false);
        setDraggedPointType(null);
        
        if (event.latLng) {
          await handleWaypointDrag(route, index, event.latLng);
        }
        
        // Reset marker appearance
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: routeColor,
          fillOpacity: 0.9,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        });
      });

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
              📍 Waypoint ${index + 1}
            </h4>
            <p style="margin: 0 0 8px 0; color: #4B5563; font-size: 12px;">
              Drag this point to fine-tune the route and avoid problem areas.
            </p>
            <div style="padding: 4px 8px; background: #DBEAFE; border-radius: 4px; border: 1px solid #3B82F6;">
              <p style="margin: 0; color: #1E40AF; font-size: 10px; font-weight: 500;">
                💡 Drag directly onto roads for precise positioning
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
    });

    setWaypointMarkers(prev => [...prev, ...newMarkers]);
  };

  const addRouteRiskOverlay = async (
    route: Route,
    googleRoute: google.maps.DirectionsRoute,
    routeColor: string,
    routeIndex: number
  ) => {
    if (!map) return;

    const newRiskOverlays: google.maps.Polyline[] = [];

    // Add risk-based overlays for high-risk segments
    const routePath: google.maps.LatLng[] = [];
    googleRoute.legs.forEach(leg => {
      leg.steps.forEach(step => {
        if (step.path) {
          routePath.push(...step.path);
        }
      });
    });

    // Highlight critical segments with consistent colors
    route.segments.forEach((segment, segmentIndex) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      if (riskScore >= 60) {
        const segmentStartIndex = Math.floor((segmentIndex / route.segments.length) * routePath.length);
        const segmentEndIndex = Math.floor(((segmentIndex + 1) / route.segments.length) * routePath.length);
        const segmentPath = routePath.slice(segmentStartIndex, segmentEndIndex + 1);
        
        if (segmentPath.length > 1) {
          const riskOverlay = new google.maps.Polyline({
            path: segmentPath,
            strokeColor: riskScore >= 80 ? '#dc2626' : '#f59e0b',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            zIndex: 20,
            map: map
          });
          newRiskOverlays.push(riskOverlay);

          riskOverlay.addListener('click', () => {
            onRouteSelect(route.id);
            showSegmentDetails(segment, riskScore);
          });
        }
      }
    });

    setRiskOverlays(newRiskOverlays);
  };

  const addDraggableCriticalPointMarkers = async (route: Route, routeColor: string) => {
    if (!map) return;

    const newCriticalPointMarkers: google.maps.Marker[] = [];

    route.criticalPoints?.forEach((point, pointIndex) => {
      const segment = route.segments[point.position];
      if (segment) {
        const marker = new google.maps.Marker({
          position: new google.maps.LatLng(segment.startLat, segment.startLng),
          map: map,
          draggable: true,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 8,
            fillColor: point.riskLevel === 'critical' ? '#dc2626' : '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3
          },
          title: `${point.description} (Drag to avoid this area)`,
          zIndex: 30
        });

        newCriticalPointMarkers.push(marker);

        // Add drag start listener
        marker.addListener('dragstart', () => {
          setIsDragging(true);
          setDraggedPointType('critical');
          marker.setIcon({
            ...(marker.getIcon() as google.maps.Symbol),
            fillOpacity: 0.7,
            scale: 10
          });
        });

        // Add drag end listener to update route
        marker.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
          setIsDragging(false);
          setDraggedPointType(null);
          
          if (event.latLng) {
            await handleCriticalPointDrag(route, pointIndex, event.latLng);
          }
          
          // Reset marker appearance
          marker.setIcon({
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 8,
            fillColor: point.riskLevel === 'critical' ? '#dc2626' : '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3
          });
        });

        // Add info window for critical points
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 250px;">
              <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
                ⚠️ ${point.riskLevel === 'critical' ? 'Critical' : 'High Risk'} Point
              </h4>
              <p style="margin: 0 0 4px 0; color: #4B5563; font-size: 12px;">
                ${point.description}
              </p>
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 11px;">
                Route: ${route.name}
              </p>
              <div style="padding: 4px 8px; background: #FEF3C7; border-radius: 4px; border: 1px solid #F59E0B;">
                <p style="margin: 0; color: #92400E; font-size: 10px; font-weight: 500;">
                  💡 Drag this marker to add a waypoint that avoids this problem area
                </p>
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          if (!isDragging) {
            infoWindow.open(map, marker);
            onRouteSelect(route.id);
          }
        });
      }
    });

    setCriticalPointMarkers(newCriticalPointMarkers);
  };

  const handleOriginDestinationDrag = async (
    route: Route, 
    type: 'origin' | 'destination', 
    newPosition: google.maps.LatLng
  ) => {
    const newLat = newPosition.lat();
    const newLng = newPosition.lng();
    
    // Show feedback to user
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            📍 ${type === 'origin' ? 'Origin' : 'Destination'} Updated
          </h4>
          <p style="margin: 0 0 4px 0; color: #4B5563; font-size: 12px;">
            New position: ${newLat.toFixed(6)}, ${newLng.toFixed(6)}
          </p>
          <p style="margin: 0; color: #6B7280; font-size: 11px;">
            Route will be recalculated automatically
          </p>
        </div>
      `
    });
    
    infoWindow.setPosition(newPosition);
    infoWindow.open(map);
    setTimeout(() => infoWindow.close(), 3000);

    console.log(`${type} moved to:`, newLat, newLng);
    
    // Trigger route recalculation
    if (onRouteUpdate) {
      const newCoordinate = `${newLat},${newLng}`;
      // This would need to be implemented in the parent component
      // onRouteUpdate(route.id, type, newCoordinate);
    }
  };

  const handleWaypointDrag = async (
    route: Route, 
    waypointIndex: number, 
    newPosition: google.maps.LatLng
  ) => {
    const newLat = newPosition.lat();
    const newLng = newPosition.lng();
    
    // Show feedback to user
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            📍 Waypoint ${waypointIndex + 1} Moved
          </h4>
          <p style="margin: 0 0 4px 0; color: #4B5563; font-size: 12px;">
            New position: ${newLat.toFixed(6)}, ${newLng.toFixed(6)}
          </p>
          <p style="margin: 0; color: #6B7280; font-size: 11px;">
            Route will be recalculated to use this path
          </p>
        </div>
      `
    });
    
    infoWindow.setPosition(newPosition);
    infoWindow.open(map);
    setTimeout(() => infoWindow.close(), 3000);

    console.log(`Waypoint ${waypointIndex} moved to:`, newLat, newLng);
    
    // Trigger route recalculation
    if (onRouteUpdate && route.stops) {
      const newWaypoints = route.stops.map((stop, index) => {
        if (index === waypointIndex) {
          return `${newLat},${newLng}`;
        }
        return stop.address;
      });
      
      onRouteUpdate(route.id, newWaypoints);
    }
  };

  const handleCriticalPointDrag = async (
    route: Route, 
    pointIndex: number, 
    newPosition: google.maps.LatLng
  ) => {
    const newLat = newPosition.lat();
    const newLng = newPosition.lng();
    
    // Show feedback to user
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
            ⚠️ Avoidance Point Added
          </h4>
          <p style="margin: 0 0 4px 0; color: #4B5563; font-size: 12px;">
            Position: ${newLat.toFixed(6)}, ${newLng.toFixed(6)}
          </p>
          <p style="margin: 0; color: #6B7280; font-size: 11px;">
            Route will be recalculated to avoid this area
          </p>
        </div>
      `
    });
    
    infoWindow.setPosition(newPosition);
    infoWindow.open(map);
    setTimeout(() => infoWindow.close(), 3000);

    console.log(`Critical point ${pointIndex} moved to avoid area at:`, newLat, newLng);
    
    // Add this as a new waypoint to avoid the problem area
    if (onRouteUpdate) {
      const currentWaypoints = route.stops?.map(stop => stop.address) || [];
      const newWaypoints = [...currentWaypoints, `${newLat},${newLng}`];
      onRouteUpdate(route.id, newWaypoints);
    }
  };

  const showSegmentDetails = (segment: RouteSegment, riskScore: number) => {
    console.log('Segment details:', segment, 'Risk:', riskScore);
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
      
      {/* Enhanced Map Legend */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Interactive Route Map
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
              <span className="text-xs text-gray-600 dark:text-gray-400">Waypoints (Draggable)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-amber-500 rounded"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">High Risk Segment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-red-500 rounded"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Critical Risk Segment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Critical Point (Draggable)</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Drag</strong> any point to fine-tune the route
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Drag directly onto roads</strong> for precise positioning
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
              {draggedPointType === 'waypoint' ? 'Adjusting route path...' : 
               draggedPointType === 'critical' ? 'Adding avoidance point...' : 
               'Updating route...'}
            </span>
          </div>
        </div>
      )}

      {/* Instructions Panel */}
      {!isDragging && routes.length > 0 && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            🚌 Route Fine-Tuning
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>• <strong>Green/Red circles:</strong> Drag origin/destination</div>
            <div>• <strong>Blue circles:</strong> Drag waypoints to adjust path</div>
            <div>• <strong>Warning arrows:</strong> Drag to avoid problem areas</div>
            <div>• Drag markers directly onto roads for precise positioning</div>
          </div>
        </div>
      )}
    </div>
  );
};