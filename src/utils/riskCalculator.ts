import { Vehicle, RouteSegment, Route } from '../types';

export interface TurnAnalysis {
  angle: number;
  radius: number;
  difficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
  clearanceRequired: number;
  recommendation: string;
}

export interface RiskBreakdown {
  pedestrianRisk: number;
  maneuveringRisk: number;
  infrastructureRisk: number;
  trafficRisk: number;
  overallRisk: number;
  primaryConcerns: string[];
  recommendations: string[];
}

export class RiskCalculator {
  private static readonly WEIGHTS = {
    pedestrianTraffic: 0.25,
    roadWidth: 0.25,
    trafficCongestion: 0.15,
    speedLimit: 0.10,
    heightRestriction: 0.15,
    turnComplexity: 0.10
  };

  // Bus-specific constants for 40-foot vehicles
  private static readonly BUS_CONSTANTS = {
    TURNING_RADIUS: 42, // feet - typical for 40ft bus
    REAR_OVERHANG: 8,   // feet - rear overhang from rear axle
    FRONT_OVERHANG: 6,  // feet - front overhang from front axle
    WHEELBASE: 26,      // feet - distance between axles
    SAFE_CLEARANCE: 3   // feet - minimum safe clearance
  };

  static calculateSegmentRisk(segment: RouteSegment, vehicle: Vehicle): number {
    const factors = segment.riskFactors;
    
    // Calculate individual risk components
    const pedestrianRisk = this.calculatePedestrianRisk(factors.pedestrianTraffic, vehicle);
    const maneuveringRisk = this.calculateManeuveringRisk(factors.roadWidth, vehicle);
    const infrastructureRisk = this.calculateInfrastructureRisk(factors.heightRestriction, vehicle.height);
    const trafficRisk = this.calculateTrafficRisk(factors.trafficCongestion, factors.speedLimit);
    const turnRisk = this.calculateTurnRisk(segment, vehicle);

    // Weighted risk calculation
    const riskScore = 
      (pedestrianRisk * this.WEIGHTS.pedestrianTraffic) +
      (maneuveringRisk * this.WEIGHTS.roadWidth) +
      (trafficRisk * this.WEIGHTS.trafficCongestion) +
      (this.getSpeedRisk(factors.speedLimit) * this.WEIGHTS.speedLimit) +
      (infrastructureRisk * this.WEIGHTS.heightRestriction) +
      (turnRisk * this.WEIGHTS.turnComplexity);

    return Math.min(Math.max(riskScore, 0), 100);
  }

  static calculateDetailedRisk(segment: RouteSegment, vehicle: Vehicle): RiskBreakdown {
    const factors = segment.riskFactors;
    
    const pedestrianRisk = this.calculatePedestrianRisk(factors.pedestrianTraffic, vehicle);
    const maneuveringRisk = this.calculateManeuveringRisk(factors.roadWidth, vehicle);
    const infrastructureRisk = this.calculateInfrastructureRisk(factors.heightRestriction, vehicle.height);
    const trafficRisk = this.calculateTrafficRisk(factors.trafficCongestion, factors.speedLimit);
    
    const overallRisk = this.calculateSegmentRisk(segment, vehicle);
    
    const primaryConcerns: string[] = [];
    const recommendations: string[] = [];

    // Analyze primary concerns
    if (pedestrianRisk > 60) {
      primaryConcerns.push('Heavy pedestrian activity');
      recommendations.push('Reduce speed in pedestrian areas and use extra caution at crosswalks');
    }
    
    if (maneuveringRisk > 60) {
      primaryConcerns.push('Limited maneuvering space');
      recommendations.push('Use spotters for tight spaces and consider alternative routes during peak hours');
    }
    
    if (infrastructureRisk > 80) {
      primaryConcerns.push('Height clearance critical');
      recommendations.push('Verify exact vehicle height and consider alternative route');
    }
    
    if (trafficRisk > 70) {
      primaryConcerns.push('Heavy traffic congestion');
      recommendations.push('Plan for extended travel time and maintain safe following distance');
    }

    // Turn-specific analysis for buses
    if (this.isBusLength(vehicle)) {
      const turnAnalysis = this.analyzeTurn(segment, vehicle);
      if (turnAnalysis.difficulty === 'very_difficult' || turnAnalysis.difficulty === 'difficult') {
        primaryConcerns.push(`${turnAnalysis.difficulty === 'very_difficult' ? 'Very difficult' : 'Difficult'} turn maneuver`);
        recommendations.push(turnAnalysis.recommendation);
      }
    }

    return {
      pedestrianRisk,
      maneuveringRisk,
      infrastructureRisk,
      trafficRisk,
      overallRisk,
      primaryConcerns,
      recommendations
    };
  }

