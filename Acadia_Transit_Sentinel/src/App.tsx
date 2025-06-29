import { useState } from 'react';
import { MapComponent } from './components/MapComponent';
import { RouteSelector } from './components/RouteSelector';
import { LocationSearch } from './components/LocationSearch';
import { RouteDetails } from './components/RouteDetails';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { useMapContext, MapProvider } from './contexts/MapContext';
import { Route } from './types';

function AppContent() {
  const { selectedRoute, setSelectedRoute } = useMapContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen}>
          <div className="space-y-4 p-4">
            <LocationSearch />
            <RouteSelector onRouteSelect={setSelectedRoute} />
            {selectedRoute && <RouteDetails route={selectedRoute} />}
          </div>
        </Sidebar>
        <main className="flex-1 relative">
          <MapComponent />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MapProvider>
      <AppContent />
    </MapProvider>
  );
}