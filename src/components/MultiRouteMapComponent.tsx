import React, { useEffect, useRef, useState } from 'react';
import { Route, Vehicle } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';
import { RiskCalculator } from '../utils/riskCalculator';
import { Eye, EyeOff, Navigation, Clock, AlertTriangle } from 'lucide-react';

interface MultiRouteMapComponentProps {
  routes: Route[];
  selectedRouteId: string;
  vehicle: Vehicle;
  onRouteSelect: (routeId: string) => void;
  className?: string;
}

export const MultiRouteMapComponent: React.FC<MultiRouteMapComponentProps> = ({
  routes,
  selectedRouteId,
  vehicle,
  onRouteSelect,
  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeRenderers, setRouteRenderers] = useState<Map<string, google.maps.DirectionsRenderer>>(new Map());
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [routeColors] = useState<string[]>(['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea']);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (map && routes.length > 0 && selectedRouteId) {
      displaySelectedRoute();
    }
  }, [map, routes, selectedRouteId]);

  const initializeMap = async () => {
    if (!mapRef.current) return;

    try {
      setIsLoading(true);
      const googleMapsService = GoogleMapsService.getInstance();
      await googleMapsService.initialize();

      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: 40.7128, lng: -74.0060 },
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
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

  const displaySelectedRoute = async () => {
    if (!map || !selectedRouteId) return;

    // Clear all existing renderers
    routeRenderers.forEach(renderer => renderer.setMap(null));
    setRouteRenderers(new Map());

    const selected = routes.find(r => r.id === selectedRouteId);
    if (!selected) return;

    const googleMapsService = GoogleMapsService.getInstance();

    try {
      const firstSegment = selected.segments[0];
      const lastSegment = selected.segments[selected.segments.length - 1];
      
      const origin = `${firstSegment.startLat},${firstSegment.startLng}`;
      const destination = `${lastSegment.endLat},${lastSegment.endLng}`;

      const routeResponse = await googleMapsService.getRoutes({
        origin,
        destination,
        waypoints: selected.waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false
      });

      if (routeResponse.routes.length > 0) {
        const color = routeColors[0]; // Use a consistent color for the selected route
        
        const renderer = new google.maps.DirectionsRenderer({
          suppressMarkers: false,
          draggable: false,
          polylineOptions: {
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 8,
            zIndex: 10
          },
          markerOptions: {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2
            }
          }
        });

        renderer.setMap(map);
        renderer.setDirections(routeResponse);

        // Add click listener to route polyline
        google.maps.event.addListener(renderer, 'click', () => {
          onRouteSelect(selected.id);
        });

        setRouteRenderers(prev => new Map(prev).set(selected.id, renderer));

        // Add route-specific overlays for risk visualization
        await addRouteRiskOverlays(selected, routeResponse.routes[0], color, 0);
      }

      // Fit map to show the selected route
      const bounds = new google.maps.LatLngBounds();
      selected.segments.forEach(segment => {
        bounds.extend(new google.maps.LatLng(segment.startLat, segment.startLng));
        bounds.extend(new google.maps.LatLng(segment.endLat, segment.endLng));
      });
      
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }

    } catch (error) {
      setError('Failed to display selected route. Please check your API key and route data.');
      console.error('Failed to display selected route:', error);
    }
  };

  const addRouteRiskOverlays = async (
    route: Route, 
    googleRoute: google.maps.DirectionsRoute, 
    baseColor: string,
    routeIndex: number
  ) => {
    if (!map) return;

    // Add risk-based overlays for high-risk segments
    const routePath: google.maps.LatLng[] = [];
    googleRoute.legs.forEach(leg => {
      leg.steps.forEach(step => {
        if (step.path) {
          routePath.push(...step.path);
        }
      });
    });

    // Highlight critical segments
    route.segments.forEach((segment, segmentIndex) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      if (riskScore >= 60) { // Only show high-risk overlays
        const segmentStartIndex = Math.floor((segmentIndex / route.segments.length) * routePath.length);
        const segmentEndIndex = Math.floor(((segmentIndex + 1) / route.segments.length) * routePath.length);
        const segmentPath = routePath.slice(segmentStartIndex, segmentEndIndex + 1);
        
        if (segmentPath.length > 1) {
          const riskOverlay = new google.maps.Polyline({
            path: segmentPath,
            strokeColor: riskScore >= 80 ? '#dc2626' : '#f59e0b',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            zIndex: 20 + routeIndex,
            map: map
          });

          // Add click listener to risk overlay
          riskOverlay.addListener('click', () => {
            onRouteSelect(route.id);
            showSegmentDetails(segment, riskScore);
          });
        }
      }
    });

    // Add critical point markers
    route.criticalPoints?.forEach((point, pointIndex) => {
      const segment = route.segments[point.position];
      if (segment) {
        const marker = new google.maps.Marker({
          position: new google.maps.LatLng(segment.startLat, segment.startLng),
          map: map,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: point.riskLevel === 'critical' ? '#dc2626' : '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
          },
          title: point.description,
          zIndex: 30
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
              <p style="margin: 0; color: #6B7280; font-size: 11px;">
                Route: ${route.name}
              </p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
          onRouteSelect(route.id);
        });
      }
    });
  };

  const showSegmentDetails = (segment: any, riskScore: number) => {
    // This could open a detailed segment analysis panel
    console.log('Segment details:', segment, 'Risk:', riskScore);
  };

  const toggleRouteVisibility = (routeId: string) => {
    const newVisibleRoutes = new Set(visibleRoutes);
    const renderer = routeRenderers.get(routeId);
    
    if (visibleRoutes.has(routeId)) {
      newVisibleRoutes.delete(routeId);
      renderer?.setMap(null);
    } else {
      newVisibleRoutes.add(routeId);
      renderer?.setMap(map);
    }
    
    setVisibleRoutes(newVisibleRoutes);
  };

  const updateRouteStyle = (routeId: string, isSelected: boolean) => {
    const renderer = routeRenderers.get(routeId);
    if (renderer) {
      const routeIndex = routes.findIndex(r => r.id === routeId);
      const color = routeColors[routeIndex % routeColors.length];
      
      renderer.setOptions({
        polylineOptions: {
          strokeColor: color,
          strokeOpacity: isSelected ? 1.0 : 0.6,
          strokeWeight: isSelected ? 8 : 5,
          zIndex: isSelected ? 10 : routeIndex + 1
        }
      });
    }
  };

  // No longer needed as displaySelectedRoute handles re-rendering
  // useEffect(() => {
  //   if (map && routes.length > 0) {
  //     displayAllRoutes();
  //   }
  // }, [selectedRouteId, map, routes]);

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
            <p className="text-gray-600 dark:text-gray-400 text-sm">Loading selected route...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Route Control Panel - Simplified for single route display */}
      {!isLoading && !error && routes.length > 1 && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Route Selection</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Select a route to display</p>
          </div>
          
          <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
            {routes.map((route, index) => {
              const isSelected = route.id === selectedRouteId;
              const riskScore = RiskCalculator.calculateRouteRisk(route, vehicle);
              
              return (
                <div
                  key={route.id}
                  className={`p-2 rounded-lg border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => onRouteSelect(route.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {route.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {route.totalDistance}mi • {route.estimatedTime}min
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <div className="text-right">
                        <div 
                          className="text-sm font-bold"
                          style={{ color: RiskCalculator.getRiskColor(riskScore) }}
                        >
                          {Math.round(riskScore)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Route stats when selected */}
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        <div className="text-center">
                          <div className="text-gray-500 dark:text-gray-400">Distance</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {route.totalDistance}mi
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 dark:text-gray-400">Time</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {route.estimatedTime}min
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 dark:text-gray-400">Critical</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {route.criticalPoints?.length || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Map Legend */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Route Legend
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-blue-600 rounded"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Selected Route</span>
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
              <span className="text-xs text-gray-600 dark:text-gray-400">Critical Point</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
