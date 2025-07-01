import React from 'react';
import { AlertTriangle, Shield, Navigation, Clock, MapPin, Truck, StopCircle, 
         Traffic, Construction, School, CheckCircle, XCircle } from 'lucide-react';
import { Route, Vehicle } from '../types';

interface LargeVehicleAnalysisProps {
  routes: Route[];
  selectedRouteId: string;
  vehicle: Vehicle;
  largeVehicleAnalysis?: {
    stopSignCount: number;
    trafficLightCount: number;
    safetyRecommendations: string[];
    alternativeRouteSuggested: boolean;
  };
}

export const LargeVehicleAnalysisPanel: React.FC<LargeVehicleAnalysisProps> = ({
  routes,
  selectedRouteId,
  vehicle,
  largeVehicleAnalysis
}) => {
  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const isLargeVehicle = vehicle.length >= 30;
  const isBus = vehicle.length >= 35;

  if (!isLargeVehicle || !selectedRoute || !largeVehicleAnalysis) {
    return null;
  }

  const stopSignRatio = largeVehicleAnalysis.stopSignCount / 
    (largeVehicleAnalysis.stopSignCount + largeVehicleAnalysis.trafficLightCount);
  
  const isHighStopSignRoute = stopSignRatio > 0.6;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${
          isHighStopSignRoute 
            ? 'bg-red-100 dark:bg-red-900/50' 
            : 'bg-orange-100 dark:bg-orange-900/50'
        }`}>
          <Truck className={`w-6 h-6 ${
            isHighStopSignRoute 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-orange-600 dark:text-orange-400'
          }`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Large Vehicle Safety Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isBus ? '40ft Bus' : 'Large Vehicle'} Route Assessment
          </p>
        </div>
        {largeVehicleAnalysis.alternativeRouteSuggested && (
          <div className="ml-auto">
            <div className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-700">
              Alternative Suggested
            </div>
          </div>
        )}
      </div>

      {/* Intersection Analysis */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-lg border-l-4 ${
          largeVehicleAnalysis.stopSignCount > 5 
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
            : largeVehicleAnalysis.stopSignCount > 2
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-green-500 bg-green-50 dark:bg-green-900/20'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <StopCircle className={`w-5 h-5 ${
              largeVehicleAnalysis.stopSignCount > 5 
                ? 'text-red-600 dark:text-red-400'
                : largeVehicleAnalysis.stopSignCount > 2
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-green-600 dark:text-green-400'
            }`} />
            <span className="font-medium text-gray-900 dark:text-white">Stop Signs</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {largeVehicleAnalysis.stopSignCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {largeVehicleAnalysis.stopSignCount === 0 ? 'Excellent!' :
             largeVehicleAnalysis.stopSignCount <= 2 ? 'Acceptable' :
             largeVehicleAnalysis.stopSignCount <= 5 ? 'Caution Required' : 'High Risk'}
          </div>
        </div>

        <div className="p-4 rounded-lg border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-2 mb-2">
            <Traffic className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="font-medium text-gray-900 dark:text-white">Traffic Lights</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {largeVehicleAnalysis.trafficLightCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Controlled Intersections
          </div>
        </div>
      </div>

      {/* Safety Recommendations */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Safety Recommendations
        </h4>
        
        <div className="space-y-2">
          {largeVehicleAnalysis.safetyRecommendations.map((recommendation, index) => {
            const isHighPriority = recommendation.includes('🚨') || recommendation.includes('⚠️');
            return (
              <div 
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  isHighPriority 
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                }`}
              >
                {recommendation}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alternative Route Suggestion */}
      {largeVehicleAnalysis.alternativeRouteSuggested && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Consider Alternative Route
            </span>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
            This route has a high concentration of stop signs. For improved safety and schedule reliability,
            consider selecting a route that prioritizes traffic lights, even if it's slightly longer.
          </p>
        </div>
      )}
    </div>
  );
};