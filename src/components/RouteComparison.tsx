import React from 'react';
import { Route as Route2, Clock, MapPin, TrendingUp, AlertTriangle, Navigation, Zap, Shield, Users, Construction } from 'lucide-react';
import { Route, Vehicle } from '../types';
import { LiveTrafficIndicator } from './LiveTrafficIndicator';
import { RiskCalculator } from '../utils/riskCalculator';
import { RouteColorManager } from '../utils/routeColors';

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

  const getRouteTypeIcon = (route: Route, index: number) => {
    if (route.name.toLowerCase().includes('highway')) return <Zap className="w-5 h-5" />;
    if (route.name.toLowerCase().includes('arterial')) return <Navigation className="w-5 h-5" />;
    if (route.name.toLowerCase().includes('truck')) return <Shield className="w-5 h-5" />;
    
    const icons = [<Navigation className="w-5 h-5" />, <Zap className="w-5 h-5" />, <Shield className="w-5 h-5" />, <MapPin className="w-5 h-5" />];
    return icons[index % icons.length];
  };

  const getRouteDescription = (route: Route, index: number) => {
    const avgSpeed = (route.totalDistance / (route.estimatedTime / 60)).toFixed(0);
    const criticalCount = route.criticalPoints?.length || 0;
    
    if (index === 0) return "Recommended route with optimal safety balance";
    if (route.estimatedTime < 15) return `Fast route • ${avgSpeed} mph average`;
    if (criticalCount === 0) return "Smooth route with no critical points";
    if (route.totalDistance < 5) return "Short distance route";
    return `Balanced route • ${criticalCount} attention point${criticalCount !== 1 ? 's' : ''}`;
  };

  const getRouteFeatures = (route: Route) => {
    const features = [];
    const criticalCount = route.criticalPoints?.length || 0;
    const avgSpeed = route.totalDistance / (route.estimatedTime / 60);
    
    if (criticalCount === 0) features.push({ icon: Shield, text: "No critical points", color: "text-green-600" });
    if (avgSpeed > 35) features.push({ icon: Zap, text: "High speed", color: "text-blue-600" });
    if (route.totalDistance < 8) features.push({ icon: MapPin, text: "Short distance", color: "text-purple-600" });
    if (criticalCount > 3) features.push({ icon: AlertTriangle, text: "Multiple alerts", color: "text-amber-600" });
    
    return features.slice(0, 2);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
          <Route2 className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Route Comparison</h2>
          {isBusLength ? (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Optimized for 40ft bus operations
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {routes.length} route{routes.length !== 1 ? 's' : ''} analyzed for your vehicle
            </p>
          )}
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Route2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Routes Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Enter origin and destination addresses to analyze route options
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {routesWithAnalysis.map((route, index) => {
            const riskScore = RiskCalculator.calculateRouteRisk(route, vehicle);
            const features = getRouteFeatures(route);
            
            // Use consistent route colors
            const routeColor = RouteColorManager.getRouteColor(index);
            const routeColorLight = RouteColorManager.getRouteColorLight(index);
            const routeColorDark = RouteColorManager.getRouteColorDark(index);
            
            return (
              <div
                key={route.id}
                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 ${
                  selectedRoute === route.id
                    ? 'shadow-md'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                }`}
                style={{
                  borderColor: selectedRoute === route.id ? routeColor : undefined,
                  backgroundColor: selectedRoute === route.id ? routeColorLight : undefined
                }}
                onClick={() => onRouteSelect(route.id)}
              >
                {/* Route Color Indicator */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: routeColor }}
                />

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: selectedRoute === route.id ? 'rgba(255,255,255,0.8)' : routeColorLight,
                        color: routeColorDark
                      }}
                    >
                      {getRouteTypeIcon(route, index)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full border border-green-200 dark:border-green-700">
                            RECOMMENDED
                          </div>
                        )}
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{route.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {getRouteDescription(route, index)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Risk Score Badge */}
                  <div className="text-right">
                    <div
                      className="text-3xl font-bold mb-1"
                      style={{ color: RiskCalculator.getRiskColor(riskScore) }}
                    >
                      {Math.round(riskScore)}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      {RiskCalculator.getRiskLabel(riskScore)} Risk
                    </div>
                  </div>
                </div>

                {/* Main Metrics Grid */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                    <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{route.totalDistance.toFixed(1)}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">miles</div>
                  </div>
                  
                  <div className="text-center p-3 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(route.estimatedTime)}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">minutes</div>
                  </div>
                  
                  <div className="text-center p-3 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {Math.round((route.totalDistance / (route.estimatedTime / 60)))}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">avg mph</div>
                  </div>
                </div>

                {/* Route Features */}
                {features.length > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    {features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-white/80 dark:bg-gray-700/80 rounded-full">
                        <feature.icon className={`w-3 h-3 ${feature.color}`} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{feature.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Critical Points Summary */}
                {route.criticalPoints && route.criticalPoints.length > 0 ? (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                        {route.criticalPoints.length} Critical Point{route.criticalPoints.length > 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        {route.criticalPoints.slice(0, 2).map((point, idx) => (
                          <span key={point.segmentId}>
                            {point.description.split(':')[0]}
                            {idx < Math.min(route.criticalPoints!.length, 2) - 1 && ', '}
                          </span>
                        ))}
                        {route.criticalPoints.length > 2 && (
                          <span> +{route.criticalPoints.length - 2} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                    <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      No critical points detected
                    </span>
                  </div>
                )}

                {/* Live Traffic Indicator */}
                {route.segments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <LiveTrafficIndicator segment={route.segments[0]} />
                  </div>
                )}

                {/* Selection Indicator */}
                {selectedRoute === route.id && (
                  <div className="absolute top-3 right-3">
                    <div 
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: routeColor }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced risk assessment info */}
      {routes.length > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors duration-300">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Risk Assessment Factors
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Pedestrian density & crossing patterns</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              <span>Road width & turning radius requirements</span>
            </div>
            <div className="flex items-center gap-2">
              <Construction className="w-4 h-4" />
              <span>Infrastructure & height restrictions</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Traffic congestion & speed differentials</span>
            </div>
          </div>
          {isBusLength && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Large Vehicle Analysis:</strong> Enhanced assessment for 40ft+ vehicles including turn complexity, rear overhang considerations, and intersection safety.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};