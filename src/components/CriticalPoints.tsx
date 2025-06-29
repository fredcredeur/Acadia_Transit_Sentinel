import React from 'react';
import { AlertTriangle, Navigation, Grid as Bridge, Users, RotateCcw, Truck } from 'lucide-react';
import { CriticalPoint, Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';

interface CriticalPointsProps {
  route?: Route; // Make route optional
  vehicle: Vehicle;
}

export const CriticalPoints: React.FC<CriticalPointsProps> = ({ route, vehicle }) => {
  // If no route is provided, render a placeholder
  if (!route) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300 h-96 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">No route selected. Analyze a route to see critical points.</p>
      </div>
    );
  }

  const isBusLength = vehicle.length >= 35 && vehicle.length <= 45;

  const getIcon = (type: CriticalPoint['type']) => {
    switch (type) {
      case 'bridge':
        return Bridge;
      case 'turn':
        return RotateCcw;
      case 'intersection':
        return Users;
      case 'narrow_road':
        return Navigation;
      default:
        return AlertTriangle;
    }
  };

  const getTypeLabel = (type: CriticalPoint['type']) => {
    switch (type) {
      case 'bridge':
        return 'Height Restriction';
      case 'turn':
        return 'Complex Turn';
      case 'intersection':
        return 'High-Risk Intersection';
      case 'narrow_road':
        return 'Narrow Passage';
      default:
        return 'Critical Point';
    }
  };

  // Get bus-specific advice for the route
  const busAdvice = isBusLength ? RiskCalculator.getBusSpecificAdvice(vehicle, route) : [];

  if (route.criticalPoints.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Critical Points</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Critical Points</h3>
          <p className="text-gray-600 dark:text-gray-400">This route has no high-risk segments for your vehicle.</p>
        </div>

        {/* Show bus advice even when no critical points */}
        {isBusLength && busAdvice.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-medium text-blue-900 dark:text-blue-200">Bus Operation Guidelines</h4>
            </div>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              {busAdvice.map((advice, index) => (
                <li key={index}>• {advice}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Critical Points</h2>
        <div className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-3 py-1 rounded-full text-sm font-medium border border-red-200 dark:border-red-700">
          {route.criticalPoints.length} Point{route.criticalPoints.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4">
        {route.criticalPoints.map((point, index) => {
          const Icon = getIcon(point.type);
          const segment = route.segments.find(s => s.id === point.segmentId);
          const detailedRisk = segment ? RiskCalculator.calculateDetailedRisk(segment, vehicle) : null;
          const turnAnalysis = segment && isBusLength ? RiskCalculator.analyzeTurn(segment, vehicle) : null;
          
          return (
            <div
              key={point.segmentId}
              className={`p-4 rounded-lg border-l-4 transition-colors duration-300 ${
                point.riskLevel === 'critical' 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-400' 
                  : 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  point.riskLevel === 'critical' 
                    ? 'bg-red-100 dark:bg-red-900/50' 
                    : 'bg-amber-100 dark:bg-amber-900/50'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    point.riskLevel === 'critical' 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Segment {point.position + 1}: {getTypeLabel(point.type)}
                    </h3>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      point.riskLevel === 'critical' 
                        ? 'bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700' 
                        : 'bg-amber-200 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    }`}>
                      {point.riskLevel.toUpperCase()}
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{point.description}</p>
                  
                  {segment && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Location:</span>
                          <p className="font-medium text-gray-900 dark:text-white">{segment.streetName}</p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Risk Factors:</span>
                          <div className="space-y-1 mt-1">
                            {segment.riskFactors.pedestrianTraffic > 70 && (
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  Heavy pedestrian traffic ({segment.riskFactors.pedestrianTraffic}%)
                                </span>
                              </div>
                            )}
                            {segment.riskFactors.roadWidth > 60 && (
                              <div className="flex items-center gap-1">
                                <Navigation className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  Narrow road (risk: {segment.riskFactors.roadWidth}%)
                                </span>
                              </div>
                            )}
                            {segment.riskFactors.heightRestriction > 0 && (
                              <div className="flex items-center gap-1">
                                <Bridge className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  Height clearance: {segment.riskFactors.heightRestriction}ft
                                  {segment.riskFactors.heightRestriction <= vehicle.height + 1 && 
                                    <span className="text-red-600 dark:text-red-400 ml-1">(⚠️ Critical)</span>
                                  }
                                </span>
                              </div>
                            )}
                            {segment.riskFactors.trafficCongestion > 70 && (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  Heavy traffic congestion ({segment.riskFactors.trafficCongestion}%)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bus-specific turn analysis */}
                      {isBusLength && turnAnalysis && point.type === 'turn' && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                              40ft Bus Turn Analysis
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs text-blue-700 dark:text-blue-300">
                            <div>
                              <span className="font-medium">Turn Angle:</span> ~{Math.round(turnAnalysis.angle)}°
                            </div>
                            <div>
                              <span className="font-medium">Difficulty:</span> {turnAnalysis.difficulty.replace('_', ' ')}
                            </div>
                            <div>
                              <span className="font-medium">Clearance Needed:</span> {Math.round(turnAnalysis.clearanceRequired)}ft
                            </div>
                            <div>
                              <span className="font-medium">Turn Radius:</span> {Math.round(turnAnalysis.radius)}ft
                            </div>
                          </div>
                          <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-xs text-blue-800 dark:text-blue-300">
                            <strong>Recommendation:</strong> {turnAnalysis.recommendation}
                          </div>
                        </div>
                      )}

                      {/* Detailed risk breakdown */}
                      {detailedRisk && detailedRisk.primaryConcerns.length > 0 && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Specific Concerns:</h5>
                          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                            {detailedRisk.primaryConcerns.map((concern, idx) => (
                              <li key={idx} className="flex items-center gap-1">
                                <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
                                {concern}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enhanced safety recommendations */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors duration-300">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Safety Recommendations</h4>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>• Reduce speed when approaching critical points</li>
          <li>• Use spotters for tight turns and narrow passages</li>
          <li>• Consider alternative routes during peak hours</li>
          <li>• Ensure vehicle compliance with height restrictions</li>
          <li>• Monitor real-time traffic and pedestrian activity</li>
          {isBusLength && (
            <>
              <li>• Account for 42ft turning radius when planning maneuvers</li>
              <li>• Watch for rear overhang swing during turns (8ft clearance needed)</li>
              <li>• Use mirrors and blind spot monitoring systems actively</li>
            </>
          )}
        </ul>
      </div>

      {/* Bus-specific operational advice */}
      {isBusLength && busAdvice.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="font-medium text-blue-900 dark:text-blue-200">Bus Operation Guidelines</h4>
          </div>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            {busAdvice.map((advice, index) => (
              <li key={index}>• {advice}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
