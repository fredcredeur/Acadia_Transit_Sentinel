import { Vehicle, RouteSegment, Route, StopLocation } from '../types';

export interface RoadContext {
  type: 'residential' | 'commercial' | 'industrial' | 'highway' | 'arterial' | 'truck_route';
  isTruckFriendly: boolean;
  hasTrafficSignals: boolean;
  hasStopSigns: boolean;
  schoolZone: boolean;
  commercialLoading: boolean;
  designatedTruckRoute: boolean;
  // A new property to identify the type of turn
  turnDirection?: 'left' | 'right' | 'straight';
}

export interface TurnAnalysis {
  angle: number;
  radius: number;
  difficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
  clearanceRequired: number;
  recommendation: string;
}

export interface EnhancedRiskBreakdown {
  pedestrianRisk: number;
  maneuveringRisk: number;
  infrastructureRisk: number;
  trafficRisk: number;
  roadContextRisk: number;
  intersectionRisk: number;
  overallRisk: number;
  roadContext: RoadContext;
  primaryConcerns: string[];
  recommendations: string[];
  riskMitigators: string[]; // Things that REDUCE risk
}

export class RiskCalculator {
  // Revised weights that consider road context
  private static readonly WEIGHTS = {
    pedestrianTraffic: 0.15, 
    maneuvering: 0.20, // Increased maneuvering weight       
    infrastructure: 0.20,       
    traffic: 0.15,             
    roadContext: 0.15,
    intersection: 0.15 // Increased intersection weight
  };

  static calculateSegmentRisk(segment: RouteSegment, vehicle: Vehicle, nextSegmentContext: RoadContext | null = null): number {
    const roadContext = this.analyzeRoadContext(segment);
    const enhancedBreakdown = this.calculateEnhancedRisk(segment, vehicle, roadContext, nextSegmentContext);
    
    return enhancedBreakdown.overallRisk;
  }

  static calculateEnhancedRisk(
    segment: RouteSegment, 
    vehicle: Vehicle,
    roadContext: RoadContext,
    nextSegmentContext: RoadContext | null = null
  ): EnhancedRiskBreakdown {
    
    const context = roadContext || this.analyzeRoadContext(segment);
    const factors = segment.riskFactors;
    
    // Calculate risk components with context awareness
    const pedestrianRisk = this.calculateContextualPedestrianRisk(factors.pedestrianTraffic, vehicle, context);
    const maneuveringRisk = this.calculateVehicleSpecificManeuveringRisk(segment, vehicle, context);
    const infrastructureRisk = this.calculateInfrastructureRisk(factors.heightRestriction, vehicle.height);
    const trafficRisk = this.calculateIntelligentTrafficRisk(factors, context);
    const roadContextRisk = this.calculateRoadContextRisk(vehicle, context);
    const intersectionRisk = this.calculateIntersectionRisk(segment, vehicle, context, nextSegmentContext);
    
    // Apply weights with context modifiers
    const weightedRisk = 
      (pedestrianRisk * this.WEIGHTS.pedestrianTraffic) +
      (maneuveringRisk * this.WEIGHTS.maneuvering) +
      (infrastructureRisk * this.WEIGHTS.infrastructure) +
      (trafficRisk * this.WEIGHTS.traffic) +
      (roadContextRisk * this.WEIGHTS.roadContext) +
      (intersectionRisk * this.WEIGHTS.intersection);

    const _overallRisk = Math.min(Math.max(weightedRisk, 0), 100);
    
    const analysis = this.generateRiskAnalysis(
      { pedestrianRisk, maneuveringRisk, infrastructureRisk, trafficRisk, roadContextRisk, intersectionRisk },
      vehicle,
      context,
      _overallRisk
    );

    return {
      pedestrianRisk,
      maneuveringRisk,
      infrastructureRisk,
      trafficRisk,
      roadContextRisk,
      intersectionRisk,
      overallRisk: _overallRisk,
      roadContext: context,
      ...analysis
    };
  }

