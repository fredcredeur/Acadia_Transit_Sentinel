import { useState, useEffect } from 'react';
import { Shield, Truck, Map, AlertTriangle } from 'lucide-react';
import { VehicleForm } from './components/VehicleForm';
import { MultiRouteMapComponent } from './components/MultiRouteMapComponent';
import { RouteComparison } from './components/RouteComparison';
import { RouteComparisonAnalytics } from './components/RouteComparisonAnalytics';
import { Navigation } from 'lucide-react';
import { RiskCalculator } from './utils/riskCalculator';
import { RouteInput } from './components/RouteInput';
import { DarkModeToggle } from './components/DarkModeToggle';
import { Vehicle, Route, StopLocation, RouteSegment } from './types';
import { RouteAnalysisService } from './services/routeAnalysisService';
import { GoogleMapsService } from './services/googleMapsService';
import { useDarkMode } from './hooks/useDarkMode';
import { useGeolocation } from './hooks/useGeolocation';
import { LargeVehicleAnalysisPanel } from './components/LargeVehicleComponents';
import { RouteColorManager } from './utils/routeColors';
import { PlanningMapComponent } from './components/PlanningMapComponent';

function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { coordinates: userLocation } = useGeolocation();
  
  const [vehicle, setVehicle] = useState<Vehicle>({
    height: 11.0,
    length: 40.0,
    width: 8.0
  });

  const [largeVehicleAnalysis, setLargeVehicleAnalysis] = useState<{
    stopSignCount: number;
    trafficLightCount: number;
    safetyRecommendations: string[];
    alternativeRouteSuggested: boolean;
  } | undefined>(undefined);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [currentView, setCurrentView] = useState<'planning' | 'overview' | 'details'>('planning');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [lastAnalyzedOrigin, setLastAnalyzedOrigin] = useState('');
  const [lastAnalyzedDestination, setLastAnalyzedDestination] = useState('');
  const [stops, setStops] = useState<StopLocation[]>([]);
  const [initialCenter, setInitialCenter] = useState({ lat: 39.8283, lng: -98.5795 });
  const [isLoop, setIsLoop] = useState(false);

  // New state for planning map
  const [planningOrigin, setPlanningOrigin] = useState('');
  const [planningDestination, setPlanningDestination] = useState('');
  const [planningStops, setPlanningStops] = useState<StopLocation[]>([]);
  const [planningMapReady, setPlanningMapReady] = useState(false);

  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  // Helper functions for mock data generation
  const createMockRoutes = (origin: string, destination: string, vehicle: Vehicle, stops: StopLocation[], isLoop: boolean): Route[] => {
    const baseDistance = 10 + Math.random() * 20; // 10-30 miles
    const routes: Route[] = [];

    // Safest Route
    const safestRoute: Route = {
      id: `route-safest`,
      name: `Safest route to ${destination}`,
      segments: createMockSegments(origin, destination, 7, 'safest'), // More segments for potentially longer, safer route
      totalDistance: baseDistance + 5 + Math.random() * 5,
      estimatedTime: (baseDistance + 5) * 2.5 + stops.length * 5 + Math.random() * 10,
      overallRisk: 20 + Math.random() * 10, // Lower risk
      criticalPoints: [],
      stops: stops,
      waypoints: stops.map(stop => stop.address)
    };
    routes.push(safestRoute);

    // Fastest Route
    const fastestRoute: Route = {
      id: `route-fastest`,
      name: `Fastest route to ${destination}`,
      segments: createMockSegments(origin, destination, 5, 'fastest'),
      totalDistance: baseDistance + Math.random() * 5,
      estimatedTime: (baseDistance) * 2.5 + stops.length * 5 + Math.random() * 5,
      overallRisk: 50 + Math.random() * 20, // Higher risk
      criticalPoints: [],
      stops: stops,
      waypoints: stops.map(stop => stop.address)
    };
    routes.push(fastestRoute);

    // Balanced Route
    const balancedRoute: Route = {
      id: `route-balanced`,
      name: `Balanced route to ${destination}`,
      segments: createMockSegments(origin, destination, 6, 'balanced'),
      totalDistance: baseDistance + 2 + Math.random() * 5,
      estimatedTime: (baseDistance + 2) * 2.5 + stops.length * 5 + Math.random() * 5,
      overallRisk: 35 + Math.random() * 15, // Medium risk
      criticalPoints: [],
      stops: stops,
      waypoints: stops.map(stop => stop.address)
    };
    routes.push(balancedRoute);

    return routes;
  };

  const createMockSegments = (origin: string, destination: string, count: number, routeType: 'safest' | 'fastest' | 'balanced'): RouteSegment[] => {
    const segments: RouteSegment[] = [];
    const originStreet = origin.split(',')[0] || 'Origin St';
    const destinationStreet = destination.split(',')[0] || 'Destination Ave';

    for (let i = 0; i < count; i++) {
      let intersectionType: 'stop_sign' | 'traffic_light' | 'none' = 'none';
      let turnType: 'left' | 'right' | 'straight' | 'none' = 'straight';
      let riskScore = Math.random() * 100;

      if (i < count - 1) { // Not the last segment
        if (routeType === 'safest') {
          // Prioritize traffic lights and straight/right turns
          intersectionType = Math.random() < 0.7 ? 'traffic_light' : 'stop_sign';
          turnType = Math.random() < 0.8 ? 'straight' : (Math.random() < 0.5 ? 'right' : 'left');
          if (intersectionType === 'stop_sign' && turnType === 'left') {
            riskScore += 30; // Penalize left turns at stop signs
          } else if (intersectionType === 'traffic_light') {
            riskScore -= 20; // Reward traffic lights
          }
        } else if (routeType === 'fastest') {
          // Less concern for intersection type, focus on speed
          intersectionType = Math.random() < 0.5 ? 'traffic_light' : 'stop_sign';
          turnType = Math.random() < 0.6 ? 'straight' : (Math.random() < 0.5 ? 'right' : 'left');
        } else { // balanced
          intersectionType = Math.random() < 0.6 ? 'traffic_light' : 'stop_sign';
          turnType = Math.random() < 0.7 ? 'straight' : (Math.random() < 0.5 ? 'right' : 'left');
        }
      }

      segments.push({
        id: `segment-${i}`,
        startLat: 30.2241 + (i * 0.01),
        startLng: -92.0198 + (i * 0.01),
        endLat: 30.2241 + ((i + 1) * 0.01),
        endLng: -92.0198 + ((i + 1) * 0.01),
        streetName: i === 0 ? originStreet : (i === count - 1 ? destinationStreet : `Connecting Street ${i}`),
        riskScore: Math.max(0, Math.min(100, riskScore)), // Ensure riskScore is between 0 and 100
        riskFactors: {
          pedestrianTraffic: Math.random() * 100,
          roadWidth: Math.random() * 100,
          trafficCongestion: Math.random() * 100,
          speedLimit: 25 + Math.random() * 30,
          heightRestriction: 0
        },
        description: `Segment from ${originStreet} towards ${destinationStreet}`,
        intersectionType,
        turnType,
      });
    }

    return segments;
  };

  const generateMockLargeVehicleAnalysis = (vehicle: Vehicle, routes: Route[]) => {
    const isLargeVehicle = vehicle.length >= 30;
    
    if (!isLargeVehicle) return undefined;
    
    return {
      stopSignCount: Math.floor(Math.random() * 5) + 1,
      trafficLightCount: Math.floor(Math.random() * 8) + 2,
      safetyRecommendations: [
        'Use extra caution at intersections due to vehicle size',
        'Allow additional stopping distance',
        'Check for height restrictions on bridges'
      ],
      alternativeRouteSuggested: Math.random() > 0.5
    };
  };

  useEffect(() => {
    if (userLocation) {
      setInitialCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation]);

  useEffect(() => {
    const hasApiKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    setUseRealData(hasApiKey);
    
    if (!hasApiKey) {
      setError('Google Maps API key not configured. Using demo data.');
    }
  }, []);

  const handleStopsChange = (newStops: StopLocation[]) => {
    if (currentView === 'planning') {
      setPlanningStops(newStops);
    } else {
      setStops(newStops);
    }
  };

  const handlePlanningInputChange = (origin: string, destination: string, stops?: StopLocation[], loopEnabled?: boolean) => {
    setPlanningOrigin(origin);
    setPlanningDestination(destination);
    setPlanningStops(stops || []); // Ensure stops is always an array
    setPlanningMapReady(true);
    
    // Update loop state if provided
    if (loopEnabled !== undefined) {
      setIsLoop(loopEnabled);
    }
  };

  const handlePlanningMapUpdate = (origin: string, destination: string, stops: StopLocation[]) => {
    setPlanningOrigin(origin);
    setPlanningDestination(destination);
    setPlanningStops(stops || []); // Ensure stops is always an array
  };

  const handleAnalyzeRoutes = async () => {
    if (!planningOrigin || !planningDestination) {
      setError('Please enter both origin and destination addresses.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      let stopsToUse = planningStops || [];
      if (isLoop && planningOrigin) {
        const loopStop: StopLocation = {
          id: 'loop-return',
          address: planningOrigin.trim(),
          order: stopsToUse.length,
          estimatedStopTime: 5,
          name: 'Return to Start'
        };
        stopsToUse = [...stopsToUse, loopStop];
      }

      let analyzedRoutes: Route[] = [];
      if (useRealData) {
        const googleMapsService = GoogleMapsService.getInstance();
        await googleMapsService.initialize();
        
        const waypoints = stopsToUse.map(s => s.address);
        const directionsResult = await googleMapsService.getRoutes({
          origin: planningOrigin,
          destination: planningDestination,
          waypoints: waypoints,
        });

        const transformedRoutes = directionsResult.routes.map((gRoute, index) =>
          transformGoogleRouteToAppRoute(gRoute, index, stopsToUse)
        );

        analyzedRoutes = transformedRoutes.map(route => {
          const { route: analyzed } = RouteAnalysisService.analyzeRouteRisk(route, vehicle);
          return analyzed;
        });

      } else {
        // Fallback to mock data
        analyzedRoutes = createMockRoutes(planningOrigin, planningDestination, vehicle, stopsToUse, isLoop);
      }
      
      const largeVehicleAnalysisData = generateMockLargeVehicleAnalysis(vehicle, analyzedRoutes);

      setRoutes(analyzedRoutes);
      setSelectedRouteId(analyzedRoutes[0]?.id || '');
      setLargeVehicleAnalysis(largeVehicleAnalysisData);
      setLastAnalyzedOrigin(planningOrigin);
      setLastAnalyzedDestination(planningDestination);
      setStops(stopsToUse);
      setCurrentView('overview');

    } catch (err) {
      console.error('Enhanced route analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze routes. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const transformGoogleRouteToAppRoute = (gRoute: google.maps.DirectionsRoute, index: number, stops: StopLocation[]): Route => {
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    const segments: RouteSegment[] = [];

    gRoute.legs.forEach(leg => {
      totalDistanceMeters += leg.distance?.value || 0;
      totalDurationSeconds += leg.duration?.value || 0;
      leg.steps.forEach((step, stepIndex) => {
        segments.push({
          id: `segment-${index}-${leg.start_address}-${stepIndex}`,
          startLat: step.start_location.lat(),
          startLng: step.start_location.lng(),
          endLat: step.end_location.lat(),
          endLng: step.end_location.lng(),
          streetName: step.instructions.replace(/<[^>]*>/g, " "), // Basic cleaning
          riskScore: 0, // To be calculated
          riskFactors: {
            pedestrianTraffic: 0,
            roadWidth: 0,
            trafficCongestion: 0,
            speedLimit: 0,
            heightRestriction: 0
          },
          description: step.instructions.replace(/<[^>]*>/g, " "),
          intersectionType: step.instructions.toLowerCase().includes('traffic light') ? 'traffic_light' : (step.instructions.toLowerCase().includes('stop sign') ? 'stop_sign' : 'none'),
          turnType: step.instructions.toLowerCase().includes('turn left') ? 'left' : (step.instructions.toLowerCase().includes('turn right') ? 'right' : (step.instructions.toLowerCase().includes('continue straight') ? 'straight' : 'none')),
        });
      });
    });

    return {
      id: `route-${index + 1}`,
      name: gRoute.summary || `Route ${index + 1}`,
      segments: segments,
      totalDistance: totalDistanceMeters / 1609.34, // Convert to miles
      estimatedTime: totalDurationSeconds / 60, // Convert to minutes
      overallRisk: 0, // To be calculated
      criticalPoints: [],
      stops: stops,
      waypoints: stops.map(s => s.address),
    };
  };

  const handleRouteUpdate = async (routeId: string, newWaypoints: string[]) => {
    if (!useRealData || !lastAnalyzedOrigin || !lastAnalyzedDestination) return;

    console.log('🔄 Updating route with new waypoints:', newWaypoints);
    
    // Convert waypoints back to stops format
    const newStops: StopLocation[] = newWaypoints.map((waypoint, index) => ({
      id: `updated-stop-${index}`,
      address: waypoint,
      order: index,
      estimatedStopTime: 15
    }));

    // Re-analyze the route with new waypoints
    await handleRouteAnalysis(lastAnalyzedOrigin, lastAnalyzedDestination, newStops, isLoop);
  };

  const handleRouteAnalysis = async (origin: string, destination: string, stops?: StopLocation[], loopEnabled?: boolean) => {
    if (!useRealData) {
      setError('Google Maps integration requires API key configuration.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      let stopsToUse = stops || [];
      
      // Use the provided loop parameter if available, otherwise use the current state
      const useLoop = loopEnabled !== undefined ? loopEnabled : isLoop;
      
      // Add loop stop if needed
      if (useLoop && origin) {
        const loopStop: StopLocation = {
          id: 'loop-return',
          address: origin.trim(),
          order: stopsToUse.length,
          estimatedStopTime: 5,
          name: 'Return to Start'
        };
        
        // Check if we already have a loop stop
        const hasLoopStop = stopsToUse.some(stop => stop.id === 'loop-return');
        
        if (!hasLoopStop) {
          stopsToUse = [...stopsToUse, loopStop];
        }
      }
      
      const isLargeVehicle = vehicle.length >= 30;
      
      console.log(`Analyzing route for ${isLargeVehicle ? 'LARGE' : 'standard'} vehicle:`, {
        origin,
        destination, 
        stops: stopsToUse.map(s => ({ address: s.address, order: s.order })),
        vehicleLength: vehicle.length,
        isLoop: useLoop
      });
      
      // Create mock routes using helper functions
      const mockRoutes = createMockRoutes(origin, destination, vehicle, stopsToUse, useLoop);
      const result = {
        routes: mockRoutes,
        recommendedRouteId: mockRoutes[0]?.id || '',
        largeVehicleAnalysis: generateMockLargeVehicleAnalysis(vehicle, mockRoutes)
      };

      setRoutes(result.routes);
      setSelectedRouteId(result.recommendedRouteId);
      setLargeVehicleAnalysis(result.largeVehicleAnalysis);
      
      setLastAnalyzedOrigin(origin);
      setLastAnalyzedDestination(destination);
      setStops(stopsToUse);
      
      // Update loop state to match what was used
      if (loopEnabled !== undefined) {
        setIsLoop(loopEnabled);
      }
      
    } catch (err) {
      console.error('Enhanced route analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze routes. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRouteDisplayText = () => {
    if (!lastAnalyzedOrigin || !lastAnalyzedDestination) return '';
    
    let text = `${lastAnalyzedOrigin} → ${lastAnalyzedDestination}`;
    if (stops.length > 0) {
      const isLoopRoute = stops.some(stop => stop.id === 'loop-return');
      if (isLoopRoute) {
        const regularStops = stops.filter(stop => stop.id !== 'loop-return');
        text += ` (${regularStops.length} stop${regularStops.length !== 1 ? 's' : ''} + loop)`;
      } else {
        text += ` (${stops.length} stop${stops.length > 1 ? 's' : ''})`;
      }
    }
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-md">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Acadia Transit Sentinel</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Advanced Vehicle Route Risk Assessment</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DarkModeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
              {!useRealData && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm border border-amber-200 dark:border-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  Demo Mode
                </div>
              )}
              <button
                onClick={() => setCurrentView('planning')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'planning'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Route Planning
              </button>
              <button
                onClick={() => setCurrentView('overview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'overview'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setCurrentView('details')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'details'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Route Details
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 transition-colors duration-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-800 dark:text-amber-300">{error}</span>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {useRealData && lastAnalyzedOrigin && lastAnalyzedDestination && routes.length > 0 && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 transition-colors duration-300">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-300">
                Route analysis completed for: <strong>{getRouteDisplayText()}</strong>
              </span>
            </div>
          </div>
        )}

        {currentView === 'planning' ? (
          <div className="space-y-8">
            {/* Planning View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Vehicle Form and Route Input */}
              <div className="lg:col-span-1 space-y-6">
                <VehicleForm vehicle={vehicle} onChange={setVehicle} />
                {useRealData && (
                  <RouteInput 
                    onRouteRequest={handlePlanningInputChange}
                    isLoading={isAnalyzing}
                    initialOrigin={planningOrigin}
                    initialDestination={planningDestination}
                    stops={planningStops}
                    onStopsChange={handleStopsChange}
                    onLoopChange={setIsLoop}
                    isLoop={isLoop}
                  />
                )}
              </div>

              {/* Right Column - Planning Map */}
              <div className="lg:col-span-2">
                <PlanningMapComponent
                  origin={planningOrigin}
                  destination={planningDestination}
                  stops={planningStops}
                  isReady={planningMapReady}
                  onMapUpdate={handlePlanningMapUpdate}
                  className="h-[600px] rounded-lg shadow-md"
                  initialCenter={initialCenter}
                  isLoop={isLoop}
                />
                
                {/* Analyze Button */}
                {planningMapReady && (
                  <div className="mt-4">
                    <button
                      onClick={handleAnalyzeRoutes}
                      disabled={!planningOrigin || !planningDestination || isAnalyzing}
                      className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md font-medium"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Analyzing Routes...
                        </>
                      ) : (
                        <>
                          <Navigation className="w-5 h-5" />
                          Analyze Routes
                          {isLoop && <span className="ml-1">(Loop Enabled)</span>}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : currentView === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Vehicle Form and Route Input */}
            <div className="lg:col-span-1 space-y-6">
              <VehicleForm vehicle={vehicle} onChange={setVehicle} />
              {useRealData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Summary</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getRouteDisplayText() || "No route analyzed yet"}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setCurrentView('planning')}
                    className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md font-medium"
                  >
                    <Map className="w-5 h-5" />
                    Return to Planning
                  </button>
                </div>
              )}
            </div>

            {/* Right Column - Route Comparison */}
            <div className="lg:col-span-2">
              <RouteComparison
                routes={routes}
                vehicle={vehicle}
                selectedRoute={selectedRouteId}
                onRouteSelect={setSelectedRouteId}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Route Comparison Analytics */}
            <RouteComparisonAnalytics
              routes={routes}
              selectedRouteId={selectedRouteId}
              vehicle={vehicle}
              onRouteSelect={setSelectedRouteId}
            />

            {/* Main Route Details Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {/* Route Selection Panel */}
              <div className="xl:col-span-1 order-2 xl:order-1">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                      <Navigation className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Route Selection</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {routes.length} route{routes.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>

                  {/* Quick Route Selector */}
                  <div className="space-y-2">
                    {routes.map((route, index) => {
                      const isSelected = route.id === selectedRouteId;
                      const riskScore = RiskCalculator.calculateRouteRisk(route, vehicle);
                      const routeColor = RouteColorManager.getRouteColor(index);
                      
                      return (
                        <button
                          key={route.id}
                          onClick={() => setSelectedRouteId(route.id)}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            isSelected 
                              ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: routeColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">
                                {route.name}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {route.totalDistance.toFixed(1)}mi • {Math.round(route.estimatedTime)}min
                              </div>
                            </div>
                            <div className="text-right">
                              <div 
                                className="text-lg font-bold"
                                style={{ color: RiskCalculator.getRiskColor(riskScore) }}
                              >
                                {Math.round(riskScore)}%
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Actions */}
                  {routes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Quick Actions:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            const safestRoute = routes.reduce((best, current) => {
                              const currentRisk = RiskCalculator.calculateRouteRisk(current, vehicle);
                              const bestRisk = RiskCalculator.calculateRouteRisk(best, vehicle);
                              return currentRisk < bestRisk ? current : best;
                            });
                            setSelectedRouteId(safestRoute.id);
                          }}
                          className="px-3 py-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          🛡️ Safest
                        </button>
                        <button 
                          onClick={() => {
                            const fastestRoute = routes.reduce((best, current) => 
                              current.estimatedTime < best.estimatedTime ? current : best
                            );
                            setSelectedRouteId(fastestRoute.id);
                          }}
                          className="px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          ⚡ Fastest
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Large Vehicle Analysis Panel */}
              {largeVehicleAnalysis && (
                <div className="xl:col-span-1 order-1 xl:order-2">
                  <LargeVehicleAnalysisPanel
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    vehicle={vehicle}
                    largeVehicleAnalysis={largeVehicleAnalysis}
                  />
                </div>
              )}

              {/* Multi-Route Map with Draggable Points */}
              <div className="xl:col-span-2 order-3 xl:order-3">
                {routes.length > 0 ? (
                  <MultiRouteMapComponent
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    vehicle={vehicle}
                    onRouteSelect={setSelectedRouteId}
                    onRouteUpdate={handleRouteUpdate}
                    className="h-[600px] rounded-lg shadow-md"
                    initialCenter={initialCenter}
                  />
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300 h-[600px] flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400">Enter origin and destination to analyze routes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        {!useRealData && (
          <div className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-md p-6 border border-blue-100 dark:border-blue-800 transition-colors duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Map className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Enable Google Maps Integration</h3>
            </div>
            <div className="text-blue-800 dark:text-blue-200 space-y-2">
              <p>To use real Google Maps data and route analysis:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Get a Google Maps API key from the <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-300 transition-colors">Google Cloud Console</a></li>
                <li>Enable the following APIs: Maps JavaScript API, Routes API, Roads API, Places API</li>
                <li>Copy the .env.example file to .env and add your API key</li>
                <li>Restart the development server</li>
              </ol>
              <p className="text-sm mt-3 text-blue-700 dark:text-blue-300">Currently showing demo data with simulated risk calculations.</p>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Real-Time Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Integration with Google Maps APIs for live traffic and road conditions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Truck className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Vehicle-Specific</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Risk assessment tailored to your vehicle's exact dimensions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Interactive Maps</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Drag critical points to fine-tune routes and avoid problem areas</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;