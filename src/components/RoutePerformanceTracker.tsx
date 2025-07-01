import React, { useState, useEffect } from 'react';
import { Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';
import { 
  Clock, 
  Zap,
  Shield,
  Activity
} from 'lucide-react';

interface RoutePerformanceTrackerProps {
  routes: Route[];
  selectedRouteId: string;
  vehicle: Vehicle;
}

export const RoutePerformanceTracker: React.FC<RoutePerformanceTrackerProps> = ({
  routes,
  selectedRouteId,
  vehicle
}) => {
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    [routeId: string]: {
      efficiency: number;
      safetyScore: number;
      timeOptimization: number;
      overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      trend: 'improving' | 'stable' | 'declining';
    }
  }>({});

  useEffect(() => {
    // Calculate performance metrics for all routes
    const metrics: typeof performanceMetrics = {};
    
    routes.forEach(route => {
      const riskScore = RiskCalculator.calculateRouteRisk(route, vehicle);
      const safetyScore = 100 - riskScore;
      const efficiency = (route.totalDistance / route.estimatedTime) * 60; // mph
      const timeOptimization = Math.max(0, 100 - (route.estimatedTime / route.totalDistance) * 10);
      
      // Calculate overall grade
      const averageScore = (safetyScore + timeOptimization + Math.min(efficiency * 2, 100)) / 3;
      let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      if (averageScore >= 90) overallGrade = 'A';
      else if (averageScore >= 80) overallGrade = 'B';
      else if (averageScore >= 70) overallGrade = 'C';
      else if (averageScore >= 60) overallGrade = 'D';
      else overallGrade = 'F';

      metrics[route.id] = {
        efficiency,
        safetyScore,
        timeOptimization,
        overallGrade,
        trend: 'stable' // In real app, this would track historical data
      };
    });
    
    setPerformanceMetrics(metrics);
  }, [routes, vehicle]);

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const selectedMetrics = selectedRoute ? performanceMetrics[selectedRoute.id] : null;

  if (!selectedRoute || !selectedMetrics) return null;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'B': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'C': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'D': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'F': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
          <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Route Performance</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Real-time analysis of {selectedRoute.name}
          </p>
        </div>
        <div className="ml-auto">
          <div className={`px-3 py-1 rounded-full text-lg font-bold ${getGradeColor(selectedMetrics.overallGrade)}`}>
            {selectedMetrics.overallGrade}
          </div>
        </div>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <Shield className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {Math.round(selectedMetrics.safetyScore)}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">Safety Score</div>
        </div>

        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {selectedMetrics.efficiency.toFixed(1)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">Avg Speed (mph)</div>
        </div>

        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {Math.round(selectedMetrics.timeOptimization)}
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300">Time Efficiency</div>
        </div>
      </div>

      {/* Performance Bars */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Safety Score</span>
            <span className="text-gray-900 dark:text-white">{Math.round(selectedMetrics.safetyScore)}/100</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${selectedMetrics.safetyScore}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Route Efficiency</span>
            <span className="text-gray-900 dark:text-white">{selectedMetrics.efficiency.toFixed(1)} mph</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(selectedMetrics.efficiency * 2, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Time Optimization</span>
            <span className="text-gray-900 dark:text-white">{Math.round(selectedMetrics.timeOptimization)}/100</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${selectedMetrics.timeOptimization}%` }}
            />
          </div>
        </div>
      </div>

      {/* Comparison with Other Routes */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Performance vs Other Routes
        </h4>
        
        <div className="space-y-2">
          {routes.map((route, index) => {
            if (route.id === selectedRouteId) return null;
            
            const metrics = performanceMetrics[route.id];
            if (!metrics) return null;
            
            const routeColor = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea'][index % 5];
            const isWorse = metrics.safetyScore < selectedMetrics.safetyScore;
            
            return (
              <div key={route.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: routeColor }}
                  />
                  <span className="text-gray-600 dark:text-gray-400">{route.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded ${getGradeColor(metrics.overallGrade)}`}>
                    {metrics.overallGrade}
                  </span>
                  {isWorse ? (
                    <span className="text-green-600 text-xs">↓ Lower Risk</span>
                  ) : (
                    <span className="text-red-600 text-xs">↑ Higher Risk</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Tips */}
      <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
        <div className="text-sm text-indigo-800 dark:text-indigo-300">
          <div className="font-medium mb-1">💡 Performance Tips:</div>
          <div className="space-y-1 text-xs">
            {selectedMetrics.safetyScore < 70 && (
              <div>• Consider alternative route for better safety profile</div>
            )}
            {selectedMetrics.efficiency < 25 && (
              <div>• Route has heavy traffic - plan for delays</div>
            )}
            {selectedMetrics.timeOptimization < 60 && (
              <div>• This route may have inefficient routing - check for shortcuts</div>
            )}
            {selectedMetrics.overallGrade === 'A' && (
              <div>• Excellent route choice! Minimal optimizations needed</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
