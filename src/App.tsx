import { useState, useEffect } from 'react';
import { Shield, Truck, Map, AlertTriangle, Navigation } from 'lucide-react';
import { VehicleForm } from './components/VehicleForm';
import { MultiRouteMapComponent } from './components/MultiRouteMapComponent';
import { RouteComparison } from './components/RouteComparison';
import { RouteComparisonAnalytics } from './components/RouteComparisonAnalytics';
import { RouteInput } from './components/RouteInput';
import { DarkModeToggle } from './components/DarkModeToggle';
import { Vehicle, Route, StopLocation, RouteSegment } from './types';
import { RouteAnalysisService } from './services/routeAnalysisService';
import { GoogleMapsService } from './services/googleMapsService';
import { useDarkMode } from './hooks/useDarkMode';
import { useGeolocation } from './hooks/useGeolocation';
import { LargeVehicleAnalysisPanel } from './components/LargeVehicleComponents';
import { PlanningMapComponent } from './components/PlanningMapComponent';
import { CriticalPoints } from './components/CriticalPoints';
import { RouteMap } from './components/RouteMap';
import { RiskCalculator } from './utils/riskCalculator';

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
  const [currentView, setCurrentView] = useState<'planning' | 'analysis'>('planning');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastAnalyzedOrigin, setLastAnalyzedOrigin] = useState('');
  const [lastAnalyzedDestination, setLastAnalyzedDestination] = useState('');
  const [stops, setStops] = useState<StopLocation[]>([]);
  const [initialCenter, setInitialCenter] = useState({ lat: 39.8283, lng: -98.5795 });
  const [isLoop, setIsLoop] = useState(true);

  const [planningOrigin, setPlanningOrigin] = useState('');
  const [planningDestination, setPlanningDestination] = useState('');
  const [planningStops, setPlanningStops] = useState<StopLocation[]>([]);
  const [planningMapReady, setPlanningMapReady] = useState(false);
  const [planningOriginCoords, setPlanningOriginCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [planningDestinationCoords, setPlanningDestinationCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const [routeFilterWarnings, setRouteFilterWarnings] = useState<string[]>([]);

  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  const generateLargeVehicleAnalysis = (vehicle: Vehicle, routes: Route[]) => {
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

  const handlePlanningInputChange = (
    origin: string,
    destination: string,
    stops?: StopLocation[],
    loopEnabled?: boolean
  ) => {
    setPlanningOrigin(origin);
    setPlanningDestination(destination);
    setPlanningStops(stops || []);
    setPlanningMapReady(true);
    setPlanningOriginCoords(undefined);
    setPlanningDestinationCoords(undefined);
    if (loopEnabled !== undefined) {
      setIsLoop(loopEnabled);
    }
  };

  const handlePlanningMapUpdate = (
    origin: string,
    destination: string,
    stops: StopLocation[],
    originCoords?: { lat: number; lng: number },
    destinationCoords?: { lat: number; lng: number }
  ) => {
    setPlanningOrigin(origin);
    setPlanningDestination(destination);
    setPlanningStops(stops || []);
    if (originCoords) setPlanningOriginCoords(originCoords);
    if (destinationCoords) setPlanningDestinationCoords(destinationCoords);
  };

  const handleAnalyzeRoutes = async () => {
    if (!planningOrigin || !planningDestination) {
      setError('Please enter both origin and destination addresses.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      setRouteFilterWarnings([]);
      let stopsToUse = planningStops || [];

      // Prepare origin/destination strings with coordinates if available
      let finalOrigin = planningOriginCoords
        ? `${planningOriginCoords.lat},${planningOriginCoords.lng}`
        : planningOrigin;
      let finalDestination = planningDestinationCoords
        ? `${planningDestinationCoords.lat},${planningDestinationCoords.lng}`
        : planningDestination;

      // Convert stops to waypoints
      let waypoints = stopsToUse.map(s =>
        s.lat !== undefined && s.lng !== undefined
          ? { location: `${s.lat},${s.lng}`, stopover: true }
          : { location: s.address, stopover: true }
      );

      // Loop route logic: destination becomes a waypoint and final destination returns to origin
      if (isLoop) {
        if (finalOrigin !== finalDestination) {
          waypoints.push({ location: finalDestination, stopover: true });
        }
        finalDestination = finalOrigin;
      }
      let analyzedRoutes: Route[] = [];
      if (useRealData) {
        const googleMapsService = GoogleMapsService.getInstance();
        await googleMapsService.initialize();
        const directionsResult = await googleMapsService.getRoutes({
          origin: finalOrigin,
          destination: finalDestination,
          waypoints,
          vehicle,
          optimizeWaypoints: false
        });
        analyzedRoutes = directionsResult.routes.map((gRoute, index) => {
          const appRoute = transformGoogleRouteToAppRoute(gRoute, index, stopsToUse);
          const { route: analyzed } = RouteAnalysisService.analyzeRouteRisk(appRoute, vehicle);
          return analyzed;
        });
        if (vehicle.length >= 30) {
          const before = analyzedRoutes.length;
          analyzedRoutes = analyzedRoutes.filter(route => {
            const suitability = RiskCalculator.isRouteSuitableForLargeVehicle(route, vehicle);
            if (!suitability.suitable) {
              setRouteFilterWarnings(prev => [...prev, `Route "${route.name}" filtered: ${suitability.prohibitedManeuvers.join(', ')}`]);
              return false;
            }
            return true;
          });
          if (before > analyzedRoutes.length) {
            setRouteFilterWarnings(prev => [...prev, `${before - analyzedRoutes.length} route(s) filtered due to prohibited maneuvers`]);
          }
        }
        analyzedRoutes.sort((a, b) => a.overallRisk - b.overallRisk);
        analyzedRoutes = analyzedRoutes.slice(0, 3);
      }
      const largeVehicleAnalysisData = generateLargeVehicleAnalysis(vehicle, analyzedRoutes);
      setRoutes(analyzedRoutes);
      setSelectedRouteId(analyzedRoutes[0]?.id || '');
      setLargeVehicleAnalysis(largeVehicleAnalysisData);
      setLastAnalyzedOrigin(planningOrigin);
      setLastAnalyzedDestination(planningDestination);
      setStops(stopsToUse);
      setCurrentView('analysis');
    } catch (err) {
      console.error('Enhanced route analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze routes. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const transformGoogleRouteToAppRoute = (
    gRoute: google.maps.DirectionsRoute,
    index: number,
    stops: StopLocation[]
  ): Route => {
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
          streetName: step.instructions.replace(/<[^>]*>/g, ' '),
          riskScore: 0,
          riskFactors: {
            pedestrianTraffic: 0,
            roadWidth: 0,
            trafficCongestion: 0,
            speedLimit: 0,
            heightRestriction: 0
          },
          description: step.instructions.replace(/<[^>]*>/g, ' '),
          intersectionType: step.instructions.toLowerCase().includes('traffic light')
            ? 'traffic_light'
            : step.instructions.toLowerCase().includes('stop sign')
            ? 'stop_sign'
            : 'none',
          turnType: step.instructions.toLowerCase().includes('turn left')
            ? 'left'
            : step.instructions.toLowerCase().includes('turn right')
            ? 'right'
            : step.instructions.toLowerCase().includes('continue straight')
            ? 'straight'
            : 'none'
        });
      });
    });
    return {
      id: `route-${index + 1}`,
      name: gRoute.summary || `Route ${index + 1}`,
      segments,
      totalDistance: Math.round((totalDistanceMeters / 1609.34) * 10) / 10,
      estimatedTime: Math.round(totalDurationSeconds / 60),
      overallRisk: 0,
      criticalPoints: [],
      stops,
      waypoints: stops.map(s => s.address)
    };
  };

  const handleRouteUpdate = async (routeId: string, newWaypoints: string[]) => {
    if (!useRealData || !lastAnalyzedOrigin || !lastAnalyzedDestination) return;
    const newStops: StopLocation[] = newWaypoints.map((waypoint, index) => ({
      id: `updated-stop-${index}`,
      address: waypoint,
      order: index,
      estimatedStopTime: 15
    }));
    await handleRouteAnalysis(lastAnalyzedOrigin, lastAnalyzedDestination, newStops, isLoop);
  };

  const handleRouteAnalysis = async (
    origin: string,
    destination: string,
    stops?: StopLocation[],
    loopEnabled?: boolean
  ) => {
    if (!useRealData) {
      setError('Google Maps integration requires API key configuration.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      let stopsToUse = stops || [];
      const useLoop = loopEnabled !== undefined ? loopEnabled : isLoop;

      let finalOrigin = origin;
      let finalDestination = destination;

      let waypoints = stopsToUse.map(s =>
        s.lat !== undefined && s.lng !== undefined
          ? { location: `${s.lat},${s.lng}`, stopover: true }
          : { location: s.address, stopover: true }
      );

      if (useLoop) {
        if (finalOrigin !== finalDestination) {
          waypoints.push({ location: finalDestination, stopover: true });
        }
        finalDestination = finalOrigin;
      }

      const googleMapsService = GoogleMapsService.getInstance();
      await googleMapsService.initialize();
      const directionsResult = await googleMapsService.getRoutes({
        origin: finalOrigin,
        destination: finalDestination,
        waypoints,
        vehicle,
        optimizeWaypoints: false
      });
      let analyzedRoutes = directionsResult.routes.map((gRoute, index) => {
        const appRoute = transformGoogleRouteToAppRoute(gRoute, index, stopsToUse);
        const { route: analyzed } = RouteAnalysisService.analyzeRouteRisk(appRoute, vehicle);
        return analyzed;
      });
      if (vehicle.length >= 30) {
        const before = analyzedRoutes.length;
        analyzedRoutes = analyzedRoutes.filter(route => {
          const suitability = RiskCalculator.isRouteSuitableForLargeVehicle(route, vehicle);
          if (!suitability.suitable) {
            setRouteFilterWarnings(prev => [...prev, `Updated route "${route.name}" filtered: ${suitability.prohibitedManeuvers.join(', ')}`]);
            return false;
          }
          return true;
        });
        if (before > analyzedRoutes.length) {
          setRouteFilterWarnings(prev => [...prev, `${before - analyzedRoutes.length} updated route(s) filtered due to prohibited maneuvers`]);
        }
      }
      analyzedRoutes.sort((a, b) => a.overallRisk - b.overallRisk);
      analyzedRoutes = analyzedRoutes.slice(0, 3);
      const result = {
        routes: analyzedRoutes,
        recommendedRouteId: analyzedRoutes[0]?.id || '',
        largeVehicleAnalysis: generateLargeVehicleAnalysis(vehicle, analyzedRoutes)
      };
      setRoutes(result.routes);
      setSelectedRouteId(result.recommendedRouteId);
      setLargeVehicleAnalysis(result.largeVehicleAnalysis);
      setLastAnalyzedOrigin(origin);
      setLastAnalyzedDestination(destination);
      setStops(stopsToUse);
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
      if (isLoop) {
        text += ` (${stops.length} stop${stops.length !== 1 ? 's' : ''} + loop)`;
      } else {
        text += ` (${stops.length} stop${stops.length > 1 ? 's' : ''})`;
      }
    }
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
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
                onClick={() => setCurrentView('analysis')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'analysis'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                disabled={routes.length === 0}
              >
                Route Analysis
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 transition-colors duration-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-800 dark:text-amber-300">{error}</span>
            </div>
          </div>
        )}

        {routeFilterWarnings.length > 0 && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 transition-colors duration-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
                {routeFilterWarnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {useRealData && lastAnalyzedOrigin && lastAnalyzedDestination && routes.length > 0 && currentView === 'analysis' && (
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

              <div className="lg:col-span-2">
                <PlanningMapComponent
                  origin={planningOrigin}
                  destination={planningDestination}
                  stops={planningStops}
                  isReady={planningMapReady}
                  onMapUpdate={handlePlanningMapUpdate}
                  className="h-[600px] rounded-lg shadow-md"
                  initialCenter={initialCenter}
                  originCoords={planningOriginCoords}
                  destinationCoords={planningDestinationCoords}
                  isLoop={isLoop}
                  showRoute={false}
                />

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
        ) : (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Route Analysis
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              <div className="xl:col-span-1 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Summary</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getRouteDisplayText() || 'No route analyzed yet'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentView('planning')}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md font-medium"
                  >
                    <Map className="w-5 h-5" />
                    New Route
                  </button>
                </div>
                {largeVehicleAnalysis && (
                  <LargeVehicleAnalysisPanel
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    vehicle={vehicle}
                    largeVehicleAnalysis={largeVehicleAnalysis}
                  />
                )}
              </div>

              <div className="xl:col-span-2 space-y-6">
                {routes.length > 0 ? (
                  <MultiRouteMapComponent
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    vehicle={vehicle}
                    onRouteSelect={setSelectedRouteId}
                    className="h-[600px] rounded-lg shadow-md"
                    initialCenter={initialCenter}
                    allowEditing={false}
                  />
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300 h-[600px] flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400">Enter origin and destination to analyze routes.</p>
                  </div>
                )}
                <RouteComparison
                  routes={routes}
                  vehicle={vehicle}
                  selectedRoute={selectedRouteId}
                  onRouteSelect={setSelectedRouteId}
                />
              </div>

              <div className="xl:col-span-1 space-y-6">
                <RouteComparisonAnalytics
                  routes={routes}
                  selectedRouteId={selectedRouteId}
                  vehicle={vehicle}
                  onRouteSelect={setSelectedRouteId}
                />
                <CriticalPoints route={selectedRoute} vehicle={vehicle} />
                {selectedRoute && (
                  <RouteMap route={selectedRoute} vehicle={vehicle} useGoogleMaps={useRealData} />
                )}
              </div>
            </div>
          </div>
        )}

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
                <li>
                  Get a Google Maps API key from{' '}
                  <a
                    href="https://console.cloud.google.com/google/maps-apis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                  >
                    Google Cloud Console
                  </a>
                </li>
                <li>Enable the following APIs: Maps JavaScript API, Routes API, Roads API, Places API</li>
                <li>Copy the .env.example file to .env and add your API key</li>
                <li>Restart the development server</li>
              </ol>
              <p className="text-sm mt-3 text-blue-700 dark:text-blue-300">
                Currently showing demo data with simulated risk calculations.
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Real-Time Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Integration with Google Maps APIs for live traffic and road conditions
                </p>
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
