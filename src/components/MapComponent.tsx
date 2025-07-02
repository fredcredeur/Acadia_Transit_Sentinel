import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useMapContext } from '../contexts/MapContext';
import { LatLngCoordinates } from '../types'; // Import LatLngCoordinates

export function MapComponent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const { setMap, selectedRoute, riskFactors } = useMapContext();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const riskMarkersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key is missing');
      return;
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'routes']
    });

    loader.load().then(() => {
      if (mapRef.current) {
        // Center on Acadia National Park
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 44.3386, lng: -68.2733 },
          zoom: 12,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: true,
          zoomControl: true,
        });
        
        setMap(mapInstance);
      }
    }).catch(err => {
      console.error('Error loading Google Maps:', err);
    });
  }, [setMap]);

  // Handle selected route changes
  useEffect(() => {
    const { map } = useMapContext();
    
    if (!map || !selectedRoute) {
      // Clear existing route visualization
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      
      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      
      return;
    }
    
    // Clear previous route visualization
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }
    
    // Clear previous markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    
    // Create path from route segments
    const path: google.maps.LatLngLiteral[] = [];
    selectedRoute.segments.forEach(segment => {
      path.push({ lat: segment.startLat, lng: segment.startLng });
      path.push({ lat: segment.endLat, lng: segment.endLng });
    });
    
    // Create polyline for the route
    polylineRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#0284c7', // Default color, as Route does not have a color property
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map
    });
    
    // Add markers for origin, destination, and stops
    const newMarkers: google.maps.Marker[] = [];

    // Origin marker (first segment's start)
    if (selectedRoute.segments.length > 0) {
      const originSegment = selectedRoute.segments[0];
      const originMarker = new google.maps.Marker({
        position: { lat: originSegment.startLat, lng: originSegment.startLng },
        map,
        title: 'Origin',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#10b981', // Green
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff'
        }
      });
      newMarkers.push(originMarker);
    }

    // Destination marker (last segment's end)
    if (selectedRoute.segments.length > 0) {
      const destinationSegment = selectedRoute.segments[selectedRoute.segments.length - 1];
      const destinationMarker = new google.maps.Marker({
        position: { lat: destinationSegment.endLat, lng: destinationSegment.endLng },
        map,
        title: 'Destination',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ef4444', // Red
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff'
        }
      });
      newMarkers.push(destinationMarker);
    }

    // Stop markers
    selectedRoute.stops?.forEach(stop => {
      const stopMarker = new google.maps.Marker({
        position: { lat: parseFloat(stop.address.split(',')[0]), lng: parseFloat(stop.address.split(',')[1]) } as LatLngCoordinates, // Assuming stop.address is "lat,lng"
        map,
        title: stop.name || stop.address,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#6366f1', // Indigo
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff'
        }
      });
      newMarkers.push(stopMarker);
    });
    
    markersRef.current = newMarkers;
    
    // Fit bounds to show the entire route
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
    
  }, [selectedRoute]);

  // Handle risk factors
  useEffect(() => {
    const { map } = useMapContext();
    if (!map) return;
    
    // Clear previous risk markers
    riskMarkersRef.current.forEach(marker => marker.setMap(null));
    riskMarkersRef.current = [];
    
    // Add markers for risk factors
    riskFactors.forEach(factor => {
      const marker = new google.maps.Marker({
        position: { lat: factor.location.lat, lng: factor.location.lng }, // Use lat/lng from NamedRiskFactor
        map,
        title: factor.name,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: factor.severity === 'high' ? '#ef4444' : 
                    factor.severity === 'medium' ? '#f59e0b' : '#10b981',
          fillOpacity: 0.8,
          strokeWeight: 1,
          strokeColor: '#ffffff'
        }
      });
      
      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2">
            <h3 class="font-semibold">${factor.name}</h3>
            <p class="text-sm">${factor.description}</p>
            <p class="text-xs mt-1">Severity: ${factor.severity}</p>
          </div>
        `
      });
      
      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
      
      riskMarkersRef.current.push(marker);
    });
  }, [riskFactors]);

  return (
    <div ref={mapRef} className="w-full h-full" />
  );
}
