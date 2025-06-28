import React, { useEffect, useRef, useState } from 'react';
import { GoogleMapsService } from '../services/googleMapsService';
import { Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';

interface GoogleMapComponentProps {
  route: Route;
  vehicle: Vehicle;
  className?: string;
}

export const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  route,
  vehicle,
  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlaysRef = useRef<(google.maps.Polyline | google.maps.Marker)[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (map && route) {
      displayRoute();
    }
  }, [map, route, vehicle]);

  const initializeMap = async () => {
    if (!mapRef.current) return;

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
  };

  const clearOverlays = () => {
    overlaysRef.current.forEach(overlay => {
      if (overlay instanceof google.maps.Marker) {
        overlay.setMap(null);
      } else if (overlay instanceof google.maps.Polyline) {
        overlay.setMap(null);
      }
    });
    overlaysRef.current = [];
  };

  const displayRoute = async () => {
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
  };

  const displayRiskOverlays = async (googleRoute: google.maps.DirectionsRoute) => {
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

    // Calculate risk for each segment and create overlays for high-risk areas
    route.segments.forEach((segment, index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      // Only highlight segments with medium to high risk
      if (riskScore >= 40) {
        // Find the portion of the route path that corresponds to this segment
        const segmentStartIndex = Math.floor((index / route.segments.length) * routePath.length);
        const segmentEndIndex = Math.floor(((index + 1) / route.segments.length) * routePath.length);
        
        const segmentPath = routePath.slice(segmentStartIndex, segmentEndIndex + 1);
        
        if (segmentPath.length > 1) {
          const riskPolyline = new google.maps.Polyline({
            path: segmentPath,
            geodesic: true,
            strokeColor: RiskCalculator.getRiskColor(riskScore),
            strokeOpacity: 0.9,
            strokeWeight: 8,
            zIndex: 2 // Higher z-index to appear on top
          });

          riskPolyline.setMap(map);
          overlaysRef.current.push(riskPolyline);

          // Add click listener to show risk details
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
                    </div>
                  </div>
                `,
                position: event.latLng
              });
              infoWindow.open(map);
            }
          });
        }
      }
    });
  };

  const addCriticalPointMarkers = () => {
    if (!map) return;

    // Add markers for critical points only
    route.criticalPoints.forEach((criticalPoint, index) => {
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

        // Add info window for critical points
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="p-3 max-w-sm">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-3 h-3 rounded-full" style="background-color: ${
                  criticalPoint.riskLevel === 'critical' ? '#DC2626' : '#F59E0B'
                }"></div>
                <h3 class="font-semibold text-sm">Critical Point</h3>
              </div>
              <div class="space-y-2 text-xs">
                <div><strong>Location:</strong> ${segment.streetName}</div>
                <div><strong>Issue:</strong> ${criticalPoint.description}</div>
                <div><strong>Risk Level:</strong> 
                  <span class="font-medium ${
                    criticalPoint.riskLevel === 'critical' ? 'text-red-600' : 'text-amber-600'
                  }">
                    ${criticalPoint.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div class="mt-2 p-2 bg-gray-50 rounded text-gray-700">
                  <strong>Recommendation:</strong> Reduce speed and use extra caution when approaching this area.
                </div>
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }
    });
  };

  const displayFallbackRoute = () => {
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

    // Create risk-based overlays for segments with elevated risk
    route.segments.forEach((segment, index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      // Only highlight segments with medium to high risk
      if (riskScore >= 40) {
        const segmentPath = [
          { lat: segment.startLat, lng: segment.startLng },
          { lat: segment.endLat, lng: segment.endLng }
        ];

        const riskPolyline = new google.maps.Polyline({
          path: segmentPath,
          geodesic: true,
          strokeColor: RiskCalculator.getRiskColor(riskScore),
          strokeOpacity: 0.9,
          strokeWeight: 8,
          zIndex: 2 // Higher z-index to appear on top
        });

        riskPolyline.setMap(map);
        overlaysRef.current.push(riskPolyline);
      }
    });

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
  };

  // Cleanup overlays when component unmounts
  useEffect(() => {
    return () => {
      clearOverlays();
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }
    };
  }, [directionsRenderer]);

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
      
      {/* Map Legend */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Route Risk Legend</div>
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
              Click on colored segments or markers for details
            </p>
          </div>
        </div>
      )}
    </div>
  );
};