  static calculateRouteRisk(route: Route, vehicle: Vehicle): number {
    if (route.segments.length === 0) return 0;

    const segmentRisks = route.segments.map(segment => 
      this.calculateSegmentRisk(segment, vehicle)
    );
    
    // Weight higher risk segments more heavily
    const weightedRisks = segmentRisks.map(risk => {
      if (risk > 80) return risk * 1.3; // Critical segments get 30% more weight
      if (risk > 60) return risk * 1.15; // High risk segments get 15% more weight
      return risk;
    });
    
    return Math.min(weightedRisks.reduce((sum, risk) => sum + risk, 0) / weightedRisks.length, 100);
  }

  static compareRoutes(routes: Route[], vehicle: Vehicle): Array<Route & { 
    riskBreakdown: RiskBreakdown; 
    busSpecificFactors: string[];
    timeVsRiskRatio: number;
  }> {
    return routes.map(route => {
      const overallRisk = this.calculateRouteRisk(route, vehicle);
      
      // Calculate average risk breakdown for the route
      const segmentBreakdowns = route.segments.map(segment => 
        this.calculateDetailedRisk(segment, vehicle)
      );
      
      const avgBreakdown: RiskBreakdown = {
        pedestrianRisk: segmentBreakdowns.reduce((sum, b) => sum + b.pedestrianRisk, 0) / segmentBreakdowns.length,
        maneuveringRisk: segmentBreakdowns.reduce((sum, b) => sum + b.maneuveringRisk, 0) / segmentBreakdowns.length,
        infrastructureRisk: segmentBreakdowns.reduce((sum, b) => sum + b.infrastructureRisk, 0) / segmentBreakdowns.length,
        trafficRisk: segmentBreakdowns.reduce((sum, b) => sum + b.trafficRisk, 0) / segmentBreakdowns.length,
        overallRisk,
        primaryConcerns: [...new Set(segmentBreakdowns.flatMap(b => b.primaryConcerns))],
        recommendations: [...new Set(segmentBreakdowns.flatMap(b => b.recommendations))]
      };

      // Bus-specific factors
      const busSpecificFactors: string[] = [];
      
      if (this.isBusLength(vehicle)) {
        const difficultTurns = route.segments.filter(segment => {
          const turnAnalysis = this.analyzeTurn(segment, vehicle);
          return turnAnalysis.difficulty === 'difficult' || turnAnalysis.difficulty === 'very_difficult';
        }).length;
        
        if (difficultTurns > 0) {
          busSpecificFactors.push(`${difficultTurns} challenging turn${difficultTurns > 1 ? 's' : ''} for 40ft vehicle`);
        }

        const heightRestrictions = route.segments.filter(segment => 
          segment.riskFactors.heightRestriction > 0 && 
          segment.riskFactors.heightRestriction <= vehicle.height + 1
        ).length;
        
        if (heightRestrictions > 0) {
          busSpecificFactors.push(`${heightRestrictions} height restriction${heightRestrictions > 1 ? 's' : ''} to monitor`);
        }

        const narrowSections = route.segments.filter(segment => 
          segment.riskFactors.roadWidth > 60
        ).length;
        
        if (narrowSections > 0) {
          busSpecificFactors.push(`${narrowSections} narrow section${narrowSections > 1 ? 's' : ''} requiring careful navigation`);
        }
      }

      // Time vs. risk is no longer a simple ratio, handled in sort.
      return {
        ...route,
        overallRisk,
        riskBreakdown: avgBreakdown,
        busSpecificFactors,
        timeVsRiskRatio: 0 // Placeholder, not used in new sort
      };
    }).sort((a, b) => {
      // Sort by overall risk first.
      if (Math.abs(a.overallRisk - b.overallRisk) >= 5) {
        return a.overallRisk - b.overallRisk;
      }
      
      // If risks are similar (within 5 points), prioritize the faster route.
      return a.estimatedTime - b.estimatedTime;
    });
  }

