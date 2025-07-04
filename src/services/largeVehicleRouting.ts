// Enhanced routing algorithm for large vehicles (buses/trucks)
// Prioritizes traffic lights over stop signs, even with longer distances

import { RouteSegment, Vehicle, Route } from '../types';

interface IntersectionData {
  id: string;
  lat: number;
  lng: number;
  type: 'traffic_light' | 'stop_sign' | 'yield' | 'roundabout' | 'uncontrolled';
  roadTypes: string[]; // ['primary', 'secondary', 'residential', etc.]
  averageTrafficVolume: number; // vehicles per hour
  pedestrianCrossing: boolean;
  schoolZone: boolean;
  isHighwayEntrance: boolean;
  laneCount: number;
  hasRightTurnLane: boolean;
  hasLeftTurnLane: boolean;
}

interface LargeVehicleRoutingConfig {
  vehicle: Vehicle;
  maxDetourDistance: number; // Maximum extra distance willing to travel (miles)
  maxDetourTime: number; // Maximum extra time willing to add (minutes)
  avoidStopSigns: boolean;
  prioritizeTrafficLights: boolean;
  avoidSchoolZones: boolean;
  requireTruckRoutes: boolean;
  minimumLaneWidth: number; // feet
}

class LargeVehicleRoutingAlgorithm {
  private static readonly LARGE_VEHICLE_THRESHOLD = 30; // feet length
  private static readonly BUS_LENGTH_THRESHOLD = 35; // feet length
  
  /**
   * Enhanced risk scoring for large vehicles at intersections
   */
  static calculateIntersectionRisk(
    intersection: IntersectionData, 
    vehicle: Vehicle,
    approachingSpeed: number = 25 // mph
  ): number {
    let riskScore = 0;
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const isBus = vehicle.length >= this.BUS_LENGTH_THRESHOLD;
    
    // Base risk by intersection type
    switch (intersection.type) {
      case 'stop_sign':
        riskScore += isLargeVehicle ? 85 : 45; // Much higher risk for large vehicles
        break;
      case 'traffic_light':
        riskScore += isLargeVehicle ? 25 : 20; // Much lower risk
        break;
      case 'yield':
        riskScore += isLargeVehicle ? 70 : 35;
        break;
      case 'roundabout':
        riskScore += isLargeVehicle ? 90 : 30; // Very difficult for large vehicles
        break;
      case 'uncontrolled':
        riskScore += isLargeVehicle ? 95 : 60; // Extremely dangerous
        break;
    }
    
    // Large vehicle specific risk factors
    if (isLargeVehicle) {
      // Stopping distance concerns at stop signs
      if (intersection.type === 'stop_sign') {
        const stoppingDistance = this.calculateStoppingDistance(vehicle, approachingSpeed);
        if (stoppingDistance > 150) riskScore += 20; // 150+ feet stopping distance
        if (stoppingDistance > 200) riskScore += 30; // 200+ feet stopping distance
      }
      
      // Visibility issues - large vehicles block view for other drivers
      if (intersection.type === 'stop_sign' && intersection.averageTrafficVolume > 500) {
        riskScore += 25; // High traffic volume with poor visibility
      }
      
      // Turn radius concerns
      if (!intersection.hasRightTurnLane && vehicle.length > 40) {
        riskScore += 15; // Need to swing wide without dedicated lane
      }
      
      // Pedestrian interaction risk
      if (intersection.pedestrianCrossing && intersection.type === 'stop_sign') {
        riskScore += 30; // Pedestrians harder to see from large vehicle
      }
      
      // School zone multiplier
      if (intersection.schoolZone && intersection.type === 'stop_sign') {
        riskScore += 40; // Children unpredictable around large vehicles
      }
    }
    
    // Bus-specific considerations
    if (isBus) {
      // Passenger safety during stops/starts
      if (intersection.type === 'stop_sign') {
        riskScore += 15; // Sudden stops uncomfortable for passengers
      }
      
      // Schedule reliability
      if (intersection.averageTrafficVolume > 800 && intersection.type === 'stop_sign') {
        riskScore += 20; // Unpredictable delays affect schedule
      }
    }
    
    return Math.min(riskScore, 100);
  }
  
  /**
   * Calculate stopping distance for a vehicle at given speed
   */
  private static calculateStoppingDistance(vehicle: Vehicle, speed: number): number {
    // Reaction time (1.5 seconds) + braking distance
    // Large vehicles have longer reaction and braking distances
    const reactionTime = 1.5; // seconds
    const reactionDistance = (speed * 1.47) * reactionTime; // feet
    
    // Braking distance formula adjusted for vehicle weight
    const weightFactor = vehicle.length > 40 ? 1.4 : 1.2; // Heavier vehicles brake slower
    const brakingDistance = Math.pow(speed, 2) / (30 * 0.7) * weightFactor; // feet
    
    return reactionDistance + brakingDistance;
  }
  
