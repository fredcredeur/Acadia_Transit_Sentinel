import React from 'react';
import { Route as Route2, Clock, MapPin, TrendingUp, AlertTriangle, Navigation, Users, Truck } from 'lucide-react';
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
  const routesWithAnalysis = RiskCalculator.compareRoutes(routes, vehicle);

  const isBusLength = vehicle.length >= 35 && vehicle.length <= 45;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
          <Route2 className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Comparison</h2>
          {isBusLength && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Optimized for 40ft bus operations
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {routesWithAnalysis.map((route, index) => (
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
              <div className="text-right">
                <div
                  className="text-2xl font-bold"
                  style={{ color: RiskCalculator.getRiskColor(route.overallRisk) }}
                >
                  {Math.round(route.overallRisk)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {RiskCalculator.getRiskLabel(route.overallRisk)}
                </div>
              </div>
            </div>

            {/* Basic route info */}
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
                  Efficiency: {Math.round(route.timeVsRiskRatio * 10) / 10}
                </span>
              </div>
            </div>

            {/* Risk breakdown bars */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Risk Breakdown:</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Pedestrian</span>
                    <span className="font-medium">{Math.round(route.riskBreakdown.pedestrianRisk)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${route.riskBreakdown.pedestrianRisk}%`,
                        backgroundColor: RiskCalculator.getRiskColor(route.riskBreakdown.pedestrianRisk)
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Maneuvering</span>
                    <span className="font-medium">{Math.round(route.riskBreakdown.maneuveringRisk)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${route.riskBreakdown.maneuveringRisk}%`,
                        backgroundColor: RiskCalculator.getRiskColor(route.riskBreakdown.maneuveringRisk)
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Infrastructure</span>
                    <span className="font-medium">{Math.round(route.riskBreakdown.infrastructureRisk)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${route.riskBreakdown.infrastructureRisk}%`,
                        backgroundColor: RiskCalculator.getRiskColor(route.riskBreakdown.infrastructureRisk)
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Traffic</span>
                    <span className="font-medium">{Math.round(route.riskBreakdown.trafficRisk)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${route.riskBreakdown.trafficRisk}%`,
                        backgroundColor: RiskCalculator.getRiskColor(route.riskBreakdown.trafficRisk)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bus-specific factors */}
            {isBusLength && route.busSpecificFactors.length > 0 && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Bus Considerations:</span>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  {route.busSpecificFactors.map((factor, idx) => (
                    <div key={idx}>• {factor}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary concerns */}
            {route.riskBreakdown.primaryConcerns.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Primary Concerns:</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {route.riskBreakdown.primaryConcerns.slice(0, 3).map((concern, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
                      {concern}
                    </div>
                  ))}
                  {route.riskBreakdown.primaryConcerns.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{route.riskBreakdown.primaryConcerns.length - 3} more concerns
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Critical points summary */}
            {route.criticalPoints.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="font-medium">{route.criticalPoints.length}</span> critical point(s):
                  {route.criticalPoints.slice(0, 2).map((point, idx) => (
                    <span key={point.segmentId} className="ml-1">
                      {point.description.split(':')[1]?.trim() || point.description.split(':')[0]}
                      {idx < Math.min(route.criticalPoints.length, 2) - 1 && ', '}
                    </span>
                  ))}
                  {route.criticalPoints.length > 2 && (
                    <span className="ml-1">+{route.criticalPoints.length - 2} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Enhanced risk assessment info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors duration-300">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Enhanced Risk Assessment
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <div><strong>Pedestrian Risk:</strong> Density, crossing patterns, and visibility concerns</div>
          <div><strong>Maneuvering Risk:</strong> Road width, turning radius, and clearance requirements</div>
          <div><strong>Infrastructure Risk:</strong> Height restrictions, bridge clearances, and road conditions</div>
          <div><strong>Traffic Risk:</strong> Congestion levels, speed differentials, and merging challenges</div>
          {isBusLength && (
            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
              <div><strong>Bus-Specific Analysis:</strong> Turn complexity, rear overhang swing, and blind spot considerations for 40ft vehicles</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};