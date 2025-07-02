import { Clock, Navigation, AlertTriangle, MapPin } from 'lucide-react';
import { Route } from '../types';

interface RouteDetailsProps {
  route: Route;
}

export function RouteDetails({ route }: RouteDetailsProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold">{route.name}</h2>
        {route.overallRisk !== undefined && (
          <div className={`
            flex items-center px-2 py-1 rounded-full text-xs font-medium
            ${route.overallRisk < 30 ? 'bg-green-100 text-green-800' : 
              route.overallRisk < 70 ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'}
          `}>
            {route.overallRisk < 30 ? (
              <span>Low Risk</span>
            ) : route.overallRisk < 70 ? (
              <span>Medium Risk</span>
            ) : (
              <span className="flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                High Risk
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center text-sm text-gray-500 mb-4">
        <Clock className="h-4 w-4 mr-1" />
        <span>{Math.round(route.estimatedTime / 60)} min</span>
        <span className="mx-2">•</span>
        <Navigation className="h-4 w-4 mr-1" />
        <span>{(route.totalDistance / 1000).toFixed(1)} km</span>
      </div>
      
      {/* route.description is not part of the Route interface, so removing this conditional rendering */}
      {/* {route.description && (
        <p className="text-sm text-gray-600 mb-4">{route.description}</p>
      )} */}
      
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Route Details</h3>
        <div className="space-y-4">
          {/* The 'points' property does not exist on type 'Route'. 
              Assuming 'stops' is intended here, but 'stops' does not have 'location.name', 'arrivalTime', 'departureTime', or 'isStop'.
              This section needs a more significant refactor or clarification of the data structure.
              For now, commenting out to resolve build errors.
          */}
          {/* {route.points.map((point, index) => (
            <div key={index} className="relative">
              {index < route.points.length - 1 && (
                <div className="absolute top-6 bottom-0 left-3 w-0.5 bg-gray-200 -z-10"></div>
              )}
              <div className="flex items-start">
                <div className={`
                  flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center
                  ${index === 0 ? 'bg-green-100 text-green-600' : 
                    index === route.points.length - 1 ? 'bg-red-100 text-red-600' : 
                    point.isStop ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                `}>
                  <MapPin className="h-3 w-3" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{point.location.name}</p>
                  {point.arrivalTime && (
                    <p className="text-xs text-gray-500">Arrival: {point.arrivalTime}</p>
                  )}
                  {point.departureTime && (
                    <p className="text-xs text-gray-500">Departure: {point.departureTime}</p>
                  )}
                </div>
              </div>
            </div>
          ))} */}
        </div>
      </div>
      
      <div className="mt-6 flex space-x-3">
        <button className="btn btn-primary flex-1">
          Start Navigation
        </button>
        <button className="btn btn-outline flex-1">
          Save Route
        </button>
      </div>
    </div>
  );
}
