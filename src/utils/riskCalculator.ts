import { Vehicle, RouteSegment, Route, StopLocation } from '../types';

export interface RoadContext {
  type: 'residential' | 'commercial' | 'industrial' | 'highway' | 'arterial' | 'truck_route';
  isTruckFriendly: boolean;
  hasTrafficSignals: boolean;
  hasStopSigns: boolean;
  schoolZone: boolean;
  commercialLoading: boolean;
  designatedTruckRoute: boolean;
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
  riskMitigators: string[];
}

export class RiskCalculator {
  // Enhanced weights for large vehicle and bus operations
  private static readonly WEIGHTS = {
    pedestrianTraffic: 0.15, 
    maneuvering: 0.25, // Increased for large vehicles       
    infrastructure: 0.20,       
    traffic: 0.10, // Reduced - traffic is manageable for large vehicles             
    roadContext: 0.15,
    intersection: 0.15 // Critical for bus operations
  };

  // 🚌 BUS-SPECIFIC WEIGHTS (prioritize intersection safety)
  private static readonly BUS_WEIGHTS = {
    pedestrianTraffic: 0.20, // Higher - buses interact more with pedestrians
    maneuvering: 0.20,       
    infrastructure: 0.15,       
    traffic: 0.05, // Lower - buses expect some traffic             
    roadContext: 0.20, // Higher - road type is critical for buses
    intersection: 0.20 // Highest - intersection type is crucial for buses
  };

