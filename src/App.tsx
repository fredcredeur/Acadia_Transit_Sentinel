<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
import React, { useState, useEffect } from 'react';
import { Shield, Truck, Map, AlertTriangle } from 'lucide-react';
import { VehicleForm } from './components/VehicleForm';
import { MultiRouteMapComponent } from './components/MultiRouteMapComponent';
import { RouteComparison } from './components/RouteComparison';
import { RouteComparisonAnalytics } from './components/RouteComparisonAnalytics';
import { CriticalPoints } from './components/CriticalPoints';
import { Navigation } from 'lucide-react';
import { RiskCalculator } from './utils/riskCalculator';
import { RouteInput } from './components/RouteInput';
import { DarkModeToggle } from './components/DarkModeToggle';
import { Vehicle, Route, StopLocation } from './types';
import { EnhancedRouteAnalysisService } from './services/routeAnalysisService';
import { useDarkMode } from './hooks/useDarkMode';
import { useGeolocation } from './hooks/useGeolocation';
import { LargeVehicleAnalysisPanel, EnhancedRouteComparison, RouteSelectionHelper } from './components/LargeVehicleComponents';
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

  const handlePlanningInputChange = (origin: string, destination: string, stops: StopLocation[], loopEnabled?: boolean) => {
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
      const routeAnalysisService = new EnhancedRouteAnalysisService();
      
      let stopsToUse = planningStops || [];
      
      // Add loop stop if needed
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
      
      const isLargeVehicle = vehicle.length >= 30;
      
      console.log(`Analyzing route for ${isLargeVehicle ? 'LARGE' : 'standard'} vehicle:`, {
        origin: planningOrigin,
        destination: planningDestination, 
        stops: stopsToUse.map(s => ({ address: s.address, order: s.order })),
        vehicleLength: vehicle.length,
        isLoop
      });
      
      const result = await routeAnalysisService.analyzeRoutes({
        origin: planningOrigin,
        destination: planningDestination,
        vehicle,
        stops: stopsToUse,
        avoidHighways: false,
        avoidTolls: false,
        prioritizeSafety: isLargeVehicle,
        isLoop: isLoop
      });

      setRoutes(result.routes);
      setSelectedRouteId(result.recommendedRouteId);
      setLargeVehicleAnalysis(result.largeVehicleAnalysis);
      
      setLastAnalyzedOrigin(planningOrigin);
      setLastAnalyzedDestination(planningDestination);
      setStops(stopsToUse);
      
      // Switch to overview view after analysis
      setCurrentView('overview');
      
    } catch (err) {
      console.error('Enhanced route analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze routes. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
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
      const routeAnalysisService = new EnhancedRouteAnalysisService();
      
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
      
      const result = await routeAnalysisService.analyzeRoutes({
        origin,
        destination,
        vehicle,
        stops: stopsToUse,
        avoidHighways: false,
        avoidTolls: false,
        prioritizeSafety: isLargeVehicle,
        isLoop: useLoop
      });

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

              {/* Multi-Route Map with Draggable Points */}
              <div className="xl:col-span-3 order-1 xl:order-2">
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
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Enable Google Maps Integration</h3>
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
<<<<<<< HEAD
=======
import { useState } from 'react';
import { MapComponent } from './components/MapComponent';
import { RouteSelector } from './components/RouteSelector';
import { LocationSearch } from './components/LocationSearch';
import { RouteDetails } from './components/RouteDetails';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapProvider, useMapContext } from './contexts/MapContext';

function AppContent() {
  const { selectedRoute, setSelectedRoute } = useMapContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen}>
          <div className="space-y-4 p-4">
            <LocationSearch />
            <RouteSelector onRouteSelect={setSelectedRoute} />
            {selectedRoute && <RouteDetails route={selectedRoute} />}
          </div>
        </Sidebar>
        <main className="flex-1 relative">
          <MapComponent />
        </main>
      </div>
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
    </div>
  );
}

<<<<<<< HEAD
<<<<<<< HEAD
export default App;
=======
export default function App() {
  return (
    <MapProvider>
      <AppContent />
    </MapProvider>
  );
}
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
export default App;
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
