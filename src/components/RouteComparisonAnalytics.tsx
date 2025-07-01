import React, { useState } from 'react';
import { Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';
import { RouteColorManager } from '../utils/routeColors';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Equal,
  Zap,
  Shield,
  Navigation
} from 'lucide-react';

interface RouteComparisonAnalyticsProps {
  routes: Route[];
  selectedRouteId: string;
  vehicle: Vehicle;
  onRouteSelect: (routeId: string) => void;
}

export const RouteComparisonAnalytics: React.FC<RouteComparisonAnalyticsProps> = ({
  routes,
  selectedRouteId,
  vehicle,
  onRouteSelect
}) => {
  const [comparisonMode, setComparisonMode] = useState<'overview' | 'detailed' | 'recommendations'>('overview');
  
  if (routes.length === 0) return null;

  // Calculate metrics for all routes
  const routeMetrics = routes.map(route => {
    const riskScore = RiskCalculator.calculateRouteRisk(route, vehicle);
    const criticalPoints = route.criticalPoints?.length || 0;
    const highRiskSegments = route.segments.filter(seg => 
      RiskCalculator.calculateSegmentRisk(seg, vehicle) >= 60
    ).length;
    
    return {
      ...route,
      riskScore,
      criticalPoints,
      highRiskSegments,
      timeToRiskRatio: route.estimatedTime / Math.max(riskScore, 1),
      efficiency: (route.totalDistance / route.estimatedTime) * 60 // mph
    };
  });

  // Find best/worst routes for different criteria
  const fastest = routeMetrics.reduce((best, current) => 
    current.estimatedTime < best.estimatedTime ? current : best
  );
  const safest = routeMetrics.reduce((best, current) => {
    if (current.riskScore < best.riskScore - 2) {
      return current;
    }
    if (best.riskScore < current.riskScore - 2) {
      return best;
    }
    if (current.criticalPoints < best.criticalPoints) {
      return current;
    }
    return best;
  });
  const shortest = routeMetrics.reduce((best, current) => 
    current.totalDistance < best.totalDistance ? current : best
  );

  const getComparisonIcon = (current: number, comparison: number) => {
    if (Math.abs(current - comparison) < 0.1) return <Equal className="w-4 h-4 text-gray-500" />;
    return current < comparison ? 
      <TrendingDown className="w-4 h-4 text-green-600" /> : 
      <TrendingUp className="w-4 h-4 text-red-600" />;
  };

  const selectedRoute = routeMetrics.find(r => r.id === selectedRouteId) || routeMetrics[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      {/* Header with Mode Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Route Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Comparing {routes.length} route options
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'detailed', label: 'Detailed', icon: Shield },
            { key: 'recommendations', label: 'Recommendations', icon: Zap }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setComparisonMode(key as 'overview' | 'detailed' | 'recommendations')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                comparisonMode === key
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {comparisonMode === 'overview' && (
          <div className="space-y-6">
            {/* Quick Comparison Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <Zap className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <div className="font-medium text-green-900 dark:text-green-100">Fastest</div>
                <div className="text-sm text-green-700 dark:text-green-300">{fastest.name}</div>
                <div className="text-xs text-green-600 dark:text-green-400">{fastest.estimatedTime} min</div>
              </div>

              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <div className="font-medium text-blue-900 dark:text-blue-100">Safest</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">{safest.name}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">{Math.round(safest.riskScore)}% risk</div>
              </div>

              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <Navigation className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                <div className="font-medium text-purple-900 dark:text-purple-100">Shortest</div>
                <div className="text-sm text-purple-700 dark:text-purple-300">{shortest.name}</div>
                <div className="text-xs text-purple-600 dark:text-purple-400">{shortest.totalDistance} mi</div>
              </div>
            </div>

            {/* Route Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left py-2 text-gray-900 dark:text-white">Route</th>
                    <th className="text-center py-2 text-gray-900 dark:text-white">Time</th>
                    <th className="text-center py-2 text-gray-900 dark:text-white">Distance</th>
                    <th className="text-center py-2 text-gray-900 dark:text-white">Risk</th>
                    <th className="text-center py-2 text-gray-900 dark:text-white">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {routeMetrics.map((route, index) => {
                    const isSelected = route.id === selectedRouteId;
                    const routeColor = RouteColorManager.getRouteColor(index);
                    
                    return (
                      <tr
                        key={route.id}
                        onClick={() => onRouteSelect(route.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: routeColor }}
                            />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {route.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-gray-900 dark:text-white">{route.estimatedTime}min</span>
                            {getComparisonIcon(route.estimatedTime, fastest.estimatedTime)}
                          </div>
                        </td>
                        <td className="text-center py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-gray-900 dark:text-white">{route.totalDistance}mi</span>
                            {getComparisonIcon(route.totalDistance, shortest.totalDistance)}
                          </div>
                        </td>
                        <td className="text-center py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span 
                              className="font-medium"
                              style={{ color: RiskCalculator.getRiskColor(route.riskScore) }}
                            >
                              {Math.round(route.riskScore)}%
                            </span>
                            {getComparisonIcon(route.riskScore, safest.riskScore)}
                          </div>
                        </td>
                        <td className="text-center py-3">
                          <span className="text-gray-900 dark:text-white">
                            {route.criticalPoints}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {comparisonMode === 'detailed' && (
          <div className="space-y-6">
            {/* Selected Route Detailed Analysis */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                Detailed Analysis: {selectedRoute.name}
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-blue-700 dark:text-blue-300 mb-2">Route Metrics</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Average Speed:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedRoute.efficiency.toFixed(1)} mph
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">High-Risk Segments:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedRoute.highRiskSegments} / {selectedRoute.segments.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Time/Risk Ratio:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedRoute.timeToRiskRatio.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-blue-700 dark:text-blue-300 mb-2">Safety Breakdown</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Infrastructure Risk:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedRoute.segments.filter(seg => seg.riskFactors.heightRestriction > 0).length > 0 ? 'Present' : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pedestrian Areas:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedRoute.segments.filter(seg => seg.riskFactors.pedestrianTraffic > 60).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Traffic Congestion:</span>
                      <span className="text-gray-900 dark:text-white">
                        {Math.round(selectedRoute.segments.reduce((sum, seg) => sum + seg.riskFactors.trafficCongestion, 0) / selectedRoute.segments.length)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Distribution Across Routes */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Risk Distribution Across Routes
              </h4>
              
              <div className="space-y-3">
                {routeMetrics.map((route, index) => {
                  const routeColor = RouteColorManager.getRouteColor(index);
                  const riskDistribution = route.segments.map(seg => 
                    RiskCalculator.calculateSegmentRisk(seg, vehicle)
                  );
                  
                  return (
                    <div key={route.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: routeColor }}
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {route.name}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {route.segments.length} segments
                        </span>
                      </div>
                      
                      {/* Risk visualization bar */}
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          {riskDistribution.map((risk, segIndex) => (
                            <div
                              key={segIndex}
                              className="h-full"
                              style={{
                                width: `${100 / riskDistribution.length}%`,
                                backgroundColor: risk >= 80 ? '#dc2626' : 
                                               risk >= 60 ? '#f59e0b' : 
                                               risk >= 40 ? '#eab308' : '#22c55e'
                              }}
                              title={`Segment ${segIndex + 1}: ${Math.round(risk)}% risk`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Risk color legend */}
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600 dark:text-gray-400">Low (0-39%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-gray-600 dark:text-gray-400">Medium (40-59%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span className="text-gray-600 dark:text-gray-400">High (60-79%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-600 dark:text-gray-400">Critical (80%+)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {comparisonMode === 'recommendations' && (
          <div className="space-y-6">
            {/* AI-Powered Recommendations */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h4 className="font-medium text-purple-900 dark:text-purple-100">
                  AI Route Recommendations
                </h4>
              </div>
              
              <div className="space-y-3">
                {/* Primary Recommendation */}
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-green-700 dark:text-green-300">
                      🏆 Recommended: {safest.name}
                    </span>
                    <span className="text-sm px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      Best Overall
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Optimal balance of safety ({Math.round(safest.riskScore)}% risk) and efficiency 
                    ({safest.estimatedTime} minutes). {safest.criticalPoints === 0 ? 'No critical points.' : 
                    `${safest.criticalPoints} critical point${safest.criticalPoints > 1 ? 's' : ''} to monitor.`}
                  </p>
                </div>

                {/* Alternative Options */}
                {fastest.id !== safest.id && (
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-blue-700 dark:text-blue-300">
                      ⚡ Alternative: {fastest.name}
                      </span>
                      <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        Fastest
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {Math.abs(fastest.estimatedTime - safest.estimatedTime)} minutes faster, but 
                      {fastest.riskScore > safest.riskScore ? 
                        ` ${Math.round(fastest.riskScore - safest.riskScore)}% higher risk` : 
                        ' similar risk level'
                      }. Consider if time savings justify the trade-offs.
                    </p>
                  </div>
                )}

                {/* Vehicle-Specific Advice */}
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-600">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-orange-700 dark:text-orange-300">
                      🚛 Vehicle-Specific Advice
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {vehicle.length >= 35 ? (
                      <>
                        <div>• Large vehicle detected - prioritize truck-friendly routes</div>
                        <div>• Avoid routes with excessive turning or residential areas</div>
                        <div>• Allow extra time for maneuvering at stops</div>
                      </>
                    ) : (
                      <>
                        <div>• Small vehicle - all routes are navigable</div>
                        <div>• Consider fastest route unless safety is priority</div>
                        <div>• Minimal maneuvering restrictions</div>
                      </>
                    )}
                    {vehicle.height >= 12 && (
                      <div>• ⚠️ Monitor height restrictions on all routes</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Situation-Based Recommendations */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                When to Choose Each Route
              </h4>
              
              <div className="space-y-3">
                {routeMetrics.map((route, index) => {
                  const routeColor = RouteColorManager.getRouteColor(index);
                  
                  let recommendation = '';
                  if (route.id === fastest.id && route.id === safest.id) {
                    recommendation = 'Best overall choice - use anytime';
                  } else if (route.id === fastest.id) {
                    recommendation = 'When time is critical and you can manage higher risk';
                  } else if (route.id === safest.id) {
                    recommendation = 'When safety is the top priority';
                  } else if (route.id === shortest.id) {
                    recommendation = 'When fuel efficiency matters most';
                  } else {
                    recommendation = 'Backup option if primary routes are blocked';
                  }
                  
                  return (
                    <div key={route.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div 
                        className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: routeColor }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white mb-1">
                          {route.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {recommendation}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};