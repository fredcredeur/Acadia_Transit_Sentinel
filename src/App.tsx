import React, { useState, useEffect } from 'react';
import { Shield, Truck, Map, AlertTriangle } from 'lucide-react';
import { VehicleForm } from './components/VehicleForm';
import { RouteMap } from './components/RouteMap';
import { RouteComparison } from './components/RouteComparison';
import { CriticalPoints } from './components/CriticalPoints';
import { RouteInput } from './components/RouteInput';
import { DarkModeToggle } from './components/DarkModeToggle';
import { Vehicle, Route, StopLocation } from './types';
import { mockRoutes } from './data/mockRoutes';
import { RouteAnalysisService } from './services/routeAnalysisService';
import { useDarkMode } from './hooks/useDarkMode';

function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  const [vehicle, setVehicle] = useState<Vehicle>({
    height: 11.0,
    length: 24.0,
    width: 8.0
  });

  const [routes, setRoutes] = useState<Route[]>(mockRoutes);
  const [selectedRouteId, setSelectedRouteId] = useState(mockRoutes[0].id);
  const [currentView, setCurrentView] = useState<'overview' | 'details'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store the last analyzed addresses and stops
  const [lastAnalyzedOrigin, setLastAnalyzedOrigin] = useState('');
  const [lastAnalyzedDestination, setLastAnalyzedDestination] = useState('');
  const [lastAnalyzedStops, setLastAnalyzedStops] = useState<StopLocation[]>([]);

  const selectedRoute = routes.find(route => route.id === selectedRouteId) || routes[0];

  // Check if Google Maps API key is available
  useEffect(() => {
    const hasApiKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    setUseRealData(hasApiKey);
    
    if (!hasApiKey) {
      setError('Google Maps API key not configured. Using demo data.');
    }
  }, []);

  const handleRouteAnalysis = async (origin: string, destination: string, stops?: StopLocation[]) => {
    if (!useRealData) {
      setError('Google Maps integration requires API key configuration.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const routeAnalysisService = new RouteAnalysisService();
      const result = await routeAnalysisService.analyzeRoutes({
        origin,
        destination,
        vehicle,
        stops,
        avoidHighways: false,
        avoidTolls: false
      });

      setRoutes(result.routes);
      setSelectedRouteId(result.recommendedRouteId);
      setCurrentView('details'); // Switch to details view to show the route
      
      // Store the successfully analyzed addresses and stops
      setLastAnalyzedOrigin(origin);
      setLastAnalyzedDestination(destination);
      setLastAnalyzedStops(stops || []);
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
    if (lastAnalyzedStops.length > 0) {
      text += ` (${lastAnalyzedStops.length} stop${lastAnalyzedStops.length > 1 ? 's' : ''})`;
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
        {useRealData && lastAnalyzedOrigin && lastAnalyzedDestination && routes.length > 0 && routes !== mockRoutes && (
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Main Content - Route Map */}
            <div className="xl:col-span-2">
              <RouteMap 
                route={selectedRoute} 
                vehicle={vehicle}
                useGoogleMaps={useRealData}
              />
            </div>

            {/* Side Panel - Critical Points */}
            <div className="xl:col-span-1">
              <CriticalPoints route={selectedRoute} vehicle={vehicle} />
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