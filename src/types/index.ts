export interface Vehicle {
  height: number; // feet
  length: number; // feet
  width: number; // feet
}

export interface RouteSegment {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  streetName: string;
  riskScore: number;
  riskFactors: {
    pedestrianTraffic: number;
    roadWidth: number;
    trafficCongestion: number;
    speedLimit: number;
    heightRestriction: number;
  };
  description: string;
}

export interface Route {
  id: string;
  name: string;
  segments: RouteSegment[];
  totalDistance: number;
  estimatedTime: number;
  overallRisk: number;
  criticalPoints: CriticalPoint[];
  waypoints?: string[]; // Added waypoints support
  stops?: StopLocation[];
}

export interface CriticalPoint {
  segmentId: string;
  type: 'turn' | 'intersection' | 'bridge' | 'narrow_road';
  riskLevel: 'high' | 'critical';
  description: string;
  position: number; // segment index
}

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  category: 'home' | 'work' | 'warehouse' | 'depot' | 'customer' | 'other';
  createdAt: Date;
  lastUsed?: Date;
}

export interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
  category?: string;
}

export interface StopLocation {
  id: string;
  address: string;
  name?: string;
  order: number;
  estimatedStopTime?: number; // minutes
}
