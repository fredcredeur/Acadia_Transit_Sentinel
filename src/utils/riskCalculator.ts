import { Vehicle, RouteSegment, Route, StopLocation } from '../types';

/* -------------------------------------------------------------------------- */
/*                                 Interfaces                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                              RiskCalculator                                */
/* -------------------------------------------------------------------------- */

export class RiskCalculator {
  /* ------------ weight table (intersection bumped from 0.15 → 0.18) -------- */
  private static readonly WEIGHTS = {
    pedestrianTraffic: 0.15,
    maneuvering:       0.20,
    infrastructure:    0.20,
    traffic:           0.15,
    roadContext:       0.15,
    intersection:      0.18   // ↑ makes crossings matter a bit more
  };

  /* ------------------------------- PUBLIC API ----------------------------- */

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

    const pedestrianRisk   = this.calculateContextualPedestrianRisk(factors.pedestrianTraffic, vehicle, context);
    const maneuveringRisk  = this.calculateVehicleSpecificManeuveringRisk(segment, vehicle, context);
    const infrastructureRisk = this.calculateInfrastructureRisk(factors.heightRestriction, vehicle.height);
    const trafficRisk        = this.calculateIntelligentTrafficRisk(factors, context);
    const roadContextRisk    = this.calculateRoadContextRisk(vehicle, context);
    const intersectionRisk   = this.calculateIntersectionRisk(segment, vehicle, context, nextSegmentContext);

    const weightedRisk =
      (pedestrianRisk   * this.WEIGHTS.pedestrianTraffic) +
      (maneuveringRisk  * this.WEIGHTS.maneuvering) +
      (infrastructureRisk * this.WEIGHTS.infrastructure) +
      (trafficRisk      * this.WEIGHTS.traffic) +
      (roadContextRisk  * this.WEIGHTS.roadContext) +
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

  /* --------------------------- Context detection -------------------------- */