  static analyzeTurn(segment: RouteSegment, vehicle: Vehicle): TurnAnalysis {
    // Simulate turn analysis based on segment characteristics
    // In production, this would use actual turn angle data from Google Maps
    
    const streetName = segment.streetName.toLowerCase();
    let estimatedAngle = 0;
    
    // Estimate turn angle from street name and risk factors
    if (streetName.includes('turn') || segment.riskFactors.roadWidth > 70) {
      estimatedAngle = 90 + (segment.riskFactors.roadWidth - 50); // Sharper turns for narrow roads
    } else if (segment.riskFactors.pedestrianTraffic > 80) {
      estimatedAngle = 45; // Moderate turns in pedestrian areas
    } else {
      estimatedAngle = 30; // Gentle curves
    }

    // Clamp angle between 0 and 180
    estimatedAngle = Math.min(Math.max(estimatedAngle, 0), 180);

    const radius = this.calculateTurnRadius(estimatedAngle, vehicle);
    const clearanceRequired = this.calculateClearanceRequired(estimatedAngle, vehicle);
    
    let difficulty: TurnAnalysis['difficulty'] = 'easy';
    let recommendation = 'Standard turning procedure';

    if (estimatedAngle > 120) {
      difficulty = 'very_difficult';
      recommendation = 'Very sharp turn - use spotter, check for pedestrians, and take wide approach';
    } else if (estimatedAngle > 90) {
      difficulty = 'difficult';
      recommendation = 'Sharp turn - reduce speed, check mirrors, and ensure adequate clearance';
    } else if (estimatedAngle > 60) {
      difficulty = 'moderate';
      recommendation = 'Moderate turn - maintain awareness of rear overhang swing';
    }

    // Adjust difficulty based on road width
    if (segment.riskFactors.roadWidth > 70 && difficulty !== 'very_difficult') {
      difficulty = difficulty === 'easy' ? 'moderate' : 'difficult';
      recommendation += '. Narrow road requires extra caution';
    }

    return {
      angle: estimatedAngle,
      radius,
      difficulty,
      clearanceRequired,
      recommendation
    };
  }

  private static calculatePedestrianRisk(pedestrianTraffic: number, vehicle: Vehicle): number {
    let risk = pedestrianTraffic;
    
    // Larger vehicles pose higher risk to pedestrians
    const sizeMultiplier = this.getVehicleSizeMultiplier(vehicle);
    risk *= sizeMultiplier;
    
    // Bus-specific adjustments
    if (this.isBusLength(vehicle)) {
      risk *= 1.2; // Buses have larger blind spots
    }
    
    return Math.min(risk, 100);
  }

  private static calculateManeuveringRisk(roadWidth: number, vehicle: Vehicle): number {
    let risk = roadWidth;
    
    // Adjust for vehicle width
    if (vehicle.width > 8) risk *= 1.8;
    else if (vehicle.width > 7) risk *= 1.4;
    
    // Adjust for vehicle length (turning radius)
    if (vehicle.length > 35) risk *= 1.6;
    else if (vehicle.length > 25) risk *= 1.3;
    
    return Math.min(risk, 100);
  }

  private static calculateInfrastructureRisk(clearanceHeight: number, vehicleHeight: number): number {
    if (clearanceHeight === 0) return 0;
    
    const clearance = clearanceHeight - vehicleHeight;
    
    if (clearance <= 0) return 100; // Cannot pass
    if (clearance <= 0.5) return 95; // Extremely risky
    if (clearance <= 1) return 80;   // Very risky
    if (clearance <= 2) return 40;   // Moderate risk
    return 10; // Low risk
  }

