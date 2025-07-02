// routeAnalysisService.ts - Fixed version matching your existing types
import { Route, RouteSegment, RiskFactor, CriticalPoint, Vehicle, NamedRiskFactor } from '../types';

// Define risk factors and their locations extending your existing NamedRiskFactor
interface ExtendedRiskFactor extends NamedRiskFactor {
  type: 'construction' | 'pedestrian' | 'traffic' | 'infrastructure' | 'emergency' | 'weather';
  impactRadius: number;
  timeRestrictions?: {
    startTime: string;
    endTime: string;
    days: string[];
  };
  heightRestriction?: number;
}

// Mock risk factors for different areas
const riskFactors: ExtendedRiskFactor[] = [
  {
    id: "rf_001",
    name: "Downtown Construction Zone",
    description: "Active construction with lane restrictions",
    severity: 'high',
    location: { lat: 44.3400, lng: -68.2700 },
    type: 'construction',
    impactRadius: 500,
    timeRestrictions: {
      startTime: '07:00',
      endTime: '17:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }
  },
  {
    id: "rf_002",
    name: "School Zone - Bar Harbor Elementary",
    description: "Heavy pedestrian traffic during school hours",
    severity: 'medium',
    location: { lat: 44.3355, lng: -68.2045 },
    type: 'pedestrian',
    impactRadius: 300,
    timeRestrictions: {
      startTime: '07:30',
      endTime: '08:30',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }
  },
  {
    id: "rf_003",
    name: "Tourist Congestion Area",
    description: "High traffic volume during peak season",
    severity: 'medium',
    location: { lat: 44.3386, lng: -68.2733 },
    type: 'traffic',
    impactRadius: 1000,
    timeRestrictions: {
      startTime: '09:00',
      endTime: '18:00',
      days: ['saturday', 'sunday']
    }
  },
  {
    id: "rf_004",
    name: "Narrow Bridge",
    description: "Single lane bridge with height restriction",
    severity: 'high',
    location: { lat: 44.3200, lng: -68.2900 },
    type: 'infrastructure',
    impactRadius: 100,
    heightRestriction: 12.5
  },
  {
    id: "rf_005",
    name: "Emergency Services Area",
    description: "Hospital and fire station emergency access",
    severity: 'medium',
    location: { lat: 44.3450, lng: -68.2600 },
    type: 'emergency',
    impactRadius: 400
  }
];

/**
 * Enhanced route analysis service with comprehensive risk assessment
 */
export class RouteAnalysisService {
  
  /**
   * Analyze a route and identify risk factors and critical points
   */
  static analyzeRouteRisk(route: Route, vehicle?: Vehicle): {
    route: Route;
    riskFactors: NamedRiskFactor[];
    overallRiskScore: number;
  } {
    const affectedRiskFactors: NamedRiskFactor[] = [];
    const criticalPoints: CriticalPoint[] = [];
    let totalRiskScore = 0;
    let segmentCount = 0;

    // Analyze each segment for risk factors
    route.segments.forEach((segment, index) => {
      const segmentRisks = this.analyzeSegmentRisks(segment, vehicle);
      
      // Find nearby risk factors
      const nearbyFactors = riskFactors.filter(factor => 
        this.isPointNearSegment(factor.location, segment, factor.impactRadius)
      );

      nearbyFactors.forEach(factor => {
        if (!affectedRiskFactors.find(existing => existing.id === factor.id)) {
          affectedRiskFactors.push(factor);
        }

        // Create critical point if severity is high enough
        if (factor.severity === 'high' || (factor.severity === 'medium' && segmentRisks.totalRisk > 60)) {
          criticalPoints.push({
            segmentId: segment.id,
            position: index,
            type: this.getCriticalPointType(factor.type),
            riskLevel: factor.severity === 'high' ? 'critical' : 'high',
            description: `${factor.name}: ${factor.description}`
          });
        }
      });

      totalRiskScore += segmentRisks.totalRisk;
      segmentCount++;
    });

    const overallRiskScore = segmentCount > 0 ? totalRiskScore / segmentCount : 0;

    // Update route with analysis results
    const analyzedRoute: Route = {
      ...route,
      criticalPoints,
      overallRisk: overallRiskScore,
      segments: route.segments.map(segment => ({
        ...segment,
        riskFactors: this.calculateSegmentRiskFactors(segment, vehicle),
        riskScore: this.analyzeSegmentRisks(segment, vehicle).totalRisk
      }))
    };

    return {
      route: analyzedRoute,
      riskFactors: affectedRiskFactors,
      overallRiskScore
    };
  }

  /**
   * Analyze risks for a specific segment
   */
  private static analyzeSegmentRisks(segment: RouteSegment, vehicle?: Vehicle): {
    totalRisk: number;
    factors: string[];
  } {
    let totalRisk = 0;
    const factors: string[] = [];

    // Base risk from segment type
    if (segment.streetName.toLowerCase().includes('main')) {
      totalRisk += 20;
      factors.push('main_street');
    }
    if (segment.streetName.toLowerCase().includes('school')) {
      totalRisk += 30;
      factors.push('school_zone');
    }

    // Intersection and Turn Type Risks
    if (segment.intersectionType === 'stop_sign') {
      let stopSignPenalty = 15; // Base penalty for stop signs
      if (segment.turnType === 'left') {
        stopSignPenalty += 25; // Higher penalty for left turns at stop signs
        factors.push('stop_sign_left_turn');
      } else {
        factors.push('stop_sign_intersection');
      }
      // Increase penalty for large vehicles
      if (vehicle && (vehicle.length > 30 || vehicle.height > 12)) {
        stopSignPenalty += 15; 
      }
      totalRisk += stopSignPenalty;
    } else if (segment.intersectionType === 'traffic_light') {
      totalRisk -= 10; // Reward traffic lights (safer)
      factors.push('traffic_light_intersection');
    }

    // Vehicle-specific risks
    if (vehicle) {
      if (vehicle.height > 12 && segment.description.toLowerCase().includes('bridge')) {
        totalRisk += 40;
        factors.push('height_restriction');
      }
      if (vehicle.length > 40 && segment.description.toLowerCase().includes('narrow')) {
        totalRisk += 35;
        factors.push('narrow_road');
      }
    }

    // Time-based risks (simplified)
    const currentHour = new Date().getHours();
    if (currentHour >= 7 && currentHour <= 9) {
      totalRisk += 15; // Morning rush
      factors.push('rush_hour');
    }
    if (currentHour >= 17 && currentHour <= 19) {
      totalRisk += 15; // Evening rush
      factors.push('rush_hour');
    }

    return {
      totalRisk: Math.min(totalRisk, 100),
      factors
    };
  }

  /**
   * Calculate risk factors for a segment matching your RiskFactors interface
   */
  private static calculateSegmentRiskFactors(segment: RouteSegment, vehicle?: Vehicle) {
    const riskFactors = {
      trafficCongestion: Math.random() * 80, // Mock data
      pedestrianTraffic: Math.random() * 60,
      roadWidth: Math.random() * 80,
      speedLimit: 25 + Math.random() * 30, // 25-55 mph
      heightRestriction: 0
    };

    // Add height restrictions for bridges
    if (segment.description.toLowerCase().includes('bridge')) {
      riskFactors.heightRestriction = 12.5 + Math.random() * 3;
    }

    // Adjust for vehicle type
    if (vehicle) {
      if (vehicle.length > 40) {
        riskFactors.roadWidth += 20; // Narrow roads are riskier for large vehicles
      }
      if (vehicle.height > 12) {
        // More concern about height restrictions
        if (riskFactors.heightRestriction > 0 && riskFactors.heightRestriction < vehicle.height + 1) {
          riskFactors.roadWidth = Math.max(riskFactors.roadWidth, 80);
        }
      }
    }

    return riskFactors;
  }

  /**
   * Check if a point is near a route segment
   */
  private static isPointNearSegment(
    point: { lat: number; lng: number },
    segment: RouteSegment,
    radiusMeters: number
  ): boolean {
    // Simple distance calculation (not accounting for Earth's curvature)
    const segmentMidLat = (segment.startLat + segment.endLat) / 2;
    const segmentMidLng = (segment.startLng + segment.endLng) / 2;
    
    const distance = this.calculateDistance(
      point.lat,
      point.lng,
      segmentMidLat,
      segmentMidLng
    );
    
    return distance <= radiusMeters;
  }

  /**
   * Calculate distance between two points in meters
   */
  private static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert risk factor type to critical point type
   */
  private static getCriticalPointType(riskType: string): CriticalPoint['type'] {
    switch (riskType) {
      case 'construction':
        return 'narrow_road';
      case 'infrastructure':
        return 'bridge';
      case 'pedestrian':
        return 'intersection';
      case 'traffic':
        return 'intersection';
      case 'emergency':
        return 'intersection';
      default:
        return 'intersection';
    }
  }

  /**
   * Get all available risk factors
   */
  static getAllRiskFactors(): NamedRiskFactor[] {
    return [...riskFactors];
  }

  /**
   * Get risk factors affecting a specific route
   */
  static getRiskFactorsForRoute(route: Route): NamedRiskFactor[] {
    const affectedFactors: NamedRiskFactor[] = [];
    
    route.segments.forEach(segment => {
      const nearbyFactors = riskFactors.filter(factor => 
        this.isPointNearSegment(factor.location, segment, factor.impactRadius)
      );
      
      nearbyFactors.forEach(factor => {
        if (!affectedFactors.find(existing => existing.id === factor.id)) {
          affectedFactors.push(factor);
        }
      });
    });
    
    return affectedFactors;
  }

  /**
   * Calculate risk score for current time and conditions
   */
  static calculateTimeBasedRisk(): number {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    let riskMultiplier = 1.0;
    
    // Rush hour multiplier
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      riskMultiplier += 0.3;
    }
    
    // Weekend tourist traffic
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (hour >= 10 && hour <= 16) {
        riskMultiplier += 0.2;
      }
    }
    
    // Night time reduced risk
    if (hour >= 22 || hour <= 5) {
      riskMultiplier -= 0.2;
    }
    
    return Math.max(0.5, Math.min(2.0, riskMultiplier));
  }

  /**
   * Generate safety recommendations based on route analysis
   */
  static generateSafetyRecommendations(
    route: Route,
    vehicle?: Vehicle
  ): string[] {
    const recommendations: string[] = [];
    const timeRisk = this.calculateTimeBasedRisk();
    
    // Time-based recommendations
    if (timeRisk > 1.2) {
      recommendations.push("Consider traveling during off-peak hours to reduce traffic risk");
    }
    
    // Critical points recommendations
    if (route.criticalPoints && route.criticalPoints.length > 0) {
      recommendations.push(`Route contains ${route.criticalPoints.length} critical point(s) - exercise extra caution`);
      
      const bridgePoints = route.criticalPoints.filter(cp => cp.type === 'bridge');
      if (bridgePoints.length > 0) {
        recommendations.push("Check vehicle height clearance before proceeding through bridge areas");
      }
      
      const intersectionPoints = route.criticalPoints.filter(cp => cp.type === 'intersection');
      if (intersectionPoints.length > 2) {
        recommendations.push("Multiple high-risk intersections detected - reduce speed and increase following distance");
      }
    }
    
    // Vehicle-specific recommendations
    if (vehicle) {
      if (vehicle.length > 40) {
        recommendations.push("Large vehicle detected - allow extra space for turns and lane changes");
      }
      if (vehicle.height > 12) {
        recommendations.push("Monitor overhead clearances and avoid low bridges");
      }
    }
    
    // Default safety recommendations
    if (recommendations.length === 0) {
      recommendations.push("Maintain safe following distance and observe all traffic regulations");
    }
    
    return recommendations;
  }
}

// Export convenience functions
export const analyzeRouteRisk = RouteAnalysisService.analyzeRouteRisk;
export const getAllRiskFactors = RouteAnalysisService.getAllRiskFactors;
export const getRiskFactorsForRoute = RouteAnalysisService.getRiskFactorsForRoute;
export const generateSafetyRecommendations = RouteAnalysisService.generateSafetyRecommendations;