  private static analyzeRoadContext(segment: RouteSegment): RoadContext {
    const streetName = segment.streetName.toLowerCase();
    const factors    = segment.riskFactors;
    const description = segment.description.toLowerCase();

    /* Detect road type ----------------------------------------------------- */
    let type: RoadContext['type'] = 'arterial';
    let isTruckFriendly = false;
    let designatedTruckRoute = false;

    if (streetName.includes('interstate') || streetName.includes('highway') ||
        streetName.includes('freeway') || streetName.match(/^i-?\d+/) ||
        streetName.match(/^us.?\d+/) || streetName.match(/^sr.?\d+/)) {
      type = 'highway';
      isTruckFriendly = true;
      designatedTruckRoute = true;
    } else if (streetName.includes('truck route') || streetName.includes('industrial') ||
               streetName.includes('warehouse') || streetName.includes('port') ||
               streetName.includes('logistics') || streetName.includes('freight')) {
      type = 'truck_route';
      isTruckFriendly = true;
      designatedTruckRoute = true;
    } else if (streetName.includes('industrial') || streetName.includes('manufacturing') ||
               streetName.includes('distribution') || streetName.includes('rail')) {
      type = 'industrial';
      isTruckFriendly = true;
    } else if (streetName.includes('commercial') || streetName.includes('business') ||
               streetName.includes('main st') || streetName.includes('broadway') ||
               (factors.pedestrianTraffic > 60 && factors.speedLimit <= 35)) {
      type = 'commercial';
      isTruckFriendly = factors.speedLimit >= 25;
    } else if (streetName.includes('residential') || streetName.includes('subdivision') ||
               streetName.includes('circle') || streetName.includes('court') ||
               (streetName.includes('lane') && factors.speedLimit <= 30)) {
      type = 'residential';
      isTruckFriendly = false;
    }

    /* Detect controls & special zones ------------------------------------- */
    const hasTrafficSignals = factors.speedLimit >= 35 && factors.trafficCongestion > 40;
    const hasStopSigns      = factors.speedLimit <= 25 && !hasTrafficSignals;
    const schoolZone        = description.includes('school') ||
                              factors.speedLimit <= 20 ||
                              (factors.pedestrianTraffic > 80 && factors.speedLimit <= 25);
    const commercialLoading = type === 'commercial' && factors.trafficCongestion > 50;

    /* Detect turn direction ------------------------------------------------ */
    let turnDirection: RoadContext['turnDirection'];
    if (description.includes('left'))       turnDirection = 'left';
    else if (description.includes('right')) turnDirection = 'right';
    else                                    turnDirection = 'straight';

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

  /* ---------------------------- Risk modules ----------------------------- */

  private static calculateContextualPedestrianRisk(
    pedestrianTraffic: number,
    vehicle: Vehicle,
    context: RoadContext
  ): number {
    let risk = pedestrianTraffic;

    switch (context.type) {
      case 'highway':     risk = Math.max(risk - 70, 0); break;
      case 'truck_route': risk = Math.max(risk - 40, 0); break;
      case 'industrial':  risk = Math.max(risk - 30, 10); break;
      case 'commercial':
        if (context.hasTrafficSignals) risk = Math.max(risk - 15, 0);
        break;
      case 'residential': risk += 20; break;
    }

    if (context.schoolZone) risk += 30;

    risk *= this.getContextAwareSizeMultiplier(vehicle, context);
    return Math.min(risk, 100);
  }

  private static calculateVehicleSpecificManeuveringRisk(
    segment: RouteSegment,
    vehicle: Vehicle,
    context: RoadContext
  ): number {
    let risk = 0;
    const isLargeVehicle = vehicle.length >= 35 || vehicle.width >= 8.5;
    const roadWidthFactor = segment.riskFactors.roadWidth;

    risk = context.isTruckFriendly ? Math.max(100 - roadWidthFactor, 0) : roadWidthFactor;

    if (isLargeVehicle) {
      if (context.type === 'residential')           risk += 40;
      else if (context.designatedTruckRoute)        risk = Math.max(risk - 25, 0);
    }

    const hasTurn = /turn/.test(segment.streetName.toLowerCase()) ||
                    /turn/.test(segment.description);
    if (hasTurn) {
      const turnPenalty = isLargeVehicle ? 25 : 10;
      risk += context.hasStopSigns ? turnPenalty * 0.7 : turnPenalty;
    }

    return Math.min(risk, 100);
  }

  private static calculateIntelligentTrafficRisk(
    factors: { pedestrianTraffic: number; roadWidth: number; trafficCongestion: number; speedLimit: number; heightRestriction: number; },
    context: RoadContext
  ): number {
    let risk = factors.trafficCongestion;

    if (context.type === 'highway' && factors.speedLimit >= 55) risk *= 0.7;
    else if (context.type === 'commercial' && context.hasTrafficSignals) risk *= 0.8;
    else if (context.type === 'residential') risk *= 1.3;

    if (factors.speedLimit >= 45)      risk *= 0.9;
    else if (factors.speedLimit <= 20) risk *= 1.2;

    return Math.min(risk, 100);
  }

  private static calculateRoadContextRisk(vehicle: Vehicle, context: RoadContext): number {
    const isLargeVehicle = vehicle.length >= 35 || vehicle.width >= 8.5;
    let risk = 0;

    if (isLargeVehicle) {
      switch (context.type) {
        case 'highway':     risk = 5;   break;
        case 'truck_route': risk = 10;  break;
        case 'industrial':  risk = 20;  break;
        case 'arterial':    risk = 30;  break;
        case 'commercial':  risk = context.hasTrafficSignals ? 40 : 60; break;
        case 'residential': risk = 80;  break;
      }
    } else {
      risk = context.type === 'residential' ? 10 : 5;
    }

    if (context.designatedTruckRoute) risk = Math.max(risk - 20, 0);
    if (context.schoolZone && isLargeVehicle) risk += 25;

    return Math.min(risk, 100);
  }

  /* ------------------------- NEW intersection logic ---------------------- */
  private static calculateIntersectionRisk(
    segment: RouteSegment,
    vehicle: Vehicle,
    context: RoadContext,
    nextSegmentContext: RoadContext | null
  ): number {
    const isLargeVehicle   = vehicle.length >= 35;
    const desc             = segment.description.toLowerCase();
    const hasIntersection  = /turn|intersection|cross/.test(desc);

    if (!hasIntersection) return 0;

    /* baseline ------------------------------------------------------------ */
    let risk = 30;

    /* traffic-signal scenario (best case) --------------------------------- */
    if (context.hasTrafficSignals) {
      risk = isLargeVehicle ? 8 : 15;
    }

    /* stop-sign scenario --------------------------------------------------- */
    else if (context.hasStopSigns) {
      risk = 50;

      const crossingMajor = nextSegmentContext &&
        ['arterial', 'highway', 'commercial', 'truck_route']
          .includes(nextSegmentContext.type);

      if (crossingMajor && isLargeVehicle) {
        risk += 40;
        if (context.turnDirection === 'left') risk += 30; // unprotected left
      }
    }

    /* uncontrolled -------------------------------------------------------- */
    else {
      risk = 55;
    }

    /* context modifiers --------------------------------------------------- */
    if (context.type === 'residential' && isLargeVehicle) risk += 25;
    if (context.type === 'highway')                        risk -= 20;

    return Math.min(risk, 100);
  }

  private static calculateInfrastructureRisk(clearanceHeight: number, vehicleHeight: number): number {
    if (clearanceHeight === 0) return 0;

    const clearance = clearanceHeight - vehicleHeight;
    if (clearance <= 0)     return 100;
    if (clearance <= 0.5)   return 95;
    if (clearance <= 1)     return 80;
    if (clearance <= 2)     return 40;
    return 10;
  }

  private static getContextAwareSizeMultiplier(vehicle: Vehicle, context: RoadContext): number {
    const isLargeVehicle = vehicle.length >= 35;
    if (!isLargeVehicle) return 1.0;

    switch (context.type) {
      case 'highway':
      case 'truck_route': return 0.8;
      case 'industrial':  return 0.9;
      case 'arterial':    return 1.0;
      case 'commercial':  return context.hasTrafficSignals ? 1.1 : 1.3;
      case 'residential': return 1.8;
      default:            return 1.2;
    }
  }

  /* ------------------------ Analysis / explanations ---------------------- */

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

    if (risks.infrastructureRisk > 80) {
      concerns.push('Critical height clearance issue');
      recommendations.push('Verify exact vehicle height and find alternative route');
    }

    if (risks.roadContextRisk > 60) {
      concerns.push('Road type not suitable for vehicle size');
      if (context.type === 'residential') {
        recommendations.push('Avoid residential areas – use arterial roads or designated truck routes');
      } else {
        recommendations.push('Consider alternative route on truck-designated roads');
      }
    }

    if (risks.pedestrianRisk > 60 && !context.schoolZone) {
      concerns.push('High pedestrian activity');
      recommendations.push('Reduce speed and maintain extra vigilance for pedestrians');
    } else if (context.schoolZone) {
      concerns.push('School zone – heightened pedestrian risk');
      recommendations.push('Observe school-zone speed limits and watch for children');
    }

    if (risks.intersectionRisk > 40) {
      concerns.push('Complex intersection navigation');
      if (context.hasTrafficSignals) {
        recommendations.push('Use traffic signals for safe turning – wait for full green cycle');
      } else {
        recommendations.push('Exercise extreme caution at intersection – use spotter if available');
      }
    }

    if (risks.maneuveringRisk > 50) {
      concerns.push('Limited maneuvering space');
      recommendations.push('Plan wide turns and check for adequate clearance');
    }

    if (context.designatedTruckRoute) mitigators.push('Designated truck route – road designed for large vehicles');
    if (context.hasTrafficSignals && vehicle.length >= 35) mitigators.push('Traffic signals provide controlled intersection environment');
    if (['highway', 'truck_route'].includes(context.type)) mitigators.push('Road infrastructure appropriate for large vehicles');
    if (context.isTruckFriendly) mitigators.push('Truck-friendly road design with adequate width and turning radii');

    return { primaryConcerns: concerns, recommendations, riskMitigators: mitigators };
  }

