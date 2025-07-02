import { createContext, useContext, useState, ReactNode } from 'react';
import { Location, Route, NamedRiskFactor, MapContextType } from '../types';

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [riskFactors, setRiskFactors] = useState<NamedRiskFactor[]>([]);

  return (
    <MapContext.Provider
      value={{
        map,
        setMap,
        selectedRoute,
        setSelectedRoute,
        origin,
        setOrigin,
        destination,
        setDestination,
        riskFactors,
        setRiskFactors,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}