  private static calculateTrafficRisk(congestion: number, speedLimit: number): number {
    let risk = congestion * 0.7; // Base congestion risk
    
    // Higher speed limits with congestion are more dangerous
    if (speedLimit > 45 && congestion > 60) {
      risk *= 1.3;
    }
    
    return Math.min(risk, 100);
  }

  private static calculateTurnRisk(segment: RouteSegment, vehicle: Vehicle): number {
    if (!this.isBusLength(vehicle)) return 0;
    
    const turnAnalysis = this.analyzeTurn(segment, vehicle);
    
    switch (turnAnalysis.difficulty) {
      case 'very_difficult': return 90;
      case 'difficult': return 70;
      case 'moderate': return 40;
      default: return 10;
    }
  }

  private static calculateTurnRadius(angle: number, vehicle: Vehicle): number {
    // Simplified calculation for turn radius based on vehicle length and turn angle
    const wheelbase = vehicle.length * 0.65; // Approximate wheelbase
    return wheelbase / Math.tan(Math.min(angle, 45) * Math.PI / 180);
  }

  private static calculateClearanceRequired(angle: number, vehicle: Vehicle): number {
    // Calculate the clearance required for rear overhang swing
    const rearOverhang = vehicle.length * 0.2; // Approximate rear overhang
    return rearOverhang * Math.sin(angle * Math.PI / 180);
  }

  private static getVehicleSizeMultiplier(vehicle: Vehicle): number {
    const size = vehicle.length * vehicle.width;
    if (size > 300) return 1.5; // Large vehicle
    if (size > 200) return 1.2; // Medium vehicle
    return 1.0; // Standard vehicle
  }

  private static getSpeedRisk(speedLimit: number): number {
    // Higher speed limits increase risk for large vehicles
    if (speedLimit > 55) return 60;
    if (speedLimit > 45) return 40;
    if (speedLimit > 35) return 25;
    return 15;
  }

  private static isBusLength(vehicle: Vehicle): boolean {
    return vehicle.length >= 35 && vehicle.length <= 45;
  }

  static getRiskColor(riskScore: number): string {
    if (riskScore >= 80) return '#DC2626'; // Red-600
    if (riskScore >= 60) return '#EA580C'; // Orange-600
    if (riskScore >= 40) return '#F59E0B'; // Amber-500
    if (riskScore >= 20) return '#84CC16'; // Lime-500
    return '#10B981'; // Emerald-500
  }

  static getRiskLabel(riskScore: number): string {
    if (riskScore >= 80) return 'Critical Risk';
    if (riskScore >= 60) return 'High Risk';
    if (riskScore >= 40) return 'Medium Risk';
    if (riskScore >= 20) return 'Low Risk';
    return 'Minimal Risk';
  }

  static getBusSpecificAdvice(vehicle: Vehicle, route: Route): string[] {
    const advice: string[] = [];
    
    if (!this.isBusLength(vehicle)) {
      return advice;
    }

    // General bus advice
    advice.push('Plan for wider turning radius - allow extra space at intersections');
    advice.push('Monitor rear overhang swing during turns to avoid obstacles');
    advice.push('Use mirrors frequently and consider blind spot monitoring');
    
    // Route-specific advice
    const difficultTurns = route.segments.filter(segment => {
      const turnAnalysis = this.analyzeTurn(segment, vehicle);
      return turnAnalysis.difficulty === 'difficult' || turnAnalysis.difficulty === 'very_difficult';
    });
    
    if (difficultTurns.length > 0) {
      advice.push(`${difficultTurns.length} challenging turn${difficultTurns.length > 1 ? 's' : ''} identified - consider using a spotter`);
    }

    const heightRestrictions = route.segments.filter(segment => 
      segment.riskFactors.heightRestriction > 0
    );
    
    if (heightRestrictions.length > 0) {
      advice.push('Height restrictions present - verify clearances before departure');
    }

    return advice;
  }
}
