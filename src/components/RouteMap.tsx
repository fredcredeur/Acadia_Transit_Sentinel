import React, { useState } from 'react';
import { Navigation, MapPin, AlertCircle, ZoomIn } from 'lucide-react';
import { Route, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';
import { GoogleMapComponent } from './GoogleMapComponent';

interface RouteMapProps {
  route?: Route; // Make route optional
  vehicle: Vehicle;
  useGoogleMaps?: boolean;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  route,
  vehicle,
  useGoogleMaps = true
}) => {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // If no route is provided, render a placeholder
  if (!route) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300 h-96 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">No route selected. Enter origin and destination to analyze a route.</p>
      </div>
    );
  }
  
  const segmentsWithRisk = route.segments.map(segment => ({
    ...segment,
    adjustedRisk: RiskCalculator.calculateSegmentRisk(segment, vehicle)
  }));

  const overallRisk = RiskCalculator.calculateRouteRisk(route, vehicle);

  const handleSegmentClick = (segmentId: string) => {
    console.log('Segment clicked from list:', segmentId);
    setSelectedSegmentId(segmentId);
    
    // If Google Maps is available, trigger zoom
    if (useGoogleMaps && (window as any).zoomToSegment) {
      (window as any).zoomToSegment(segmentId);
    }
  };

  const handleMapSegmentClick = (segmentId: string) => {
    console.log('Segment clicked from map:', segmentId);
    setSelectedSegmentId(segmentId);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Navigation className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{route.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {route.totalDistance} miles • {route.estimatedTime} min
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: RiskCalculator.getRiskColor(overallRisk) }}>
              {Math.round(overallRisk)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Risk Score</div>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="h-80">
        {useGoogleMaps ? (
          <GoogleMapComponent 
            route={route} 
            vehicle={vehicle}
            className="h-full"
            onSegmentClick={handleMapSegmentClick}
          />
        ) : (
          // Fallback to mock visualization
          <div className="h-full bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20">
              {/* Mock map grid */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="h-px bg-gray-400 dark:bg-gray-600" style={{ top: `${i * 5}%` }} />
                ))}
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="w-px bg-gray-400 dark:bg-gray-600 h-full" style={{ left: `${i * 5}%` }} />
                ))}
              </div>

              {/* Route visualization */}
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    {segmentsWithRisk.map((segment, index) => (
                      <stop
                        key={segment.id}
                        offset={`${(index / segmentsWithRisk.length) * 100}%`}
                        stopColor={RiskCalculator.getRiskColor(segment.adjustedRisk)}
                      />
                    ))}
                  </linearGradient>
                </defs>
                
                {/* Main route line */}
                <polyline
                  points="50,250 120,220 180,180 250,150 320,120"
                  fill="none"
                  stroke="url(#routeGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                
                {/* Route points */}
                {segmentsWithRisk.map((segment, index) => {
                  const x = 50 + (index * 67.5);
                  const y = 250 - (index * 32.5);
                  return (
                    <g key={segment.id}>
                      <circle
                        cx={x}
                        cy={y}
                        r="8"
                        fill={RiskCalculator.getRiskColor(segment.adjustedRisk)}
                        className="drop-shadow-sm cursor-pointer hover:r-10 transition-all"
                        onClick={() => handleSegmentClick(segment.id)}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="white"
                        className="cursor-pointer"
                        onClick={() => handleSegmentClick(segment.id)}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Critical points indicators */}
              {route.criticalPoints.map((point, index) => (
                <div
                  key={point.segmentId}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{
                    left: `${20 + (point.position * 17)}%`,
                    top: `${70 - (point.position * 8)}%`
                  }}
                  onClick={() => handleSegmentClick(point.segmentId)}
                >
                  <div className="relative">
                    <AlertCircle className="w-6 h-6 text-red-500 animate-pulse hover:w-8 hover:h-8 transition-all" />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Critical Point {point.position + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Map legend */}
            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Level</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">High</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">Click segments to zoom</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Route segments list */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 dark:text-white">Route Segments</h4>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ZoomIn className="w-3 h-3" />
            Click to zoom
          </div>
        </div>
        <div className="space-y-2">
          {segmentsWithRisk.map((segment, index) => (
            <div
              key={segment.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                selectedSegmentId === segment.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600'
                  : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
              }`}
              onClick={() => handleSegmentClick(segment.id)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: RiskCalculator.getRiskColor(segment.adjustedRisk) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    {segment.streetName}
                    {selectedSegmentId === segment.id && (
                      <ZoomIn className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{segment.description}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-medium text-sm text-gray-900 dark:text-white">{Math.round(segment.adjustedRisk)}%</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {RiskCalculator.getRiskLabel(segment.adjustedRisk)}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Interaction hint */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <ZoomIn className="w-4 h-4" />
            <span className="text-sm font-medium">Interactive Map</span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            Click on any segment above or on the map to zoom in and examine specific risk areas in detail.
          </p>
        </div>
      </div>
    </div>
  );
};
