import { Loader } from '@googlemaps/js-api-loader';
import { Location, Route, RoutePoint } from '../types';

let googleMapsLoader: Promise<typeof google> | null = null;

export function initGoogleMaps(): Promise<typeof google> {
  if (googleMapsLoader) return googleMapsLoader;
  
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing'));
  }
  
  const loader = new Loader({
    apiKey,
    version: 'weekly',
    libraries: ['places', 'routes']
  });
  
  googleMapsLoader = loader.load();
  return googleMapsLoader;
}

export async function geocodeAddress(address: string): Promise<Location | null> {
  await initGoogleMaps();
  
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const result = results[0];
        const location: Location = {
          id: result.place_id || `location-${Date.now()}`,
          name: address,
          address: result.formatted_address || address,
          position: {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng()
          }
        };
        resolve(location);
      } else {
        resolve(null);
      }
    });
  });
}

export async function getDirections(
  origin: Location,
  destination: Location,
  waypoints: Location[] = []
): Promise<Route | null> {
  await initGoogleMaps();
  
  return new Promise((resolve) => {
    const directionsService = new google.maps.DirectionsService();
    
    const waypointsList = waypoints.map(wp => ({
      location: new google.maps.LatLng(wp.position.lat, wp.position.lng),
      stopover: true
    }));
    
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.position.lat, origin.position.lng),
        destination: new google.maps.LatLng(destination.position.lat, destination.position.lng),
        waypoints: waypointsList,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const route = result.routes[0];
          const leg = route.legs[0];
          
          if (!leg) {
            resolve(null);
            return;
          }
          
          const points: RoutePoint[] = [];
          
          // Add origin
          points.push({
            location: origin,
            departureTime: new Date().toLocaleTimeString(),
            isStop: true
          });
          
          // Add waypoints
          waypoints.forEach((waypoint, index) => {
            const waypointLeg = route.legs[index];
            points.push({
              location: waypoint,
              arrivalTime: new Date().toLocaleTimeString(),
              departureTime: new Date(Date.now() + 5 * 60000).toLocaleTimeString(),
              isStop: true
            });
          });
          
          // Add destination
          points.push({
            location: destination,
            arrivalTime: new Date(Date.now() + leg.duration.value * 1000).toLocaleTimeString(),
            isStop: true
          });
          
          const newRoute: Route = {
            id: `route-${Date.now()}`,
            name: `Route to ${destination.name}`,
            points,
            distance: leg.distance.value,
            duration: leg.duration.value
          };
          
          resolve(newRoute);
        } else {
          resolve(null);
        }
      }
    );
  });
}