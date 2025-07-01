import React, { useEffect, useRef, useState } from 'react';
import { Route, Vehicle, RouteSegment } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';
import { RiskCalculator } from '../utils/riskCalculator';
import { } from 'lucide-react';

interface MultiRouteMapComponentProps {
  routes: Route[];
  selectedRouteId: string;
  vehicle: Vehicle;
  onRouteSelect: (routeId: string) => void;
  className?: string;
  initialCenter?: { lat: number; lng: number };
}

export const MultiRouteMapComponent: React.FC<MultiRouteMapComponentProps> = ({
  routes,
  selectedRouteId,
  vehicle,
  onRouteSelect,
  className = '',
  initialCenter = { lat: 39.8283, lng: -98.5795 } // Default to US center
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeRenderers, setRouteRenderers] = useState<Map<string, google.maps.DirectionsRenderer>>(new Map());
  const [criticalPointMarkers, setCriticalPointMarkers] = useState<google.maps.Marker[]>([]);
  const [riskOverlays, setRiskOverlays] = useState<google.maps.Polyline[]>([]);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    // Clear all overlays when component unmounts or map changes
    return () => {
      criticalPointMarkers.forEach(marker => marker.setMap(null));
      riskOverlays.forEach(overlay => overlay.setMap(null));
    };
  }, [map, criticalPointMarkers, riskOverlays]); // Added dependencies

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
        zoom: routes.length > 0 ? 12 : 4, // Zoom in if routes are present
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

      const routeIndex = routes.findIndex(r => r.id === selectedRouteId);
      const routeColors = ['#4299E1', '#805AD5', '#38B2AC', '#ED8936', '#E53E3E']; // Example colors
      const color = routeColors[routeIndex % routeColors.length];

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
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
            fillOpacity: 1.1,
            strokeColor: '#FFFFFF',
            strokeWeight: 10
          }
        }
      });

      // Use stops from the route instead of segments as waypoints
      let waypoints: google.maps.DirectionsWaypoint[] = [];
      
      if (selected.stops && selected.stops.length > 0) {
        // Use the actual stops as waypoints, but limit to 25
        const MAX_WAYPOINTS = 25;
        const stopsToUse = selected.stops.slice(0, MAX_WAYPOINTS);
        
        waypoints = stopsToUse.map(stop => ({
          location: { lat: stop.lat, lng: stop.lng },
          stopover: true
        }));
      } else {
        // If no stops are defined, use a limited number of segments as waypoints
        const MAX_WAYPOINTS = 25;
        const segmentsToUse = selected.segments.slice(1, -1); // Exclude first and last
        
        if (segmentsToUse.length > MAX_WAYPOINTS) {
          // Take evenly distributed segments
          const step = Math.ceil(segmentsToUse.length / MAX_WAYPOINTS);
          const limitedSegments = [];
          
          for (let i = 0; i < segmentsToUse.length && limitedSegments.length < MAX_WAYPOINTS; i += step) {
            limitedSegments.push(segmentsToUse[i]);
          }
          
          waypoints = limitedSegments.map(segment => ({
            location: { lat: segment.startLat, lng: segment.startLng },
            stopover: false // Intermediate points, not necessarily stops
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

      // Add route-specific overlays for risk visualization
      await addRouteRiskOverlay(selected, routeResponse.routes[0], color, routeIndex);

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

  const addRouteRiskOverlay = async (
    route: Route,
    googleRoute: google.maps.DirectionsRoute,
    _baseColor: string,
    _routeIndex: number
  ) => {
    if (!map) return;

    const newCriticalPointMarkers: google.maps.Marker[] = [];
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
            zIndex: 20, // Fixed zIndex for selected route
            map: map
          });
          newRiskOverlays.push(riskOverlay);

          // Add click listener to risk overlay
          riskOverlay.addListener('click', () => {
            onRouteSelect(route.id);
            showSegmentDetails(segment, riskScore);
          });
        }
      }
    });

    // Add critical point markers
    route.criticalPoints?.forEach((point, _pointIndex) => {
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
        newCriticalPointMarkers.push(marker);

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

    setCriticalPointMarkers(newCriticalPointMarkers);
    setRiskOverlays(newRiskOverlays);
  };

  const showSegmentDetails = (segment: RouteSegment, riskScore: number) => {
    // This could open a detailed segment analysis panel
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
            <p className="text-gray-600 dark:text-gray-400 text-sm">Loading selected route...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      

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