  // 🔧 DETERMINISTIC SEED GENERATOR - Creates consistent "random" values based on input
  private static generateDeterministicValue(seed: string, min: number = 0, max: number = 100): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      // Force hash to 32-bit integer
      hash |= 0;
    }
    
    // Normalize to 0-1 range, then scale to min-max
    const normalized = Math.abs(hash) / 2147483647; // Max 32-bit int
    return min + (normalized * (max - min));
  }

  // 🔧 CONSISTENT RISK FACTORS - Generate deterministic risk factors based on segment characteristics
  private static generateConsistentRiskFactors(segment: RouteSegment): typeof segment.riskFactors {
    const streetName = segment.streetName.toLowerCase();
    const description = segment.description.toLowerCase();
    
    // Create a unique seed based on segment characteristics
    const seed = `${streetName}-${description}-${segment.startLat.toFixed(4)}-${segment.startLng.toFixed(4)}`;
    
    // Generate consistent values based on road type
    let basePedestrianTraffic = 30;
    let baseRoadWidth = 50;
    let baseTrafficCongestion = 40;
    let baseSpeedLimit = 35;
    let baseHeightRestriction = 0;
    
    // Adjust base values based on road characteristics
    if (streetName.includes('highway') || streetName.includes('interstate')) {
      basePedestrianTraffic = 5;
      baseRoadWidth = 20; // Lower number = wider road (less risk)
      baseTrafficCongestion = 60;
      baseSpeedLimit = 65;
    } else if (streetName.includes('main') || streetName.includes('commercial') || streetName.includes('broadway')) {
      basePedestrianTraffic = 70;
      baseRoadWidth = 40;
      baseTrafficCongestion = 65;
      baseSpeedLimit = 30;
    } else if (streetName.includes('residential') || streetName.includes('subdivision') || streetName.includes('lane')) {
      basePedestrianTraffic = 45;
      baseRoadWidth = 60; // Higher number = narrower road (more risk)
      baseTrafficCongestion = 25;
      baseSpeedLimit = 25;
    } else if (streetName.includes('industrial') || streetName.includes('truck')) {
      basePedestrianTraffic = 15;
      baseRoadWidth = 25;
      baseTrafficCongestion = 35;
      baseSpeedLimit = 40;
    }
    
    // Add school zone detection
    if (description.includes('school')) {
      basePedestrianTraffic += 30;
      baseSpeedLimit = Math.min(baseSpeedLimit, 20);
    }
    
    // Add bridge/height restriction detection
    if (description.includes('bridge') || description.includes('overpass')) {
      baseHeightRestriction = this.generateDeterministicValue(seed + '-height', 11, 14);
    }
    
    // Generate small variations for realism, but keep them consistent
    const variation = 10; // ±10% variation
    
    return {
      pedestrianTraffic: Math.max(0, Math.min(100, 
        basePedestrianTraffic + this.generateDeterministicValue(seed + '-ped', -variation, variation)
      )),
      roadWidth: Math.max(0, Math.min(100, 
        baseRoadWidth + this.generateDeterministicValue(seed + '-width', -variation, variation)
      )),
      trafficCongestion: Math.max(0, Math.min(100, 
        baseTrafficCongestion + this.generateDeterministicValue(seed + '-traffic', -variation, variation)
      )),
      speedLimit: Math.max(15, Math.min(80, 
        baseSpeedLimit + this.generateDeterministicValue(seed + '-speed', -5, 5)
      )),
      heightRestriction: baseHeightRestriction
    };
  }

  static calculateSegmentRisk(segment: RouteSegment, vehicle: Vehicle, nextSegmentContext: RoadContext | null = null): number {
    // 🔧 ENSURE CONSISTENT RISK FACTORS
    const consistentSegment = {
      ...segment,
      riskFactors: this.generateConsistentRiskFactors(segment)
    };
    
    const roadContext = this.analyzeRoadContext(consistentSegment);
    const enhancedBreakdown = this.calculateEnhancedRisk(consistentSegment, vehicle, roadContext, nextSegmentContext);
    
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
    const isBus = vehicle.length >= 35;
    
    // Use bus-specific weights for buses
    const weights = isBus ? this.BUS_WEIGHTS : this.WEIGHTS;
    
    // Calculate risk components with context awareness
    const pedestrianRisk = this.calculateContextualPedestrianRisk(factors.pedestrianTraffic, vehicle, context);
    const maneuveringRisk = this.calculateVehicleSpecificManeuveringRisk(segment, vehicle, context);
    const infrastructureRisk = this.calculateInfrastructureRisk(factors.heightRestriction, vehicle.height);
    const trafficRisk = this.calculateIntelligentTrafficRisk(factors, context);
    const roadContextRisk = this.calculateRoadContextRisk(vehicle, context);
    const intersectionRisk = this.calculateIntersectionRisk(segment, vehicle, context, nextSegmentContext);
    
    // Apply weights with context modifiers
    const weightedRisk = 
      (pedestrianRisk * weights.pedestrianTraffic) +
      (maneuveringRisk * weights.maneuvering) +
      (infrastructureRisk * weights.infrastructure) +
      (trafficRisk * weights.traffic) +
      (roadContextRisk * weights.roadContext) +
      (intersectionRisk * weights.intersection);

    const overallRisk = Math.min(Math.max(weightedRisk, 0), 100);
    
    const analysis = this.generateRiskAnalysis(
      { pedestrianRisk, maneuveringRisk, infrastructureRisk, trafficRisk, roadContextRisk, intersectionRisk },
      vehicle,
      context,
      overallRisk
    );

    return {
      pedestrianRisk,
      maneuveringRisk,
      infrastructureRisk,
      trafficRisk,
      roadContextRisk,
      intersectionRisk,
      overallRisk,
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
      isTruckFriendly = factors.speedLimit >= 25;
    }
    // Residential detection
    else if (streetName.includes('residential') || streetName.includes('subdivision') ||
             streetName.includes('circle') || streetName.includes('court') ||
             streetName.includes('lane') && factors.speedLimit <= 30) {
      type = 'residential';
      isTruckFriendly = false;
    }
    
    // 🚦 ENHANCED TRAFFIC CONTROL DETECTION for buses
    // Arterial roads and highways typically have traffic signals
    const hasTrafficSignals = type === 'highway' || type === 'arterial' || 
                             (type === 'commercial' && factors.speedLimit >= 35) ||
                             factors.speedLimit >= 40;
    
    // Residential and local roads typically have stop signs
    const hasStopSigns = type === 'residential' || 
                        (type === 'commercial' && factors.speedLimit <= 25) ||
                        factors.speedLimit <= 25;
    
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
    const isBus = vehicle.length >= 35;
    
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
        risk += isBus ? 30 : 20; // Buses especially shouldn't be in residential
        break;
    }
    
    // School zone penalty (especially for buses)
    if (context.schoolZone) {
      risk += isBus ? 40 : 30;
    }
    
    // Vehicle size adjustment
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
    
    const isLargeVehicle = vehicle.length >= 35 || vehicle.width >= 8.5;
    const isBus = vehicle.length >= 35;
    
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
        risk += isBus ? 50 : 40; // Buses especially don't belong in residential
      } else if (context.designatedTruckRoute) {
        risk = Math.max(risk - 30, 0); // Designated routes are designed for this
      } else if (context.type === 'highway' || context.type === 'arterial') {
        risk = Math.max(risk - 20, 0); // Highways and arterials can handle large vehicles
      }
    }
    
    // Turn detection and analysis
    const streetName = segment.streetName.toLowerCase();
    if (streetName.includes('turn') || segment.description.includes('turn')) {
      const turnPenalty = isBus ? 30 : (isLargeVehicle ? 25 : 10);
      
      // 🚦 CRITICAL: Traffic lights vs stop signs for turns
      if (context.hasTrafficSignals) {
        risk += turnPenalty * 0.5; // Traffic lights allow controlled, planned turns
      } else if (context.hasStopSigns) {
        risk += turnPenalty * 1.2; // Stop signs require complete stops and careful navigation
      } else {
        risk += turnPenalty; // Uncontrolled turns
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
      risk *= 0.6;
    } else if (context.type === 'commercial' && context.hasTrafficSignals) {
      // Signalized commercial areas manage traffic flow better
      risk *= 0.7;
    } else if (context.type === 'residential') {
      // Any congestion in residential is problematic for large vehicles
      risk *= 1.4;
    }
    
    // Speed limit considerations
    if (factors.speedLimit >= 45) {
      risk *= 0.8; // Higher speeds mean better flow
    } else if (factors.speedLimit <= 20) {
      risk *= 1.3; // Very low speeds indicate problematic areas
    }
    
    return Math.min(risk, 100);
  }

  private static calculateRoadContextRisk(vehicle: Vehicle, context: RoadContext): number {
    const isLargeVehicle = vehicle.length >= 35 || vehicle.width >= 8.5;
    const isBus = vehicle.length >= 35;
    
    // Base risk by context appropriateness
    let risk = 0;
    
    if (isLargeVehicle) {
      switch (context.type) {
        case 'highway':
          risk = 5; // Highways are ideal for large vehicles
          break;
        case 'truck_route':
          risk = 8; // Designated truck routes are very good
          break;
        case 'arterial':
          risk = isBus ? 15 : 25; // Arterials are good for buses, okay for trucks
          break;
        case 'industrial':
          risk = 20; // Industrial areas expect large vehicles
          break;
        case 'commercial':
          // 🚦 CRITICAL: Traffic signals make commercial areas much safer for buses
          if (context.hasTrafficSignals) {
            risk = isBus ? 25 : 35; // Buses prefer signalized commercial areas
          } else {
            risk = isBus ? 50 : 45; // Stop signs in commercial areas are problematic
          }
          break;
        case 'residential':
          risk = isBus ? 85 : 75; // Buses especially don't belong in residential
          break;
      }
    } else {
      // Small vehicles have low context risk everywhere
      risk = context.type === 'residential' ? 10 : 5;
    }
    
    // Mitigating factors
    if (context.designatedTruckRoute) {
      risk = Math.max(risk - 25, 0);
    }
    
    if (context.schoolZone && isLargeVehicle) {
      risk += isBus ? 30 : 25;
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
    const isBus = vehicle.length >= 35;
    const description = segment.description.toLowerCase();
    
    const hasIntersection = description.includes('turn') || 
                           description.includes('intersection') ||
                           description.includes('cross');
    
    if (!hasIntersection) return 0;
    
    // Base intersection risk
    risk = 30;
    
    // 🚦 CRITICAL BUS LOGIC: Traffic lights are MUCH better than stop signs
    if (context.hasTrafficSignals) {
      risk = isBus ? 10 : 15; // Buses strongly prefer traffic lights
      
      if (isLargeVehicle && context.isTruckFriendly) {
        risk = isBus ? 8 : 12; // Even better on truck-friendly roads
      }
    } else if (context.hasStopSigns) {
      // 🛑 STOP SIGNS ARE PROBLEMATIC FOR BUSES
      risk = isBus ? 60 : 45; // Heavy penalty for buses at stop signs
      
      // Major road crossing penalty
      if (nextSegmentContext && isLargeVehicle) {
        if (nextSegmentContext.type === 'arterial' || nextSegmentContext.type === 'highway' || nextSegmentContext.type === 'commercial') {
           risk += isBus ? 40 : 30; // Buses get extra penalty for crossing major roads at stop signs
        }
      }
      
      // Unprotected left turns at stop signs
      if (context.turnDirection === 'left') {
        risk += isBus ? 25 : 20;
      }
    } else {
      // Uncontrolled intersections
      risk = isBus ? 70 : 55; // Very problematic for large vehicles
    }
    
    // Additional context penalties
    if (context.type === 'residential' && isLargeVehicle) {
      risk += isBus ? 30 : 25;
    } else if (context.type === 'highway') {
      risk = Math.max(risk - 20, 5); // Highway intersections are generally better designed
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
    const isBus = vehicle.length >= 35;
    
    if (!isLargeVehicle) return 1.0;
    
    // Large vehicle multipliers based on context appropriateness
    switch (context.type) {
      case 'highway':
      case 'truck_route':
        return 0.7; // Actually SAFER for large vehicles on appropriate roads
      case 'arterial':
        return isBus ? 0.8 : 0.9; // Buses do well on arterials
      case 'industrial':
        return 0.9;
      case 'commercial':
        return context.hasTrafficSignals ? (isBus ? 1.0 : 1.1) : (isBus ? 1.4 : 1.3);
      case 'residential':
        return isBus ? 2.0 : 1.8; // Very high penalty, especially for buses
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
    const isBus = vehicle.length >= 35;
    
    // Risk analysis
    if (risks.infrastructureRisk > 80) {
      concerns.push('Critical height clearance issue');
      recommendations.push('Verify exact vehicle height and find alternative route');
    }
    
    if (risks.roadContextRisk > 60) {
      concerns.push('Road type not suitable for vehicle size');
      if (context.type === 'residential') {
        recommendations.push(isBus ? 'Buses should avoid residential areas - use arterial roads with traffic signals' : 'Avoid residential areas - use arterial roads or designated truck routes');
      } else {
        recommendations.push('Consider alternative route on truck-designated roads');
      }
    }
    
    if (risks.intersectionRisk > 50) {
      concerns.push('Complex intersection navigation');
      if (context.hasTrafficSignals) {
        recommendations.push(isBus ? 'Use traffic signals for safe turning - wait for full green cycle and announce stops to passengers' : 'Use traffic signals for safe turning - wait for full green cycle');
      } else if (context.hasStopSigns) {
        recommendations.push(isBus ? '🚌 STOP SIGN ALERT: Complete stop required - use extreme caution, check blind spots, announce stop to passengers' : 'Exercise extreme caution at stop sign - use spotter if available');
      } else {
        recommendations.push('Uncontrolled intersection - proceed with extreme caution');
      }
    }
    
    if (risks.pedestrianRisk > 60 && !context.schoolZone) {
      concerns.push('High pedestrian activity');
      recommendations.push(isBus ? 'Reduce speed, watch for passengers, and maintain extra vigilance for pedestrians' : 'Reduce speed and maintain extra vigilance for pedestrians');
    } else if (context.schoolZone) {
      concerns.push('School zone - heightened pedestrian risk');
      recommendations.push(isBus ? 'School zone: Observe speed limits, watch for children, use extra caution during school hours' : 'Observe school zone speed limits and watch for children');
    }
    
    if (risks.maneuveringRisk > 50) {
      concerns.push('Limited maneuvering space');
      recommendations.push(isBus ? 'Plan wide turns (42ft radius), check mirrors, and ensure adequate clearance for rear overhang' : 'Plan wide turns and check for adequate clearance');
    }
    
    // Risk mitigators (things that REDUCE risk)
    if (context.designatedTruckRoute) {
      mitigators.push(isBus ? 'Designated truck route - road designed for large vehicles and buses' : 'Designated truck route - road designed for large vehicles');
    }
    
    if (context.hasTrafficSignals && vehicle.length >= 35) {
      mitigators.push(isBus ? '🚦 Traffic signals provide controlled intersection environment - ideal for bus operations' : 'Traffic signals provide controlled intersection environment');
    }
    
    if (context.type === 'highway' || context.type === 'truck_route') {
      mitigators.push(isBus ? 'Highway infrastructure appropriate for large vehicles and buses' : 'Road infrastructure appropriate for large vehicles');
    }
    
    if (context.isTruckFriendly) {
      mitigators.push(isBus ? 'Truck-friendly road design with adequate width and turning radii for bus operations' : 'Truck-friendly road design with adequate width and turning radii');
    }
    
    return { primaryConcerns: concerns, recommendations, riskMitigators: mitigators };
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
      const nextSegment = route.segments[index + 1];
      const nextSegmentContext = nextSegment ? this.analyzeRoadContext(nextSegment) : null;
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
    }).sort((a, b) => a.overallRisk - b.overallRisk);
  }

  private static getVehicleSizeMultiplier(vehicle: Vehicle): number {
    if (vehicle.length >= 35) return 1.4;
    if (vehicle.length >= 25) return 1.2;
    if (vehicle.width >= 8) return 1.3;
    return 1.0;
  }

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
    return this.calculateEnhancedRisk(segment, vehicle, this.analyzeRoadContext(segment));
  }

  static analyzeTurn(segment: RouteSegment, vehicle: Vehicle): TurnAnalysis {
    const isLargeVehicle = vehicle.length >= 35;
    const roadWidth = segment.riskFactors.roadWidth;
    
    // 🔧 DETERMINISTIC TURN ANALYSIS
    const seed = `${segment.streetName}-${segment.startLat.toFixed(4)}-${segment.startLng.toFixed(4)}`;
    const angle = this.generateDeterministicValue(seed + '-angle', 60, 120);
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

  static getBusSpecificAdvice(vehicle: Vehicle, route: Route): string[] {
    const advice: string[] = [];
    const isBus = vehicle.length >= 35;
    
    if (isBus) {
      advice.push('🚌 Account for 42ft turning radius and rear overhang swing during turns');
      advice.push('🚦 Prefer routes with traffic lights over stop signs for schedule reliability');
      advice.push('👁️ Use mirrors and blind spot monitoring systems actively');
      advice.push('📢 Announce stops and turns to passengers for safety');
      advice.push('⏰ Allow extra time for passenger boarding and alighting');
      
      // Check intersection summary if available
      const intersectionSummary = (route as any).intersectionSummary;
      if (intersectionSummary) {
        const stopSignRatio = intersectionSummary.stopSignToTrafficLightRatio || 0;
        if (stopSignRatio > 0.5) {
          advice.push('⚠️ Route has high stop sign ratio - consider arterial alternatives with traffic signals');
        }
      }
    }
    
    return advice;
  }
}