  /**
   * Generate routing preferences for large vehicles
   */
  static getLargeVehicleRoutingConfig(vehicle: Vehicle): LargeVehicleRoutingConfig {
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const isBus = vehicle.length >= this.BUS_LENGTH_THRESHOLD;
    
    return {
      vehicle,
      maxDetourDistance: isLargeVehicle ? 3.0 : 1.0, // Willing to go 3 miles out of way
      maxDetourTime: isLargeVehicle ? 8 : 3, // Willing to add 8 minutes for safety
      avoidStopSigns: isLargeVehicle,
      prioritizeTrafficLights: isLargeVehicle,
      avoidSchoolZones: isBus, // Especially important for buses
      requireTruckRoutes: vehicle.length > 50,
      minimumLaneWidth: vehicle.width + 2 // Need 2 feet clearance on each side
    };
  }
  
  /**
   * Enhanced route scoring that heavily penalizes stop signs for large vehicles
   */
  static scoreRouteForLargeVehicle(
    route: Route, 
    vehicle: Vehicle, 
    intersections: IntersectionData[]
  ): number {
    const config = this.getLargeVehicleRoutingConfig(vehicle);
    let totalScore = 0;
    let totalDistance = route.totalDistance;
    let totalTime = route.estimatedTime;
    
    // Score each segment
    route.segments.forEach(segment => {
      let segmentScore = 0;
      
      // Find intersections in this segment
      const segmentIntersections = intersections.filter(intersection =>
        this.isIntersectionInSegment(intersection, segment)
      );
      
      segmentIntersections.forEach(intersection => {
        const intersectionRisk = this.calculateIntersectionRisk(intersection, vehicle);
        segmentScore += intersectionRisk;
        
        // Heavy penalty for stop signs on large vehicles
        if (config.avoidStopSigns && intersection.type === 'stop_sign') {
          segmentScore += 50; // Major penalty
          
          // Extra penalty for high-traffic stop signs
          if (intersection.averageTrafficVolume > 600) {
            segmentScore += 25;
          }
          
          // Extra penalty for multi-way stops
          if (intersection.roadTypes.length > 2) {
            segmentScore += 20; // Complex intersection
          }
        }
        
        // Bonus for traffic lights
        if (config.prioritizeTrafficLights && intersection.type === 'traffic_light') {
          segmentScore -= 20; // Significant bonus
        }
        
        // School zone penalties
        if (config.avoidSchoolZones && intersection.schoolZone) {
          segmentScore += 30;
        }
      });
      
      totalScore += segmentScore;
    });
    
    // Distance and time penalties (but less important than safety)
    const baseRoute = this.findShortestRoute(route); // Theoretical shortest route
    const extraDistance = totalDistance - baseRoute.distance;
    const extraTime = totalTime - baseRoute.time;
    
    // Small penalties for extra distance/time (safety is more important)
    if (extraDistance > config.maxDetourDistance) {
      totalScore += (extraDistance - config.maxDetourDistance) * 5;
    }
    
    if (extraTime > config.maxDetourTime) {
      totalScore += (extraTime - config.maxDetourTime) * 3;
    }
    
    return totalScore;
  }
  
  /**
   * Generate alternative routes that prioritize traffic lights over stop signs
   */
  static generateLargeVehicleRoutes(
    origin: string,
    destination: string,
    vehicle: Vehicle,
    intersections: IntersectionData[]
  ): Route[] {
    const config = this.getLargeVehicleRoutingConfig(vehicle);
    const routes: Route[] = [];
    
    // Strategy 1: Arterial roads with traffic lights
    const arterialRoute = this.generateArterialRoute(origin, destination, vehicle);
    if (arterialRoute) routes.push(arterialRoute);
    
    // Strategy 2: Highway/freeway when possible
    const highwayRoute = this.generateHighwayRoute(origin, destination, vehicle);
    if (highwayRoute) routes.push(highwayRoute);
    
    // Strategy 3: Truck routes (if vehicle qualifies)
    if (config.requireTruckRoutes) {
      const truckRoute = this.generateTruckRoute(origin, destination, vehicle);
      if (truckRoute) routes.push(truckRoute);
    }
    
    // Strategy 4: Loop route via major intersections
    const loopRoute = this.generateTrafficLightLoopRoute(origin, destination, vehicle, intersections);
    if (loopRoute) routes.push(loopRoute);
    
    // Score and rank routes
    return routes
      .map(route => ({
        ...route,
        largeVehicleScore: this.scoreRouteForLargeVehicle(route, vehicle, intersections)
      }))
      .sort((a, b) => a.largeVehicleScore - b.largeVehicleScore);
  }
  
