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
import { RouteAnalysisService } from './services/routeAnalysisService';
import { useDarkMode } from './hooks/useDarkMode';
import { useGeolocation } from './hooks/useGeolocation';

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * The main application component.
 *
 * This component renders the entire application and manages state between sub-components.
 * It also handles the Google Maps API key setup and demo mode.
 *
 * @returns {JSX.Element} The main application component.
 */
/*******  f1634025-fab1-4311-a8d9-d72c435e95a6  *******/
function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { coordinates: userLocation } = useGeolocation();
  
  const [vehicle, setVehicle] = useState<Vehicle>({
    height: 11.0,
    length: 40.0,
    width: 8.0
  });

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [currentView, setCurrentView] = useState<'overview' | 'details'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store the last analyzed addresses and stops
  const [lastAnalyzedOrigin, setLastAnalyzedOrigin] = useState('');
  const [lastAnalyzedDestination, setLastAnalyzedDestination] = useState('');
  const [stops, setStops] = useState<StopLocation[]>([]);
  const [initialCenter, setInitialCenter] = useState({ lat: 39.8283, lng: -98.5795 });

  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  useEffect(() => {
    if (userLocation) {
      setInitialCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation]);

  // Check if Google Maps API key is available
  useEffect(() => {
    const hasApiKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    setUseRealData(hasApiKey);
    
    if (!hasApiKey) {
      setError('Google Maps API key not configured. Using demo data.');
    }
  }, []);

  const handleStopsChange = (newStops: StopLocation[]) => {
    setStops(newStops);
  };

  const handleRouteAnalysis = async (origin: string, destination: string, stops?: StopLocation[], isLoop?: boolean) => {
  if (!useRealData) {
    setError('Google Maps integration requires API key configuration.');
    return;
  }

  setIsAnalyzing(true);
  setError(null);

  try {
    const routeAnalysisService = new RouteAnalysisService();
    
    // Use the stops parameter if provided, otherwise fall back to current state
    let stopsToUse = stops || [];

    if (isLoop) {
      // Add origin as the last stop for a loop route
      stopsToUse = [...stopsToUse, { id: 'loop-return', address: origin.trim(), order: stopsToUse.length }];
      console.log('Loop route enabled. Added origin as final stop:', origin.trim());
    }
    
    console.log('Analyzing route with:', {
      origin,
      destination, 
      stops: stopsToUse.map(s => ({ address: s.address, order: s.order }))
    });
    
    const result = await routeAnalysisService.analyzeRoutes({
      origin,
      destination,
      vehicle,
      stops: stopsToUse, // This is the key change - use the parameter
      avoidHighways: false,
      avoidTolls: false
    });

    setRoutes(result.routes);
    setSelectedRouteId(result.recommendedRouteId);
    
    // Store the successfully analyzed addresses and stops
    setLastAnalyzedOrigin(origin);
    setLastAnalyzedDestination(destination);
    
    // Update the stops state to match what was actually analyzed
    setStops(stopsToUse); // Update App.tsx's stops state with the final stops, including the loop return
    
  } catch (err) {
    console.error('Route analysis failed:', err);
    setError(err instanceof Error ? err.message : 'Failed to analyze routes. Please try again.');
  } finally {
    setIsAnalyzing(false);
  }
};

  const getRouteDisplayText = () => {
    if (!lastAnalyzedOrigin || !lastAnalyzedDestination) return '';
    
    let text = `${lastAnalyzedOrigin} → ${lastAnalyzedDestination}`;
    if (stops.length > 0) {
      text += ` (${stops.length} stop${stops.length > 1 ? 's' : ''})`;
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

        {/* Success Banner - Show when routes have been analyzed */}
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

        {currentView === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Vehicle Form and Route Input */}
            <div className="lg:col-span-1 space-y-6">
              <VehicleForm vehicle={vehicle} onChange={setVehicle} />
              {useRealData && (
                <RouteInput 
                  onRouteRequest={handleRouteAnalysis}
                  isLoading={isAnalyzing}
                  initialOrigin={lastAnalyzedOrigin}
                  initialDestination={lastAnalyzedDestination}
                  stops={stops}
                  onStopsChange={handleStopsChange}
                />
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
    {/* Route Comparison Analytics - NEW */}
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
              const routeColor = ['#4299E1', '#805AD5', '#38B2AC', '#ED8936', '#E53E3E'][index % 5];
              
              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: routeColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        Route {index + 1}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {route.totalDistance}mi • {route.estimatedTime}min
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
        </div>
      </div>

      {/* Multi-Route Map */}
      <div className="xl:col-span-2 order-1 xl:order-2">
        {routes.length > 0 ? (
          <MultiRouteMapComponent
            routes={routes}
            selectedRouteId={selectedRouteId}
            vehicle={vehicle}
            onRouteSelect={setSelectedRouteId}
            className="h-[600px] rounded-lg shadow-md"
            initialCenter={initialCenter}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300 h-[600px] flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">Enter origin and destination to analyze routes.</p>
          </div>
        )}
      </div>

      {/* Enhanced Critical Points Panel */}
      <div className="xl:col-span-1 order-3">
        <CriticalPoints route={selectedRoute} vehicle={vehicle} />
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
                <h3 className="font-semibold text-gray-900 dark:text-white">Multi-Stop Routes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Plan complex routes with multiple stops and comprehensive risk analysis</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