  private static analyzeRoadContext(segment: RouteSegment): RoadContext {
    const streetName = segment.streetName.toLowerCase();
    const factors = segment.riskFactors;
    const description = segment.description.toLowerCase();
    
    // Analyze road type from street name and characteristics
    let type: RoadContext['type'] = 'arterial'; // default
    let isTruckFriendly = false;
    let designatedTruckRoute = false;
    
    // Highway/Interstate detection
    if (streetName.includes('interstate') || streetName.includes('highway') || 
        streetName.includes('freeway') || streetName.match(/^i-?\d+/) || 
        streetName.match(/^us.?\d+/) || streetName.match(/^sr.?\d+/)) {
      type = 'highway';
      isTruckFriendly = true;
      designatedTruckRoute = true;
    }
    // Truck route detection
    else if (streetName.includes('truck route') || streetName.includes('industrial') || 
             streetName.includes('warehouse') || streetName.includes('port') ||
             streetName.includes('logistics') || streetName.includes('freight')) {
      type = 'truck_route';
      isTruckFriendly = true;
      designatedTruckRoute = true;
    }
    // Industrial area detection
    else if (streetName.includes('industrial') || streetName.includes('manufacturing') ||
             streetName.includes('distribution') || streetName.includes('rail')) {
      type = 'industrial';
      isTruckFriendly = true;
    }
    // Commercial detection
    else if (streetName.includes('commercial') || streetName.includes('business') || 
             streetName.includes('main st') || streetName.includes('broadway') ||
             factors.pedestrianTraffic > 60 && factors.speedLimit <= 35) {
      type = 'commercial';
      isTruckFriendly = factors.speedLimit >= 25; // Commercial with reasonable speeds
    }
    // Residential detection
    else if (streetName.includes('residential') || streetName.includes('subdivision') ||
             streetName.includes('circle') || streetName.includes('court') ||
             streetName.includes('lane') && factors.speedLimit <= 30) {
      type = 'residential';
      isTruckFriendly = false;
    }
    
    // Traffic control detection from speed patterns and congestion
    const hasTrafficSignals = factors.speedLimit >= 35 && factors.trafficCongestion > 40;
    const hasStopSigns = factors.speedLimit <= 25 && !hasTrafficSignals;
    
    // School zone detection
    const schoolZone = description.includes('school') || 
                      factors.speedLimit <= 20 ||
                      (factors.pedestrianTraffic > 80 && factors.speedLimit <= 25);
    
    // Commercial loading zone detection
    const commercialLoading = type === 'commercial' && factors.trafficCongestion > 50;

    // Detect turn direction
    let turnDirection: RoadContext['turnDirection'];
    if (description.includes('left')) {
        turnDirection = 'left';
    } else if (description.includes('right')) {
        turnDirection = 'right';
    } else {
        turnDirection = 'straight';
    }

    return {
      type,
      isTruckFriendly,
      hasTrafficSignals,
      hasStopSigns,
      schoolZone,
      commercialLoading,
      designatedTruckRoute,
      turnDirection
    };
  }

  private static calculateContextualPedestrianRisk(
    pedestrianTraffic: number, 
    vehicle: Vehicle, 
    context: RoadContext
  ): number {
    let risk = pedestrianTraffic;
    
    // Context-based adjustments
    switch (context.type) {
      case 'highway':
        risk = Math.max(risk - 70, 0); // Highways have minimal pedestrians
        break;
      case 'truck_route':
        risk = Math.max(risk - 40, 0); // Truck routes expect large vehicles
        break;
      case 'industrial':
        risk = Math.max(risk - 30, 10); // Industrial areas have some foot traffic
        break;
      case 'commercial':
        // Commercial areas have expected pedestrian activity
        if (context.hasTrafficSignals) {
          risk = Math.max(risk - 15, 0); // Signals manage pedestrian flow
        }
        break;
      case 'residential':
        risk += 20; // Large vehicles shouldn't be in residential
        break;
    }
    
    // School zone penalty
    if (context.schoolZone) {
      risk += 30;
    }
    
    // Vehicle size adjustment (smaller for appropriate roads)
    const sizeMultiplier = this.getContextAwareSizeMultiplier(vehicle, context);
    risk *= sizeMultiplier;
    
    return Math.min(risk, 100);
  }