  /**
   * Generate route that prioritizes arterial roads with traffic lights
   */
  private static generateArterialRoute(origin: string, destination: string, vehicle: Vehicle): Route | null {
    // Implementation would use mapping service to find routes that:
    // 1. Use major arterial roads (typically have traffic lights)
    // 2. Avoid residential streets (typically have stop signs)
    // 3. Prefer roads classified as "primary" or "secondary"
    
    // This would integrate with Google Maps Directions API with preferences:
    const routePreferences = {
      avoid: ['tolls'], // Don't avoid highways for large vehicles
      mode: 'driving',
      alternatives: true,
      optimize_waypoints: true,
      // Custom parameters for large vehicles:
      vehicle_type: 'large_truck',
      prefer_arterials: true,
      avoid_residential: true,
      min_road_width: vehicle.width + 4 // Minimum road width needed
    };
    
    // Mock implementation - in real code, this would call the routing service
    return this.createMockRoute('arterial', origin, destination, vehicle);
  }
  
  /**
   * Generate route that uses highways and controlled access roads
   */
  private static generateHighwayRoute(origin: string, destination: string, vehicle: Vehicle): Route | null {
    // Prefer highways and controlled access roads - no stop signs!
    const routePreferences = {
      prefer: ['highways', 'controlled_access'],
      avoid: ['surface_streets'],
      vehicle_restrictions: {
        height: vehicle.height,
        length: vehicle.length,
        width: vehicle.width
      }
    };
    
    return this.createMockRoute('highway', origin, destination, vehicle);
  }
  
  /**
   * Generate route using designated truck routes
   */
  private static generateTruckRoute(origin: string, destination: string, vehicle: Vehicle): Route | null {
    // Use official truck routes which are designed for large vehicles
    const routePreferences = {
      vehicle_type: 'truck',
      restrictions: {
        height: vehicle.height,
        length: vehicle.length,
        width: vehicle.width,
        weight: this.estimateVehicleWeight(vehicle)
      },
      prefer_truck_routes: true,
      avoid_restrictions: true
    };
    
    return this.createMockRoute('truck_route', origin, destination, vehicle);
  }
  
  /**
   * Generate route that specifically seeks out traffic light intersections
   */
  private static generateTrafficLightLoopRoute(
    origin: string, 
    destination: string, 
    vehicle: Vehicle,
    intersections: IntersectionData[]
  ): Route | null {
    // Find path that connects traffic light intersections, even if longer
    const trafficLightIntersections = intersections.filter(i => i.type === 'traffic_light');
    
    if (trafficLightIntersections.length < 2) return null;
    
    // Create waypoints at major traffic light intersections
    const waypoints = this.selectOptimalTrafficLightWaypoints(
      origin, 
      destination, 
      trafficLightIntersections,
      vehicle
    );
    
    return this.createMockRoute('traffic_light_loop', origin, destination, vehicle, waypoints);
  }
  
  /**
   * Select optimal traffic light intersections as waypoints
   */
  private static selectOptimalTrafficLightWaypoints(
    origin: string,
    destination: string,
    trafficLights: IntersectionData[],
    vehicle: Vehicle
  ): string[] {
    // Score traffic lights based on:
    // 1. Position relative to origin/destination
    // 2. Road capacity for large vehicles
    // 3. Turn lane availability
    
    return trafficLights
      .filter(tl => 
        tl.laneCount >= 2 && // At least 2 lanes
        !tl.schoolZone && // Avoid school zones
        tl.averageTrafficVolume < 1200 // Not too congested
      )
      .slice(0, 3) // Maximum 3 waypoints
      .map(tl => `${tl.lat},${tl.lng}`);
  }
  
  /**
   * Utility functions
   */
  private static isIntersectionInSegment(intersection: IntersectionData, segment: RouteSegment): boolean {
    // Check if intersection coordinates fall within segment bounds
    const segmentBounds = {
      north: Math.max(segment.startLat, segment.endLat) + 0.001,
      south: Math.min(segment.startLat, segment.endLat) - 0.001,
      east: Math.max(segment.startLng, segment.endLng) + 0.001,
      west: Math.min(segment.startLng, segment.endLng) - 0.001
    };
    
    return intersection.lat >= segmentBounds.south &&
           intersection.lat <= segmentBounds.north &&
           intersection.lng >= segmentBounds.west &&
           intersection.lng <= segmentBounds.east;
  }
  
  private static estimateVehicleWeight(vehicle: Vehicle): number {
    // Rough weight estimation based on dimensions
    const volume = vehicle.length * vehicle.width * vehicle.height;
    return volume * 0.02; // Rough conversion factor to tons
  }
  
