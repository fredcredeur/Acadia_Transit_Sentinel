import React from 'react';
import { Route as Route2, Clock, MapPin, TrendingUp } from 'lucide-react';
import { Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';

interface RouteComparisonProps {
  routes: Route[];
  vehicle: Vehicle;
  selectedRoute: string;
  onRouteSelect: (routeId: string) => void;
}

export const RouteComparison: React.FC<RouteComparisonProps> = ({
  routes,
  vehicle,
  selectedRoute,
  onRouteSelect
}) => {
  const routesWithRisk = routes.map(route => ({
    ...route,
    calculatedRisk: RiskCalculator.calculateRouteRisk(route, vehicle)
  })).sort((a, b) => a.calculatedRisk - b.calculatedRisk);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
          <Route2 className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Comparison</h2>
      </div>

      <div className="space-y-4">
        {routesWithRisk.map((route, index) => (
          <div
            key={route.id}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedRoute === route.id
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            onClick={() => onRouteSelect(route.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {index === 0 && (
                    <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full border border-green-200 dark:border-green-700">
                      RECOMMENDED
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 dark:text-white">{route.name}</h3>
                </div>
              </div>
              <div
                className={`text-2xl font-bold ${
                  route.calculatedRisk < 40 ? 'text-green-600 dark:text-green-400' :
                  route.calculatedRisk < 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {Math.round(route.calculatedRisk)}%
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{route.totalDistance} mi</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{route.estimatedTime} min</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {RiskCalculator.getRiskLabel(route.calculatedRisk)}
                </span>
              </div>
            </div>

            {/* Risk breakdown bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${route.calculatedRisk}%`,
                  backgroundColor: RiskCalculator.getRiskColor(route.calculatedRisk)
                }}
              />
            </div>

            {/* Critical points summary */}
            {route.criticalPoints.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">{route.criticalPoints.length}</span> critical point(s):
                {route.criticalPoints.slice(0, 2).map((point, idx) => (
                  <span key={point.segmentId} className="ml-1">
                    {point.description.split(':')[0]}
                    {idx < Math.min(route.criticalPoints.length, 2) - 1 && ', '}
                  </span>
                ))}
                {route.criticalPoints.length > 2 && (
                  <span className="ml-1">+{route.criticalPoints.length - 2} more</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors duration-300">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Risk Assessment Factors</h4>
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <div>• Pedestrian traffic density and crossing patterns</div>
          <div>• Road width compatibility with vehicle dimensions</div>
          <div>• Traffic congestion and speed limit considerations</div>
          <div>• Height restrictions for bridges and overpasses</div>
          <div>• Sharp turns and intersection complexity</div>
        </div>
      </div>
    </div>
  );
};