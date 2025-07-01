export interface Location {
  id: string;
  name: string;
  address: string;
  position: {
    lat: number;
    lng: number;
  };
}

export interface RoutePoint {
  location: Location;
  arrivalTime?: string;
  departureTime?: string;
  isStop: boolean;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  color?: string;
  points: RoutePoint[];
  distance: number; // in meters
  duration: number; // in seconds
  riskScore?: number; // 0-100
}

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location: {
    lat: number;
    lng: number;
  };
}

export interface MapContextType {
  map: google.maps.Map | null;
  setMap: (map: google.maps.Map) => void;
  selectedRoute: Route | null;
  setSelectedRoute: (route: Route | null) => void;
  origin: Location | null;
  setOrigin: (location: Location | null) => void;
  destination: Location | null;
  setDestination: (location: Location | null) => void;
  riskFactors: RiskFactor[];
  setRiskFactors: (factors: RiskFactor[]) => void;
}