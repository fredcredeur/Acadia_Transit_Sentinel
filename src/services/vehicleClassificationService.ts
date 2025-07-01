import { Vehicle, VehicleClass, RoutingConstraints } from '../types';

export class VehicleClassificationService {
  
  static classifyVehicle(vehicle: Vehicle): VehicleClass {
    const { length, width, height } = vehicle;
    
    // Passenger Vehicle (cars, small vans)
    if (length <= 20 && width <= 7 && height <= 7) {
      return {
        type: 'passenger',
        canMakeUTurns: true,
        requiresBlockRouting: false,
        minTurningRadius: 20,
        maxTurnAngle: 180,
        avoidResidential: false,
        avoidNarrowStreets: false,
        preferTruckRoutes: false
      };
    }
    
    // Delivery Vehicle (box trucks, delivery vans)
    if (length <= 26 && width <= 8 && height <= 10) {
      return {
        type: 'delivery',
        canMakeUTurns: length <= 22, // Smaller delivery vehicles can still U-turn
        requiresBlockRouting: length > 22,
        minTurningRadius: 35,
        maxTurnAngle: length <= 22 ? 180 : 120,
        avoidResidential: false,
        avoidNarrowStreets: true,
        preferTruckRoutes: false
      };
    }
    
    // Bus (city bus, school bus, coach)
    if (length >= 30 && length <= 45 && width <= 8.5) {
      return {
        type: 'bus',
        canMakeUTurns: false, // Buses should NEVER make U-turns
        requiresBlockRouting: true,
        minTurningRadius: 45,
        maxTurnAngle: 90, // Only 90-degree turns max
        avoidResidential: true,
        avoidNarrowStreets: true,
        preferTruckRoutes: true
      };
    }
    
    // Large Truck (semi-truck, large delivery)
    if (length >= 35 || width >= 8.5 || height >= 12) {
      return {
        type: 'truck',
        canMakeUTurns: false,
        requiresBlockRouting: true,
        minTurningRadius: 55,
        maxTurnAngle: 90,
        avoidResidential: true,
        avoidNarrowStreets: true,
        preferTruckRoutes: true
      };
    }
    
    // Oversized (anything larger)
    return {
      type: 'oversized',
      canMakeUTurns: false,
      requiresBlockRouting: true,
      minTurningRadius: 70,
      maxTurnAngle: 45, // Very wide turns only
      avoidResidential: true,
      avoidNarrowStreets: true,
      preferTruckRoutes: true
    };
  }
  
  static getRoutingConstraints(vehicleClass: VehicleClass): RoutingConstraints {
    return {
      avoidUTurns: !vehicleClass.canMakeUTurns,
      avoidSharpTurns: vehicleClass.maxTurnAngle < 120,
      avoidResidential: vehicleClass.avoidResidential,
      avoidNarrowStreets: vehicleClass.avoidNarrowStreets,
      preferLoops: vehicleClass.requiresBlockRouting,
      minRoadWidth: vehicleClass.type === 'passenger' ? 0 : 
                   vehicleClass.type === 'delivery' ? 20 : 30,
      maxTurnAngle: vehicleClass.maxTurnAngle
    };
  }
  
  static getVehicleDescription(vehicleClass: VehicleClass): string {
    const descriptions = {
      passenger: 'Passenger Vehicle - Can navigate freely including U-turns',
      delivery: 'Delivery Vehicle - Limited turning capability',
      bus: 'Bus/Coach - Requires block routing, no U-turns',
      truck: 'Large Truck - Requires truck routes, no U-turns', 
      oversized: 'Oversized Vehicle - Extremely limited routing options'
    };
    
    return descriptions[vehicleClass.type];
  }
}
