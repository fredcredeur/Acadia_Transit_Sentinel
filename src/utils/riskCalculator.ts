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
  /* -------------------------- base weights table ------------------------- */
  private static readonly BASE_WEIGHTS = {
    pedestrianTraffic: 0.15,
    maneuvering:       0.20,
    infrastructure:    0.20,
    traffic:           0.15,
    roadContext:       0.15,
    intersection:      0.18   // default for cars/vans
  } as const;

  /** Intersection weight helper – heavier for large vehicles */
  private static intersectionWeight(vehicle: Vehicle): number {
    return this.isLargeVehicle(vehicle) ? 0.28 : this.BASE_WEIGHTS.intersection;
  }

  /* ------------------------------- PUBLIC API ----------------------------- */

  static calculateSegmentRisk(
    segment: RouteSegment,
    vehicle: Vehicle,
    nextSegmentContext: RoadContext | null = null
  ): number {
    const roadContext = this.analyzeRoadContext(segment);
    const enhanced = this.calculateEnhancedRisk(
      segment,
      vehicle,
      roadContext,
      nextSegmentContext
    );
    return enhanced.overallRisk;
  }

  static calculateEnhancedRisk(
    segment: RouteSegment,
    vehicle: Vehicle,
    roadContext: RoadContext,
    nextSegmentContext: RoadContext | null = null
  ): EnhancedRiskBreakdown {
    const context = roadContext;
    const f = segment.riskFactors;

    // component risks
    const pedestrianRisk     = this.calculateContextualPedestrianRisk(f.pedestrianTraffic, vehicle, context);
    const maneuveringRisk    = this.calculateVehicleSpecificManeuveringRisk(segment, vehicle, context);
    const infrastructureRisk = this.calculateInfrastructureRisk(f.heightRestriction, vehicle.height);
    const trafficRisk        = this.calculateIntelligentTrafficRisk(f, context);
    const roadContextRisk    = this.calculateRoadContextRisk(vehicle, context);
    let   intersectionRisk   = this.calculateIntersectionRisk(
      segment,
      vehicle,
      context,
      nextSegmentContext
    );

    // boost for large vehicles
    if (this.isLargeVehicle(vehicle)) {
      intersectionRisk = Math.min(intersectionRisk * 1.5, 100);
    }

    const w = this.BASE_WEIGHTS;
    const total =
      pedestrianRisk     * w.pedestrianTraffic +
      maneuveringRisk    * w.maneuvering +
      infrastructureRisk * w.infrastructure +
      trafficRisk        * w.traffic +
      roadContextRisk    * w.roadContext +
      intersectionRisk   * this.intersectionWeight(vehicle);

    const overall = Math.min(Math.max(total, 0), 100);

    const analysis = this.generateRiskAnalysis(
      { pedestrianRisk, maneuveringRisk, infrastructureRisk, trafficRisk, roadContextRisk, intersectionRisk },
      vehicle,
      context,
      overall
    );

    return {
      pedestrianRisk,
      maneuveringRisk,
      infrastructureRisk,
      trafficRisk,
      roadContextRisk,
      intersectionRisk,
      overallRisk: overall,
      roadContext: context,
      ...analysis
    };
  }

  /* --------------------------- Context detection -------------------------- */

  private static analyzeRoadContext(segment: RouteSegment): RoadContext {
    const name = segment.streetName.toLowerCase();
    const f = segment.riskFactors;
    const desc = segment.description.toLowerCase();

    let type: RoadContext['type'] = 'arterial';
    let isTruckFriendly = false;
    let designatedTruckRoute = false;

    if (name.includes('interstate') || name.includes('highway') ||
        name.includes('freeway') || /^i-?\d+/.test(name) ||
        /^us.?\d+/.test(name) || /^sr.?\d+/.test(name)) {
      type = 'highway';
      isTruckFriendly = true;
      designatedTruckRoute = true;
    } else if (name.includes('truck route') || name.includes('industrial') ||
               name.includes('warehouse') || name.includes('port') ||
               name.includes('logistics') || name.includes('freight')) {
      type = 'truck_route';
      isTruckFriendly = true;
      designatedTruckRoute = true;
    } else if (name.includes('industrial') || name.includes('manufacturing') ||
               name.includes('distribution') || name.includes('rail')) {
      type = 'industrial';
      isTruckFriendly = true;
    } else if (name.includes('commercial') || name.includes('business') ||
               name.includes('main st') || name.includes('broadway') ||
               (f.pedestrianTraffic > 60 && f.speedLimit <= 35)) {
      type = 'commercial';
      isTruckFriendly = f.speedLimit >= 25;
    } else if (name.includes('residential') || name.includes('subdivision') ||
               name.includes('circle') || name.includes('court') ||
               (name.includes('lane') && f.speedLimit <= 30)) {
      type = 'residential';
      isTruckFriendly = false;
    }

    const hasTrafficSignals = f.speedLimit >= 35 && f.trafficCongestion > 40;
    const hasStopSigns      = f.speedLimit <= 25 && !hasTrafficSignals;
    const schoolZone        = desc.includes('school') ||
                              f.speedLimit <= 20 ||
                              (f.pedestrianTraffic > 80 && f.speedLimit <= 25);
    const commercialLoading = type === 'commercial' && f.trafficCongestion > 50;

    let turnDirection: RoadContext['turnDirection'];
    if (desc.includes('left'))       turnDirection = 'left';
    else if (desc.includes('right')) turnDirection = 'right';
    else                              turnDirection = 'straight';

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

  /* ---------------------------- Risk calculators ------------------------- */

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
    const isLarge = this.isLargeVehicle(vehicle);
    const widthFactor = segment.riskFactors.roadWidth;
    risk = context.isTruckFriendly ? Math.max(100 - widthFactor, 0) : widthFactor;
    if (isLarge) {
      if (context.type === 'residential')      risk += 40;
      else if (context.designatedTruckRoute)   risk = Math.max(risk - 25, 0);
    }
    const hasTurn = /turn/.test(segment.streetName.toLowerCase()) || /turn/.test(segment.description.toLowerCase());
    if (hasTurn) risk += (isLarge ? 25 : 10) * (context.hasStopSigns ? 0.7 : 1);
    return Math.min(risk, 100);
  }

  private static calculateIntelligentTrafficRisk(
    f: { trafficCongestion: number; speedLimit: number; },
    context: RoadContext
  ): number {
    let risk = f.trafficCongestion;
    if (context.type === 'highway' && f.speedLimit >= 55) risk *= 0.7;
    else if (context.type === 'commercial' && context.hasTrafficSignals) risk *= 0.8;
    else if (context.type === 'residential') risk *= 1.3;
    if (f.speedLimit >= 45)      risk *= 0.9;
    else if (f.speedLimit <= 20) risk *= 1.2;
    return Math.min(risk, 100);
  }

  private static calculateRoadContextRisk(vehicle: Vehicle, context: RoadContext): number {
    const isLarge = this.isLargeVehicle(vehicle);
    let risk = 0;
    if (isLarge) {
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
    if (context.schoolZone && isLarge) risk += 25;
    return Math.min(risk, 100);
  }

  private static calculateIntersectionRisk(
    segment: RouteSegment,
    vehicle: Vehicle,
    context: RoadContext,
    nextCtx: RoadContext | null
  ): number {
    const desc = segment.description.toLowerCase();
    if (!/turn|intersection|cross/.test(desc)) return 0;
    const isLarge = this.isLargeVehicle(vehicle);
    const major = nextCtx && ['arterial','highway','commercial','truck_route'].includes(nextCtx.type);
    let risk = 30;
    if (context.hasTrafficSignals) {
      risk = isLarge ? 8 : 15;
    } else if (context.hasStopSigns) {
      risk = 50;
      if (major && isLarge) {
        risk += 60;
        if (context.turnDirection !== 'right') risk += 30; // assume left if not right
      }
    } else {
      risk = 55;
    }
    if (context.type === 'residential' && isLarge) risk += 25;
    if (context.type === 'highway') risk -= 20;
    return Math.min(risk, 100);
  }

  private static calculateInfrastructureRisk(clearance: number, vehHeight: number): number {
    if (clearance === 0) return 0;
    const diff = clearance - vehHeight;
    if (diff <= 0) return 100;
    if (diff <= 0.5) return 95;
    if (diff <= 1) return 80;
    if (diff <= 2) return 40;
    return 10;
  }

  private static getContextAwareSizeMultiplier(vehicle: Vehicle, context: RoadContext): number {
    const isLarge = this.isLargeVehicle(vehicle);
    if (!isLarge) return 1;
    switch (context.type) {
      case 'highway':
      case 'truck_route': return 0.8;
      case 'industrial':  return 0.9;
      case 'arterial':    return 1;
      case 'commercial':  return context.hasTrafficSignals ? 1.1 : 1.3;
      case 'residential': return 1.8;
      default:            return 1.2;
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
    overall: number
  ): { primaryConcerns: string[]; recommendations: string[]; riskMitigators: string[] } {
    const concerns: string[] = [];
    const recs: string[]      = [];
    const mitigators: string[]= [];

    if (risks.infrastructureRisk > 80) {
      concerns.push('Critical height clearance issue');
      recs.push('Verify vehicle height and find alternative route');
    }
    if (risks.roadContextRisk > 60) {
      concerns.push('Unsuitable road type');
      recs.push(context.type==='residential'
        ? 'Avoid residential; use arterials/truck routes'
        : 'Use designated truck routes');
    }
    if (risks.pedestrianRisk > 60 && !context.schoolZone) {
      concerns.push('High pedestrian activity');
      recs.push('Slow down and stay alert');
    } else if (context.schoolZone) {
      concerns.push('School zone - watch for children');
      recs.push('Observe reduced speeds');
    }
    if (risks.intersectionRisk > 40) {
      concerns.push('Complex intersection');
      recs.push(context.hasTrafficSignals
        ? 'Wait for green cycle'
        : 'Use spotter if needed');
    }
    if (risks.maneuveringRisk > 50) {
      concerns.push('Limited maneuvering space');
      recs.push('Plan wide turns');
    }

    if (context.designatedTruckRoute) mitigators.push('Designated truck route');
    if (context.hasTrafficSignals && this.isLargeVehicle(vehicle)) mitigators.push('Signal-controlled');
    if (['highway','truck_route'].includes(context.type)) mitigators.push('Wide lanes');
    if (context.isTruckFriendly) mitigators.push('Adequate clearance');

    return { primaryConcerns: concerns, recommendations: recs, riskMitigators: mitigators };
  }

  /* ------------------------- Stop & Route Wrappers ----------------------- */

  static calculateStopRisk(stop: StopLocation, vehicle: Vehicle): number {
    const base = (stop.estimatedStopTime || 15) * 0.5;
    return Math.min(base * this.getVehicleSizeMultiplier(vehicle), 100);
  }

  static calculateRouteRisk(route: Route, vehicle: Vehicle): number {
    if (!route.segments.length) return 0;
    const segRisks = route.segments.map((seg,i) => {
      const next = route.segments[i+1];
      return this.calculateSegmentRisk(seg, vehicle, next ? this.analyzeRoadContext(next) : null);
    });
    const weighted = segRisks.map(r=> r>80 ? r*1.3 : r>60 ? r*1.15 : r);
    const stopRisks = (route.stops||[]).map(s=> this.calculateStopRisk(s, vehicle));
    const sum = [...weighted, ...stopRisks].reduce((a,b)=>a+b,0);
    return Math.min(sum / (weighted.length + stopRisks.length), 100);
  }

  static compareRoutes(routes: Route[], vehicle: Vehicle): Route[] {
    return routes
      .map(r => ({
        ...r,
        overallRisk: this.calculateRouteRisk(r, vehicle),
        enhancedRiskBreakdowns: r.segments.map((seg,i) =>
          this.calculateEnhancedRisk(
            seg,
            vehicle,
            this.analyzeRoadContext(seg),
            r.segments[i+1] ? this.analyzeRoadContext(r.segments[i+1]) : null
          )
        )
      }))
      .sort((a,b)=> a.overallRisk - b.overallRisk);
  }

  /* ----------------------------- Utilities ------------------------------- */
  private static isLargeVehicle(v: Vehicle): boolean {
    return v.length >= 35 || v.width >= 8.5;
  }

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
    const isLarge = this.isLargeVehicle(vehicle);
    const width  = segment.riskFactors.roadWidth;
    const angle  = Math.random() * 60 + 60;
    const clearanceRequired = vehicle.width * 1.5 + (isLarge ? 10 : 5);
    let difficulty: TurnAnalysis['difficulty'] = 'easy';
    if (angle > 90 && width < 30)         difficulty = 'very_difficult';
    else if (angle > 75 || width < 40)    difficulty = 'difficult';
    else if (isLarge)                     difficulty = 'moderate';
    return { angle, radius: width/2, difficulty, clearanceRequired, recommendation: 'Proceed with caution' };
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