  private static findShortestRoute(route: Route): { distance: number; time: number } {
    // This would calculate theoretical shortest distance/time
    // For now, return route values with 10% reduction as baseline
    return {
      distance: route.totalDistance * 0.9,
      time: route.estimatedTime * 0.9
    };
  }
  
  private static createMockRoute(
    type: string, 
    origin: string, 
    destination: string, 
    vehicle: Vehicle,
    waypoints?: string[]
  ): Route {
    // Mock route creation - in real implementation, this would call routing service
    const baseDistance = 10; // Mock distance
    const multiplier = type === 'traffic_light_loop' ? 1.3 : 
                      type === 'highway' ? 0.9 : 1.0;
    
    return {
      id: `${type}-${Date.now()}`,
      name: `${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Route`,
      segments: [], // Would be populated by routing service
      totalDistance: baseDistance * multiplier,
      estimatedTime: (baseDistance * multiplier) / 30 * 60, // Assume 30 mph average
      criticalPoints: [],
      stops: waypoints?.map((wp, i) => ({
        id: `waypoint-${i}`,
        address: wp,
        order: i
      })),
      overallRisk: 0 // Default/mock value; should be calculated in real implementation
    };
  }
}

/**
 * Integration with existing risk calculator
 */
export class EnhancedRiskCalculator {
  static calculateLargeVehicleRisk(route: Route, vehicle: Vehicle): number {
    const isLargeVehicle = vehicle.length >= 30;
    
    if (!isLargeVehicle) {
      // Use existing risk calculation for smaller vehicles
      return this.calculateStandardRisk(route, vehicle);
    }
    
    // Enhanced risk calculation for large vehicles
    let totalRisk = 0;
    let intersectionCount = 0;
    
    route.segments.forEach(segment => {
      let segmentRisk = this.calculateStandardSegmentRisk(segment, vehicle);
      
      // Apply large vehicle penalties
      if (segment.riskFactors) {
        // Heavy penalty for stop signs
        if (segment.description?.toLowerCase().includes('stop')) {
          segmentRisk += 40;
        }
        
        // Bonus for traffic lights
        if (segment.description?.toLowerCase().includes('traffic light')) {
          segmentRisk -= 15;
        }
        
        // Penalty for narrow roads
        if (segment.riskFactors.roadWidth > 50) {
          segmentRisk += 25;
        }
        
        // School zone penalty
        if (segment.description?.toLowerCase().includes('school')) {
          segmentRisk += 30;
        }
      }
      
      totalRisk += segmentRisk;
      intersectionCount++;
    });
    
    return intersectionCount > 0 ? totalRisk / intersectionCount : 0;
  }
  
  private static calculateStandardRisk(route: Route, vehicle: Vehicle): number {
    // Placeholder for existing risk calculation
    return 50;
  }
  
  private static calculateStandardSegmentRisk(segment: RouteSegment, vehicle: Vehicle): number {
    // Placeholder for existing segment risk calculation
    return 30;
  }
  
  /**
   * Generate safety recommendations for large vehicles
   */
  static getLargeVehicleSafetyRecommendations(route: Route, vehicle: Vehicle): string[] {
    const recommendations: string[] = [];
    const isLargeVehicle = vehicle.length >= 30;
    const isBus = vehicle.length >= 35;
    
    if (!isLargeVehicle) return recommendations;
    
    // Analyze route for stop sign intersections
    const stopSignCount = route.segments.filter(segment =>
      segment.description?.toLowerCase().includes('stop')
    ).length;
    
    if (stopSignCount > 3) {
      recommendations.push(
        `⚠️ Route contains ${stopSignCount} stop sign intersections - consider alternative route with traffic lights`
      );
    }
    
    if (stopSignCount > 0) {
      recommendations.push(
        `🛑 At stop signs: Allow extra stopping distance (${LargeVehicleRoutingAlgorithm['calculateStoppingDistance'](vehicle, 25).toFixed(0)} ft at 25 mph)`
      );
      
      recommendations.push(
        `👁️ Use extra caution at stop signs - your vehicle blocks visibility for other drivers`
      );
    }
    
    if (isBus) {
      recommendations.push(
        `🚌 Bus operation: Warn passengers before stops, use smooth acceleration/deceleration`
      );
      
      recommendations.push(
        `⏰ Allow extra time for schedule reliability due to intersection delays`
      );
    }
    
    // Check for school zones
    const hasSchoolZones = route.segments.some(segment =>
      segment.description?.toLowerCase().includes('school')
    );
    
    if (hasSchoolZones) {
      recommendations.push(
        `🏫 School zones detected - reduce speed and increase following distance`
      );
    }
    
    return recommendations;
  }
}

export { LargeVehicleRoutingAlgorithm };