  /* ------------------------- Stop / route wrappers ----------------------- */

  static calculateStopRisk(stop: StopLocation, vehicle: Vehicle): number {
    let risk = (stop.estimatedStopTime || 15) * 0.5;
    risk *= this.getVehicleSizeMultiplier(vehicle);
    return Math.min(risk, 100);
  }

  static calculateRouteRisk(route: Route, vehicle: Vehicle): number {
    if (route.segments.length === 0) return 0;

    const segmentRisks = route.segments.map((segment, i) => {
      const nextSeg = route.segments[i + 1];
      const nextCtx = nextSeg ? this.analyzeRoadContext(nextSeg) : null;
      return this.calculateSegmentRisk(segment, vehicle, nextCtx);
    });

    const weighted = segmentRisks.map(r => (r > 80 ? r * 1.3 : r > 60 ? r * 1.15 : r));
    const stopRisks = route.stops?.map(s => this.calculateStopRisk(s, vehicle)) || [];

    const total = weighted.reduce((sum, r) => sum + r, 0) + stopRisks.reduce((sum, r) => sum + r, 0);
    const n      = weighted.length + stopRisks.length;
    return n > 0 ? Math.min(total / n, 100) : 0;
  }

  static compareRoutes(routes: Route[], vehicle: Vehicle): Route[] {
    return routes
      .map(r => ({
        ...r,
        overallRisk: this.calculateRouteRisk(r, vehicle),
        enhancedRiskBreakdowns: r.segments.map((s, i) => {
          const nextSeg = r.segments[i + 1];
          const nextCtx = nextSeg ? this.analyzeRoadContext(nextSeg) : null;
          return this.calculateEnhancedRisk(s, vehicle, this.analyzeRoadContext(s), nextCtx);
        })
      }))
      .sort((a, b) => a.overallRisk - b.overallRisk);
  }