  private static calculateVehicleSpecificManeuveringRisk(
    segment: RouteSegment, 
    vehicle: Vehicle, 
    context: RoadContext
  ): number {
    let risk = 0;
    
    // Base maneuvering difficulty
    const isLargeVehicle = vehicle.length >= 35 || vehicle.width >= 8.5;
    
    // Road width assessment - context matters!
    const roadWidthFactor = segment.riskFactors.roadWidth;
    
    if (context.isTruckFriendly) {
      // On truck-friendly roads, high roadWidth factor means GOOD (wide roads)
      risk = Math.max(100 - roadWidthFactor, 0);
    } else {
      // On non-truck roads, roadWidth factor represents narrowness
      risk = roadWidthFactor;
    }
    
    // Vehicle-specific adjustments
    if (isLargeVehicle) {
      if (context.type === 'residential') {
        risk += 40; // Large vehicles don't belong in residential
      } else if (context.designatedTruckRoute) {
        risk = Math.max(risk - 25, 0); // Designated truck routes are designed for this
      }
    }
    
    // Turn detection and analysis
    const streetName = segment.streetName.toLowerCase();
    if (streetName.includes('turn') || segment.description.includes('turn')) {
      const turnPenalty = isLargeVehicle ? 25 : 10;
      if (context.hasStopSigns) {
        risk += turnPenalty * 0.7; // Stop signs allow careful turning
      } else {
        risk += turnPenalty;
      }
    }
    
    return Math.min(risk, 100);
  }

  private static calculateIntelligentTrafficRisk(
    factors: { pedestrianTraffic: number; roadWidth: number; trafficCongestion: number; speedLimit: number; heightRestriction: number; }, 
    context: RoadContext
  ): number {
    let risk = factors.trafficCongestion;
    
    // Context adjustments
    if (context.type === 'highway' && factors.speedLimit >= 55) {
      // Highway congestion is more manageable for large vehicles
      risk *= 0.7;
    } else if (context.type === 'commercial' && context.hasTrafficSignals) {
      // Signalized commercial areas manage traffic flow
      risk *= 0.8;
    } else if (context.type === 'residential') {
      // Any congestion in residential is problematic for large vehicles
      risk *= 1.3;
    }
    
    // Speed limit considerations
    if (factors.speedLimit >= 45) {
      risk *= 0.9; // Higher speeds mean better flow (usually)
    } else if (factors.speedLimit <= 20) {
      risk *= 1.2; // Very low speeds indicate problematic areas
    }
    
    return Math.min(risk, 100);
  }

  private static calculateRoadContextRisk(vehicle: Vehicle, context: RoadContext): number {
    const isLargeVehicle = vehicle.length >= 35 || vehicle.width >= 8.5;
    
    // Base risk by context appropriateness
    let risk = 0;
    
    if (isLargeVehicle) {
      switch (context.type) {
        case 'highway':
          risk = 5; // Highways are ideal for large vehicles
          break;
        case 'truck_route':
          risk = 10; // Designated truck routes are very good
          break;
        case 'industrial':
          risk = 20; // Industrial areas expect large vehicles
          break;
        case 'arterial':
          risk = 30; // Major arterials can handle large vehicles
          break;
        case 'commercial':
          risk = context.hasTrafficSignals ? 40 : 60; // Depends on traffic management
          break;
        case 'residential':
          risk = 80; // Large vehicles don't belong in residential
          break;
      }
    } else {
      // Small vehicles have low context risk everywhere
      risk = context.type === 'residential' ? 10 : 5;
    }
    
    // Mitigating factors
    if (context.designatedTruckRoute) {
      risk = Math.max(risk - 20, 0);
    }
    
    if (context.schoolZone && isLargeVehicle) {
      risk += 25;
    }
    
    return Math.min(risk, 100);
  }

