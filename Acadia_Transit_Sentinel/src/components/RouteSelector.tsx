import { useState, useEffect } from 'react';
import { Route } from '../types';
import { useMapContext } from '../contexts/MapContext';
import { mockRoutes } from '../data/mockRoutes';
import { Clock, Navigation, AlertTriangle } from 'lucide-react';

interface RouteSelectorProps {
  onRouteSelect: (route: Route | null) => void;
}

export function RouteSelector({ onRouteSelect }: RouteSelectorProps) {
  const { origin, destination } = useMapContext();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (origin && destination) {
      setLoading(true);
      
      // Simulate API call to get routes
      setTimeout(() => {
        setRoutes(mockRoutes);
        setLoading(false);
      }, 1000);
    } else {
      setRoutes([]);
    }
  }, [origin, destination]);

  if (!origin || !destination) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Available Routes</h2>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">Finding routes...</span>
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Available Routes</h2>
        <div className="text-center py-6 text-gray-500">
          <p>No routes found between these locations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Available Routes</h2>
      <div className="space-y-3">
        {routes.map((route) => (
          <button
            key={route.id}
            className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={() => onRouteSelect(route)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{route.name}</h3>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{Math.round(route.duration / 60)} min</span>
                  <span className="mx-2">•</span>
                  <Navigation className="h-4 w-4 mr-1" />
                  <span>{(route.distance / 1000).toFixed(1)} km</span>
                </div>
              </div>
              
              {route.riskScore !== undefined && (
                <div className={`
                  flex items-center px-2 py-1 rounded-full text-xs font-medium
                  ${route.riskScore < 30 ? 'bg-green-100 text-green-800' : 
                    route.riskScore < 70 ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'}
                `}>
                  {route.riskScore < 30 ? (
                    <span>Low Risk</span>
                  ) : route.riskScore < 70 ? (
                    <span>Medium Risk</span>
                  ) : (
                    <span className="flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      High Risk
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}