  /* ----------------------------- Utilities ------------------------------- */

  private static getVehicleSizeMultiplier(vehicle: Vehicle): number {
    if (vehicle.length >= 35) return 1.4;
    if (vehicle.length >= 25) return 1.2;
    if (vehicle.width >= 8)   return 1.3;
    return 1.0;
  }

  static getRiskColor(score: number): string {
    if (score > 80) return '#DC2626';
    if (score > 60) return '#F59E0B';
    if (score > 40) return '#FBBF24';
    if (score > 20) return '#A3E635';
    return '#4ADE80';
  }

  static getRiskLabel(score: number): string {
    if (score > 80) return 'Critical';
    if (score > 60) return 'High';
    if (score > 40) return 'Medium';
    if (score > 20) return 'Low';
    return 'Very Low';
  }

  static calculateDetailedRisk(segment: RouteSegment, vehicle: Vehicle): EnhancedRiskBreakdown {
    return this.calculateEnhancedRisk(segment, vehicle, this.analyzeRoadContext(segment));
  }

  static analyzeTurn(segment: RouteSegment, vehicle: Vehicle): TurnAnalysis {
    const isLarge = vehicle.length >= 35;
    const width   = segment.riskFactors.roadWidth;
    const angle   = Math.random() * 60 + 60;
    const clearanceRequired = vehicle.width * 1.5 + (isLarge ? 10 : 5);

    let difficulty: TurnAnalysis['difficulty'] = 'easy';
    if (angle > 90 && width < 30)           difficulty = 'very_difficult';
    else if (angle > 75 || width < 40)      difficulty = 'difficult';
    else if (isLarge)                       difficulty = 'moderate';

    return {
      angle,
      radius: width / 2,
      difficulty,
      clearanceRequired,
      recommendation: 'Proceed with caution'
    };
  }

  static getBusSpecificAdvice(vehicle: Vehicle, _route: Route): string[] {
    const advice: string[] = [];
    if (vehicle.length >= 35) {
      advice.push('Account for rear overhang swing during turns.');
      advice.push('Use mirrors and blind-spot monitoring systems actively.');
    }
    return advice;
  }
}