  private static calculateIntersectionRisk(
    segment: RouteSegment, 
    vehicle: Vehicle, 
    context: RoadContext,
    nextSegmentContext: RoadContext | null
  ): number {
    let risk = 0;
    const isLargeVehicle = vehicle.length >= 35;
    const description = segment.description.toLowerCase();
    
    const hasIntersection = description.includes('turn') || 
                           description.includes('intersection') ||
                           description.includes('cross');
    
    if (!hasIntersection) return 0;
    
    // Base intersection risk
    risk = 30;
    
    if (context.hasTrafficSignals) {
      risk = 15; // Prefer traffic lights
      if (isLargeVehicle && context.isTruckFriendly) {
        risk = 10;
      }
    } else if (context.hasStopSigns) {
      risk = 45; // Base penalty for stop signs
      // NEW: Major Road Crossing Penalty
      // Check if we're at a stop sign and the *next* road is a major one.
      if (nextSegmentContext && isLargeVehicle) {
        if (nextSegmentContext.type === 'arterial' || nextSegmentContext.type === 'highway' || nextSegmentContext.type === 'commercial') {
           risk += 35; // Add a very large penalty for crossing a busy road from a stop.
        }
      }
      // NEW: Penalty for unprotected left turns
      if (context.turnDirection === 'left') {
        risk += 20;
      }

    } else {
      risk = 50; // Uncontrolled
    }
    
    if (context.type === 'residential' && isLargeVehicle) {
      risk += 25;
    } else if (context.type === 'highway') {
      risk = Math.max(risk - 20, 10);
    }
    
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

  private static getContextAwareSizeMultiplier(vehicle: Vehicle, context: RoadContext): number {
    const isLargeVehicle = vehicle.length >= 35;
    
    if (!isLargeVehicle) return 1.0; // Small vehicles get no penalty
    
    // Large vehicle multipliers based on context appropriateness
    switch (context.type) {
      case 'highway':
      case 'truck_route':
        return 0.8; // Actually SAFER for large vehicles on appropriate roads
      case 'industrial':
        return 0.9;
      case 'arterial':
        return 1.0;
      case 'commercial':
        return context.hasTrafficSignals ? 1.1 : 1.3;
      case 'residential':
        return 1.8; // High penalty for residential
      default:
        return 1.2;
    }
  }

  private static generateRiskAnalysis(
    risks: {
      pedestrianRisk: number;
      maneuveringRisk: number;
      infrastructureRisk: number;
      trafficRisk: number;
      roadContextRisk: number;
      intersectionRisk: number;
    },
    vehicle: Vehicle,
    context: RoadContext,
    overallRisk: number
  ): { primaryConcerns: string[]; recommendations: string[]; riskMitigators: string[] } {
    
    const concerns: string[] = [];
    const recommendations: string[] = [];
    const mitigators: string[] = [];
    
    // Risk analysis
    if (risks.infrastructureRisk > 80) {
      concerns.push('Critical height clearance issue');
      recommendations.push('Verify exact vehicle height and find alternative route');
    }
    
    if (risks.roadContextRisk > 60) {
      concerns.push('Road type not suitable for vehicle size');
      if (context.type === 'residential') {
        recommendations.push('Avoid residential areas - use arterial roads or designated truck routes');
      } else {
        recommendations.push('Consider alternative route on truck-designated roads');
      }
    }
    
    if (risks.pedestrianRisk > 60 && !context.schoolZone) {
      concerns.push('High pedestrian activity');
      recommendations.push('Reduce speed and maintain extra vigilance for pedestrians');
    } else if (context.schoolZone) {
      concerns.push('School zone - heightened pedestrian risk');
      recommendations.push('Observe school zone speed limits and watch for children');
    }
    
    if (risks.intersectionRisk > 40) {
      concerns.push('Complex intersection navigation');
      if (context.hasTrafficSignals) {
        recommendations.push('Use traffic signals for safe turning - wait for full green cycle');
      } else {
        recommendations.push('Exercise extreme caution at intersection - use spotter if available');
      }
    }
    
    if (risks.maneuveringRisk > 50) {
      concerns.push('Limited maneuvering space');
      recommendations.push('Plan wide turns and check for adequate clearance');
    }
    
    // Risk mitigators (things that REDUCE risk)
    if (context.designatedTruckRoute) {
      mitigators.push('Designated truck route - road designed for large vehicles');
    }
    
    if (context.hasTrafficSignals && vehicle.length >= 35) {
      mitigators.push('Traffic signals provide controlled intersection environment');
    }
    
    if (context.type === 'highway' || context.type === 'truck_route') {
      mitigators.push('Road infrastructure appropriate for large vehicles');
    }
    
    if (context.isTruckFriendly) {
      mitigators.push('Truck-friendly road design with adequate width and turning radii');
    }
    
    return { primaryConcerns: concerns, recommendations, mitigators };
  }

  // Existing methods with minor updates...
  static calculateStopRisk(stop: StopLocation, vehicle: Vehicle): number {
    let risk = (stop.estimatedStopTime || 15) * 0.5;
    const sizeMultiplier = this.getVehicleSizeMultiplier(vehicle);
    risk *= sizeMultiplier;
    return Math.min(risk, 100);
  }

  static calculateRouteRisk(route: Route, vehicle: Vehicle): number {
    if (route.segments.length === 0) return 0;

    const segmentRisks = route.segments.map((segment, index) => {
      // Get the context of the NEXT segment to analyze the intersection
      const nextSegment = route.segments[index + 1];
      const nextSegmentContext = nextSegment ? this.analyzeRoadContext(nextSegment) : null;
      // Pass the next segment's context to the risk calculator for the CURRENT segment
      return this.calculateSegmentRisk(segment, vehicle, nextSegmentContext);
    });
    
    const weightedRisks = segmentRisks.map(risk => {
      if (risk > 80) return risk * 1.3;
      if (risk > 60) return risk * 1.15;
      return risk;
    });

    const stopRisks = route.stops?.map((stop: StopLocation) => this.calculateStopRisk(stop, vehicle)) || [];
    const totalRisk = weightedRisks.reduce((sum: number, risk: number) => sum + risk, 0) + 
                     stopRisks.reduce((sum: number, risk: number) => sum + risk, 0);
    const totalItems = weightedRisks.length + stopRisks.length;

    return totalItems > 0 ? Math.min(totalRisk / totalItems, 100) : 0;
  }

  static compareRoutes(routes: Route[], vehicle: Vehicle): Route[] {
    return routes.map(route => {
      const overallRisk = this.calculateRouteRisk(route, vehicle);
      const riskBreakdowns = route.segments.map((segment, index) => {
        const nextSegment = route.segments[index + 1];
        const nextSegmentContext = nextSegment ? this.analyzeRoadContext(nextSegment) : null;
        return this.calculateEnhancedRisk(segment, vehicle, this.analyzeRoadContext(segment), nextSegmentContext)
      });
      
      return {
        ...route,
        overallRisk,
        enhancedRiskBreakdowns: riskBreakdowns
      };
    }).sort((a, b) => a.overallRisk - b.overallRisk); // Sort strictly by overall risk
  }

  private static getVehicleSizeMultiplier(vehicle: Vehicle): number {
    if (vehicle.length >= 35) return 1.4;
    if (vehicle.length >= 25) return 1.2;
    if (vehicle.width >= 8) return 1.3;
    return 1.0;
  }

  private static isBusLength(vehicle: Vehicle): boolean {
    return vehicle.length >= 30 && vehicle.length <= 45;
  }

  // ... (include other existing methods like analyzeTurn, etc.)
  
  static getRiskColor(riskScore: number): string {
    if (riskScore > 80) return '#DC2626'; // Red-600
    if (riskScore > 60) return '#F59E0B'; // Amber-500
    if (riskScore > 40) return '#FBBF24'; // Amber-400
    if (riskScore > 20) return '#A3E635'; // Lime-400
    return '#4ADE80'; // Green-400
  }

  static getRiskLabel(riskScore: number): string {
    if (riskScore > 80) return 'Critical';
    if (riskScore > 60) return 'High';
    if (riskScore > 40) return 'Medium';
    if (riskScore > 20) return 'Low';
    return 'Very Low';
  }

  static calculateDetailedRisk(segment: RouteSegment, vehicle: Vehicle): EnhancedRiskBreakdown {
    // This function is called in isolation, so it won't have the 'nextSegmentContext'.
    // That's okay, the default null value will handle it gracefully. The most accurate
    // risk is calculated at the full route level.
    return this.calculateEnhancedRisk(segment, vehicle, this.analyzeRoadContext(segment));
  }

  static analyzeTurn(segment: RouteSegment, vehicle: Vehicle): TurnAnalysis {
    const isLargeVehicle = vehicle.length >= 35;
    const roadWidth = segment.riskFactors.roadWidth;
    const angle = Math.random() * 60 + 60; // Simulate turn angle
    const clearanceRequired = vehicle.width * 1.5 + (isLargeVehicle ? 10 : 5);
    
    let difficulty: TurnAnalysis['difficulty'] = 'easy';
    if (angle > 90 && roadWidth < 30) {
      difficulty = 'very_difficult';
    } else if (angle > 75 || roadWidth < 40) {
      difficulty = 'difficult';
    } else if (isLargeVehicle) {
      difficulty = 'moderate';
    }

    return {
      angle,
      radius: roadWidth / 2,
      difficulty,
      clearanceRequired,
      recommendation: 'Proceed with caution'
    };
  }

  static getBusSpecificAdvice(vehicle: Vehicle, _route: Route): string[] {
    const advice: string[] = [];
    if (vehicle.length >= 35) {
      advice.push('Account for rear overhang swing during turns.');
      advice.push('Use mirrors and blind spot monitoring systems actively.');
    }
    return advice;
  }
}