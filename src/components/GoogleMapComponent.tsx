import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMapsService } from '../services/googleMapsService';
import { Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';

interface GoogleMapComponentProps {
  route: Route;
  vehicle: Vehicle;
  className?: string;
  onSegmentClick?: (segmentId: string) => void;
}

export const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  route,
  vehicle,
  className = '',
  onSegmentClick
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlaysRef = useRef<(google.maps.Polyline | google.maps.Marker)[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [segmentPolylines, setSegmentPolylines] = useState<Map<string, google.maps.Polyline>>(new Map());

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
        center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Create a directions renderer for displaying the actual route
      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // We'll add our own markers
        polylineOptions: {
          strokeColor: '#9CA3AF',
          strokeOpacity: 0.6,
          strokeWeight: 4,
          zIndex: 1
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

  const clearOverlays = useCallback(() => {
    overlaysRef.current.forEach(overlay => {
      if (overlay instanceof google.maps.Marker) {
        overlay.setMap(null);
      } else if (overlay instanceof google.maps.Polyline) {
        overlay.setMap(null);
      }
    });
    overlaysRef.current = [];
    
    // Clear segment polylines map
    segmentPolylines.forEach(polyline => polyline.setMap(null));
    setSegmentPolylines(new Map());
  }, [segmentPolylines]); // Add segmentPolylines to dependencies

  const zoomToSegment = useCallback((segmentId: string) => {
    if (!map) return;

    const segment = route.segments.find(s => s.id === segmentId);
    if (!segment) return;

    // Create bounds for the segment
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(segment.startLat, segment.startLng));
    bounds.extend(new google.maps.LatLng(segment.endLat, segment.endLng));

    // Add some padding around the segment
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latPadding = (ne.lat() - sw.lat()) * 0.3;
    const lngPadding = (ne.lng() - sw.lng()) * 0.3;

    const paddedBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(sw.lat() - latPadding, sw.lng() - lngPadding),
      new google.maps.LatLng(ne.lat() + latPadding, ne.lng() + lngPadding)
    );

    // Zoom to the segment with animation
    map.fitBounds(paddedBounds, {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50
    });

    // Highlight the selected segment temporarily
    const polyline = segmentPolylines.get(segmentId);
    if (polyline) {
      const originalWeight = polyline.get('strokeWeight');
      const originalOpacity = polyline.get('strokeOpacity');
      
      // Temporarily highlight
      polyline.setOptions({
        strokeWeight: 12,
        strokeOpacity: 1,
        zIndex: 10
      });

      // Reset after 2 seconds
      setTimeout(() => {
        polyline.setOptions({
          strokeWeight: originalWeight,
          strokeOpacity: originalOpacity,
          zIndex: 2
        });
      }, 2000);
    }

    // Call the callback if provided
    onSegmentClick?.(segmentId);
  }, [map, route, segmentPolylines, onSegmentClick]); // Add dependencies

  const addCriticalPointMarkers = useCallback(() => {
    if (!map) return;

    // Add markers for critical points only
    route.criticalPoints.forEach((criticalPoint, _index) => {
      const segment = route.segments.find(s => s.id === criticalPoint.segmentId);
      if (segment) {
        const marker = new google.maps.Marker({
          position: { lat: segment.startLat, lng: segment.startLng },
          map,
          title: criticalPoint.description,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: criticalPoint.riskLevel === 'critical' ? '#DC2626' : '#F59E0B',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
            anchor: new google.maps.Point(0, 0)
          },
          zIndex: 3
        });

        overlaysRef.current.push(marker);

        // Add click listener to zoom to segment
        marker.addListener('click', () => {
          zoomToSegment(segment.id);
        });

        // Add info window for critical points
        const infoWindow = new google.maps.InfoWindow({
          content: `Critical Point: ${criticalPoint.description}`
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }
    });
  }, [map, route, zoomToSegment]); // Add dependencies

  const displayFallbackRoute = useCallback(() => {
    if (!map || !route.segments.length) return;

    console.log('Using fallback route display');

    // Create the route path from segments
    const routePath = [];
    
    // Add all segment points to create a continuous path
    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      routePath.push({ lat: segment.startLat, lng: segment.startLng });
      
      // Add the end point of the last segment
      if (i === route.segments.length - 1) {
        routePath.push({ lat: segment.endLat, lng: segment.endLng });
      }
    }

    // Create base route line (neutral color)
    const basePolyline = new google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: '#9CA3AF', // Gray color for base route
      strokeOpacity: 0.6,
      strokeWeight: 4,
      zIndex: 1
    });
    basePolyline.setMap(map);
    overlaysRef.current.push(basePolyline);

    const newSegmentPolylines = new Map<string, google.maps.Polyline>();

    // Create risk-based overlays for segments with elevated risk
    route.segments.forEach((segment, _index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      const segmentPath = [
        { lat: segment.startLat, lng: segment.startLng },
        { lat: segment.endLat, lng: segment.endLng }
      ];

      const strokeWeight = riskScore >= 40 ? 8 : 6;
      const strokeOpacity = riskScore >= 40 ? 0.9 : 0.7;

      const riskPolyline = new google.maps.Polyline({
        path: segmentPath,
        geodesic: true,
        strokeColor: RiskCalculator.getRiskColor(riskScore),
        strokeOpacity: strokeOpacity,
        strokeWeight: strokeWeight,
        zIndex: 2,
        clickable: true
      });

      riskPolyline.setMap(map);
      overlaysRef.current.push(riskPolyline);
      newSegmentPolylines.set(segment.id, riskPolyline);

      // Add click listener to zoom to segment
      riskPolyline.addListener('click', () => {
        console.log('Segment clicked:', segment.id);
        zoomToSegment(segment.id);
      });

      // Add hover effects
      riskPolyline.addListener('mouseover', () => {
        riskPolyline.setOptions({
          strokeWeight: strokeWeight + 2,
          strokeOpacity: Math.min(strokeOpacity + 0.2, 1),
          zIndex: 5
        });
        
        if (mapRef.current) {
          mapRef.current.style.cursor = 'pointer';
        }
      });

      riskPolyline.addListener('mouseout', () => {
        riskPolyline.setOptions({
          strokeWeight: strokeWeight,
          strokeOpacity: strokeOpacity,
          zIndex: 2
        });
        
        if (mapRef.current) {
          mapRef.current.style.cursor = '';
        }
      });
    });

    setSegmentPolylines(newSegmentPolylines);

    // Add critical point markers
    addCriticalPointMarkers();

    // Fit map to route bounds with padding
    const bounds = new google.maps.LatLngBounds();
    routePath.forEach(point => bounds.extend(point));
    
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50
      });
    }
  }, [map, route, vehicle, zoomToSegment, clearOverlays, addCriticalPointMarkers]); // Add dependencies

  const displayRiskOverlays = useCallback(async (googleRoute: google.maps.DirectionsRoute) => {
    if (!map) return;

    // Get the detailed path from the Google route
    const routePath: google.maps.LatLng[] = [];
    googleRoute.legs.forEach(leg => {
      leg.steps.forEach(step => {
        if (step.path) {
          routePath.push(...step.path);
        }
      });
    });

    if (routePath.length === 0) return;

    const newSegmentPolylines = new Map<string, google.maps.Polyline>();

    // Calculate risk for each segment and create overlays for high-risk areas
    route.segments.forEach((segment, _index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      // Create overlays for all segments, but make high-risk ones more prominent
      const segmentStartIndex = Math.floor((_index / route.segments.length) * routePath.length);
      const segmentEndIndex = Math.floor(((_index + 1) / route.segments.length) * routePath.length);
      
      const segmentPath = routePath.slice(segmentStartIndex, segmentEndIndex + 1);
      
      if (segmentPath.length > 1) {
        const strokeWeight = riskScore >= 40 ? 8 : 6;
        const strokeOpacity = riskScore >= 40 ? 0.9 : 0.7;
        
        const riskPolyline = new google.maps.Polyline({
          path: segmentPath,
          geodesic: true,
          strokeColor: RiskCalculator.getRiskColor(riskScore),
          strokeOpacity: strokeOpacity,
          strokeWeight: strokeWeight,
          zIndex: 2,
          clickable: true
        });

        riskPolyline.setMap(map);
        overlaysRef.current.push(riskPolyline);
        newSegmentPolylines.set(segment.id, riskPolyline);

        // Add click listener to zoom to segment
        riskPolyline.addListener('click', () => {
          console.log('Segment clicked:', segment.id);
          zoomToSegment(segment.id);
        });

        // Add hover effects
        riskPolyline.addListener('mouseover', () => {
          riskPolyline.setOptions({
            strokeWeight: strokeWeight + 2,
            strokeOpacity: Math.min(strokeOpacity + 0.2, 1),
            zIndex: 5
          });
          
          if (mapRef.current) {
            mapRef.current.style.cursor = 'pointer';
          }
        });

        riskPolyline.addListener('mouseout', () => {
          riskPolyline.setOptions({
            strokeWeight: strokeWeight,
            strokeOpacity: strokeOpacity,
            zIndex: 2
          });
          
          if (mapRef.current) {
            mapRef.current.style.cursor = '';
          }
        });

        // Add info window on click
        riskPolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div class="p-3 max-w-xs">
                  <h3 class="font-semibold text-sm mb-2">${segment.streetName}</h3>
                  <div class="space-y-1 text-xs">
                    <div class="flex justify-between">
                      <span>Risk Level:</span>
                      <span class="font-medium" style="color: ${RiskCalculator.getRiskColor(riskScore)}">
                        ${RiskCalculator.getRiskLabel(riskScore)} (${Math.round(riskScore)}%)
                      </span>
                    </div>
                    <div class="text-gray-600">${segment.description}</div>
                    ${segment.riskFactors.heightRestriction > 0 ? 
                      `<div class="text-orange-600">⚠️ Height limit: ${segment.riskFactors.heightRestriction}ft</div>` : ''
                    }
                    ${segment.riskFactors.pedestrianTraffic > 70 ? 
                      `<div class="text-blue-600">👥 Heavy pedestrian traffic</div>` : ''
                    }
                    ${segment.riskFactors.roadWidth > 60 ? 
                      `<div class="text-purple-600">🛣️ Narrow road</div>` : ''
                    }
                    <div class="mt-2 pt-2 border-t border-gray-200">
                      <div class="text-xs text-gray-500">Click to zoom to this segment</div>
                    </div>
                  </div>
                </div>
              `,
              position: event.latLng
            });
            infoWindow.open(map);
          }
        });
      }
    });

    setSegmentPolylines(newSegmentPolylines);
  }, [map, route, vehicle, zoomToSegment, addCriticalPointMarkers]); // Add dependencies

  const displayRoute = useCallback(async () => {
    if (!map || !route.segments.length) return;

    // Clear existing overlays
    clearOverlays();

    try {
      // Get the actual route from Google Maps using the first and last segment coordinates
      const firstSegment = route.segments[0];
      const lastSegment = route.segments[route.segments.length - 1];
      
      const origin = `${firstSegment.startLat},${firstSegment.startLng}`;
      const destination = `${lastSegment.endLat},${lastSegment.endLng}`;

      console.log('Fetching route for map display:', { origin, destination });

      const googleMapsService = GoogleMapsService.getInstance();
      const routeResponse = await googleMapsService.getRoutes({
        origin,
        destination,
        waypoints: route.waypoints, // ← ADD THIS LINE
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false
      });

      if (routeResponse.routes.length > 0 && directionsRenderer) {
        const googleRoute = routeResponse.routes[0];
        
        // Display the base route using DirectionsRenderer
        directionsRenderer.setDirections({
          routes: [googleRoute],
          request: {
            origin,
            destination,
            waypoints: route.waypoints?.map(waypoint => ({
              location: waypoint,
              stopover: true
            })) || [], // ← ADD THESE LINES
            travelMode: google.maps.TravelMode.DRIVING
          }
        } as google.maps.DirectionsResult);

        // Now overlay risk-based segments on top of the actual route
        await displayRiskOverlays(googleRoute);

        // Add markers for critical points
        addCriticalPointMarkers();

        // Fit map to route bounds
        const bounds = new google.maps.LatLngBounds();
        googleRoute.legs.forEach(leg => {
          leg.steps.forEach(step => {
            if (step.path) {
              step.path.forEach(point => bounds.extend(point));
            }
          });
        });
        
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50
          });
        }
      }
    } catch (error) {
      console.error('Failed to display route on map:', error);
      // Fallback to simple segment display if route fetching fails
      displayFallbackRoute();
    }
  }, [map, route, vehicle, clearOverlays, directionsRenderer, displayRiskOverlays, addCriticalPointMarkers, displayFallbackRoute]); // Add dependencies

  useEffect(() => {
    if (map && route) {
      displayRoute();
    }
  }, [map, route, vehicle, displayRoute]);

  // Cleanup overlays when component unmounts
  useEffect(() => {
    return () => {
      clearOverlays();
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }
    };
  }, [directionsRenderer, clearOverlays]);

  // Expose zoom function for external use
  useEffect(() => {
    if (map && onSegmentClick) {
      (window as Window & typeof globalThis).zoomToSegment = zoomToSegment;
    }
  }, [map, onSegmentClick, zoomToSegment]);

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-red-900 dark:text-red-200 mb-2">Map Loading Error</h3>
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <p className="text-red-600 dark:text-red-400 text-xs mt-2">
            Please ensure you have set up your Google Maps API key in the .env file
          </p>
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
            <p className="text-gray-600 dark:text-gray-400 text-sm">Loading Google Maps...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Enhanced Map Legend */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Interactive Route Risk Map</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-gray-400 rounded"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Normal Route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-amber-500 rounded"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Medium Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-red-500 rounded"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">High Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded-full border-2 border-white"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Critical Point</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Click</strong> segments or markers to zoom in
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Hover</strong> for risk details
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
