import React from 'react';
import { AlertTriangle, Navigation, Grid as Bridge, Users } from 'lucide-react';
import { CriticalPoint, Route, Vehicle } from '../types';

interface CriticalPointsProps {
  route: Route;
  vehicle: Vehicle;
}

export const CriticalPoints: React.FC<CriticalPointsProps> = ({ route, vehicle }) => {
  const getIcon = (type: CriticalPoint['type']) => {
    switch (type) {
      case 'bridge':
        return Bridge;
      case 'turn':
        return Navigation;
      case 'intersection':
        return Users;
      default:
        return AlertTriangle;
    }
  };

  const getTypeLabel = (type: CriticalPoint['type']) => {
    switch (type) {
      case 'bridge':
        return 'Height Restriction';
      case 'turn':
        return 'Sharp Turn';
      case 'intersection':
        return 'Intersection';
      case 'narrow_road':
        return 'Narrow Road';
      default:
        return 'Critical Point';
    }
  };

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
                    <div className="grid grid-cols-2 gap-4 text-sm">
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
                              <span className="text-xs text-gray-600 dark:text-gray-400">Heavy pedestrian traffic</span>
                            </div>
                          )}
                          {segment.riskFactors.roadWidth > 60 && (
                            <div className="flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs text-gray-600 dark:text-gray-400">Narrow road</span>
                            </div>
                          )}
                          {segment.riskFactors.heightRestriction > 0 && 
                           segment.riskFactors.heightRestriction <= vehicle.height && (
                            <div className="flex items-center gap-1">
                              <Bridge className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Height clearance: {segment.riskFactors.heightRestriction}ft
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors duration-300">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Safety Recommendations</h4>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>• Reduce speed when approaching critical points</li>
          <li>• Use spotters for tight turns and narrow passages</li>
          <li>• Consider alternative routes during peak hours</li>
          <li>• Ensure vehicle compliance with height restrictions</li>
          <li>• Monitor real-time traffic and pedestrian activity</li>
        </ul>
      </div>
    </div>
  );
};