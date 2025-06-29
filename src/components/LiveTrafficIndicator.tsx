import React from 'react';
import { RouteSegment } from '../types';

export const LiveTrafficIndicator: React.FC<{ segment: RouteSegment }> = ({ segment }) => {
  if (!segment.liveTrafficData) return null;

  const { congestionLevel, currentSpeed, normalSpeed, trafficDelay } = segment.liveTrafficData;
  
  const getTrafficColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'heavy': return 'text-orange-600 bg-orange-100';
      case 'severe': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrafficIcon = (level: string) => {
    switch (level) {
      case 'low': return '🟢';
      case 'moderate': return '🟡';
      case 'heavy': return '🟠';
      case 'severe': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`px-2 py-1 rounded-full ${getTrafficColor(congestionLevel)}`}>
        <span className="mr-1">{getTrafficIcon(congestionLevel)}</span>
        {congestionLevel} traffic
      </div>
      
      <div className="text-gray-600">
        {currentSpeed.toFixed(0)} mph
        {trafficDelay > 0 && (
          <span className="text-red-600"> (+{Math.round(trafficDelay / 60)}min delay)</span>
        )}
      </div>
    </div>
  );
};
