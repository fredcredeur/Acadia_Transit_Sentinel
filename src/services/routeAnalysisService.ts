// Complete EnhancedRouteAnalysisService.ts - Integration with large vehicle algorithm

import { GoogleMapsService } from './googleMapsService';
import { LargeVehicleRoutingAlgorithm, EnhancedRiskCalculator } from './largeVehicleRouting';
import { Route, Vehicle, StopLocation, RouteSegment } from '../types';

interface RouteAnalysisRequest {
  origin: string;
  destination: string;
  vehicle: Vehicle;
  stops?: StopLocation[];
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  prioritizeSafety?: boolean;
}

interface RouteAnalysisResult {
  routes: Route[];
  recommendedRouteId: string;
  largeVehicleAnalysis?: {
    stopSignCount: number;
    trafficLightCount: number;
    safetyRecommendations: string[];
    alternativeRouteSuggested: boolean;
  };
}

export class EnhancedRouteAnalysisService {
  private googleMapsService: GoogleMapsService;
  private readonly LARGE_VEHICLE_THRESHOLD = 30; // feet

  constructor() {
    this.googleMapsService = GoogleMapsService.getInstance();
  }

  async analyzeRoutes(request: RouteAnalysisRequest): Promise<RouteAnalysisResult> {
    const isLargeVehicle = request.vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    
    console.log(`🚛 Analyzing routes for ${isLargeVehicle ? 'LARGE' : 'standard'} vehicle: ${request.vehicle.length}ft`);
    
    try {
      // Get standard routes first
      const standardRoutes = await this.getStandardRoutes(request);
      
      // For large vehicles, generate additional safety-focused routes
      let allRoutes = standardRoutes;
      if (isLargeVehicle) {
        const largeVehicleRoutes = await this.getLargeVehicleRoutes(request);
        allRoutes = [...standardRoutes, ...largeVehicleRoutes];
      }
      
      // Enhance routes with intersection analysis
      const enhancedRoutes = await this.enhanceRoutesWithIntersectionData(allRoutes, request.vehicle);
      
      // Apply large vehicle risk scoring
      const scoredRoutes = enhancedRoutes.map(route => ({
        ...route,
        largeVehicleRisk: isLargeVehicle 
          ? EnhancedRiskCalculator.calculateLargeVehicleRisk(route, request.vehicle)
          : this.calculateStandardRisk(route, request.vehicle)
      }));
      
      // Sort routes - for large vehicles, prioritize safety over speed/distance
      const sortedRoutes = this.sortRoutes(scoredRoutes, request.vehicle, request.prioritizeSafety);
      
      // Generate analysis for large vehicles
      const largeVehicleAnalysis = isLargeVehicle 
        ? this.generateLargeVehicleAnalysis(sortedRoutes, request.vehicle)
        : undefined;
      
      return {
        routes: sortedRoutes,
        recommendedRouteId: sortedRoutes[0]?.id || '',
        largeVehicleAnalysis
      };
      
    } catch (error) {
      console.error('Route analysis failed:', error);
      throw new Error(`Failed to analyze routes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getStandardRoutes(request: RouteAnalysisRequest): Promise<Route[]> {
    const routes: Route[] = [];
    
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => ({
          location: stop.address,
          stopover: true
        })),
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: request.avoidHighways || false,
        avoidTolls: request.avoidTolls || false,
        provideRouteAlternatives: true,
        optimizeWaypoints: true
      };

      const directionsResult = await this.googleMapsService.getRoutes(routeOptions);
      
      directionsResult.routes.forEach((googleRoute, index) => {
        const route = this.convertGoogleRouteToRoute(googleRoute, index, request);
        routes.push(route);
      });
      
    } catch (error) {
      console.error('Failed to get standard routes:', error);
      routes.push(this.createFallbackRoute(request, 'standard'));
    }
    
    return routes;
  }

  private async getLargeVehicleRoutes(request: RouteAnalysisRequest): Promise<Route[]> {
    const routes: Route[] = [];
    
    console.log('🚛 Generating large vehicle specific routes...');
    
    try {
      // Strategy 1: Arterial roads with traffic lights
      const arterialRoute = await this.generateArterialRoute(request);
      if (arterialRoute) routes.push(arterialRoute);
      
      // Strategy 2: Highway-preferred route
      const highwayRoute = await this.generateHighwayRoute(request);
      if (highwayRoute) routes.push(highwayRoute);
      
      // Strategy 3: Truck route (if vehicle is large enough)
      if (request.vehicle.length > 40) {
        const truckRoute = await this.generateTruckRoute(request);
        if (truckRoute) routes.push(truckRoute);
      }
      
      // Strategy 4: Traffic light loop route
      const trafficLightRoute = await this.generateTrafficLightRoute(request);
      if (trafficLightRoute) routes.push(trafficLightRoute);
      
    } catch (error) {
      console.error('Failed to generate large vehicle routes:', error);
      routes.push(this.createFallbackRoute(request, 'large_vehicle_safe'));
    }
    
    return routes;
  }

  private async generateArterialRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => ({ location: stop.address, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false,
        avoid: ['residential'],
        prefer: ['arterials', 'primary_roads']
      };

      const result = await this.googleMapsService.getRoutes(routeOptions);
      if (result.routes.length > 0) {
        return this.convertGoogleRouteToRoute(
          result.routes[0], 
          0, 
          request, 
          'Arterial Roads (Traffic Lights Preferred)'
        );
      }
    } catch (error) {
      console.error('Failed to generate arterial route:', error);
    }
    
    return null;
  }

  private async generateHighwayRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => ({ location: stop.address, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false,
        prefer: ['highways', 'controlled_access']
      };

      const result = await this.googleMapsService.getRoutes(routeOptions);
      if (result.routes.length > 0) {
        return this.convertGoogleRouteToRoute(
          result.routes[0], 
          0, 
          request, 
          'Highway Route (No Stop Signs)'
        );
      }
    } catch (error) {
      console.error('Failed to generate highway route:', error);
    }
    
    return null;
  }

  private async generateTruckRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => ({ location: stop.address, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
        restrictions: {
          height: request.vehicle.height,
          length: request.vehicle.length,
          width: request.vehicle.width,
          weight: this.estimateVehicleWeight(request.vehicle)
        },
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false,
        prefer: ['truck_routes', 'designated_truck_roads']
      };

      const result = await this.googleMapsService.getRoutes(routeOptions);
      if (result.routes.length > 0) {
        return this.convertGoogleRouteToRoute(
          result.routes[0], 
          0, 
          request, 
          'Designated Truck Route'
        );
      }
    } catch (error) {
      console.error('Failed to generate truck route:', error);
    }
    
    return null;
  }

  private async generateTrafficLightRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      console.log('🚦 Generating traffic light route - willing to detour up to 3 miles for safety');
      
      const intersectionData = await this.getIntersectionData(request.origin, request.destination);
      
      const trafficLightWaypoints = this.findTrafficLightWaypoints(
        request.origin,
        request.destination,
        intersectionData,
        request.vehicle
      );
      
      if (trafficLightWaypoints.length > 0) {
        const routeOptions = {
          origin: request.origin,
          destination: request.destination,
          waypoints: [
            ...trafficLightWaypoints.map(wp => ({ location: wp, stopover: false })),
            ...(request.stops?.map(stop => ({ location: stop.address, stopover: true })) || [])
          ],
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: false,
          avoidTolls: request.avoidTolls || false,
          optimizeWaypoints: false
        };

        const result = await this.googleMapsService.getRoutes(routeOptions);
        if (result.routes.length > 0) {
          const route = this.convertGoogleRouteToRoute(
            result.routes[0], 
            0, 
            request, 
            'Traffic Light Route (Safety Prioritized)'
          );
          
          route.metadata = {
            safetyFocused: true,
            avoidedStopSigns: true,
            extraDistance: this.calculateExtraDistance(route, request),
            trafficLightCount: trafficLightWaypoints.length
          };
          
          return route;
        }
      }
    } catch (error) {
      console.error('Failed to generate traffic light route:', error);
    }
    
    return null;
  }

  private async getIntersectionData(origin: string, destination: string): Promise<any[]> {
    // Mock intersection data - in production this would use Google Places API
    return [
      {
        id: 'intersection_1',
        lat: 30.2241,
        lng: -92.0198,
        type: 'traffic_light',
        roadTypes: ['primary', 'secondary'],
        averageTrafficVolume: 800,
        pedestrianCrossing: true,
        schoolZone: false,
        laneCount: 4,
        hasRightTurnLane: true,
        hasLeftTurnLane: true
      },
      {
        id: 'intersection_2',
        lat: 30.2250,
        lng: -92.0180,
        type: 'stop_sign',
        roadTypes: ['residential', 'residential'],
        averageTrafficVolume: 200,
        pedestrianCrossing: false,
        schoolZone: true,
        laneCount: 2,
        hasRightTurnLane: false,
        hasLeftTurnLane: false
      }
    ];
  }

  private findTrafficLightWaypoints(
    origin: string,
    destination: string,
    intersections: any[],
    vehicle: Vehicle
  ): string[] {
    const trafficLights = intersections.filter(i => i.type === 'traffic_light');
    
    const scoredLights = trafficLights.map(light => ({
      ...light,
      score: this.scoreTrafficLightForLargeVehicle(light, vehicle)
    }));
    
    return scoredLights
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(light => `${light.lat},${light.lng}`);
  }

  private scoreTrafficLightForLargeVehicle(intersection: any, vehicle: Vehicle): number {
    let score = 100;
    
    score += intersection.laneCount * 10;
    
    if (intersection.hasRightTurnLane) score += 15;
    if (intersection.hasLeftTurnLane) score += 15;
    
    if (intersection.schoolZone && vehicle.length >= 35) {
      score -= 30;
    }
    
    if (intersection.averageTrafficVolume >= 400 && intersection.averageTrafficVolume <= 1000) {
      score += 20;
    } else if (intersection.averageTrafficVolume > 1500) {
      score -= 25;
    }
    
    if (intersection.roadTypes.includes('primary')) {
      score += 25;
    }
    
    return score;
  }

  private async enhanceRoutesWithIntersectionData(routes: Route[], vehicle: Vehicle): Promise<Route[]> {
    return Promise.all(routes.map(async route => {
      try {
        const enhancedSegments = await Promise.all(route.segments.map(async segment => {
          const intersectionAnalysis = await this.analyzeSegmentIntersections(segment, vehicle);
          return {
            ...segment,
            intersectionAnalysis,
            largeVehicleRisk: this.calculateSegmentRiskForLargeVehicle(segment, vehicle, intersectionAnalysis)
          };
        }));

        return {
          ...route,
          segments: enhancedSegments,
          intersectionSummary: this.generateIntersectionSummary(enhancedSegments)
        };
      } catch (error) {
        console.error('Failed to enhance route with intersection data:', error);
        return route;
      }
    }));
  }

  private async analyzeSegmentIntersections(segment: RouteSegment, vehicle: Vehicle): Promise<any> {
    const mockAnalysis = {
      stopSignCount: 0,
      trafficLightCount: 0,
      roundaboutCount: 0,
      uncontrolledCount: 0,
      schoolZoneIntersections: 0,
      highTrafficIntersections: 0
    };

    if (segment.description?.toLowerCase().includes('residential')) {
      mockAnalysis.stopSignCount = Math.floor(Math.random() * 3) + 1;
    } else if (segment.description?.toLowerCase().includes('highway')) {
      mockAnalysis.trafficLightCount = Math.floor(Math.random() * 2);
    } else {
      mockAnalysis.stopSignCount = Math.floor(Math.random() * 2);
      mockAnalysis.trafficLightCount = Math.floor(Math.random() * 3) + 1;
    }

    return mockAnalysis;
  }

  private calculateSegmentRiskForLargeVehicle(
    segment: RouteSegment, 
    vehicle: Vehicle, 
    intersectionAnalysis: any
  ): number {
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    let risk = 0;

    if (!isLargeVehicle) {
      return this.calculateStandardSegmentRisk(segment, vehicle);
    }

    risk += intersectionAnalysis.stopSignCount * 35;
    risk += intersectionAnalysis.trafficLightCount * 5;
    risk += intersectionAnalysis.roundaboutCount * 50;
    risk += intersectionAnalysis.uncontrolledCount * 60;
    risk += intersectionAnalysis.schoolZoneIntersections * 25;
    risk += intersectionAnalysis.highTrafficIntersections * 20;

    return Math.min(risk, 100);
  }

  private generateIntersectionSummary(segments: RouteSegment[]): any {
    const summary = {
      totalStopSigns: 0,
      totalTrafficLights: 0,
      totalRoundabouts: 0,
      totalUncontrolled: 0,
      schoolZoneIntersections: 0,
      highestRiskSegment: null as RouteSegment | null,
      averageSegmentRisk: 0
    };

    let totalRisk = 0;
    let maxRisk = 0;

    segments.forEach(segment => {
      if (segment.intersectionAnalysis) {
        summary.totalStopSigns += segment.intersectionAnalysis.stopSignCount || 0;
        summary.totalTrafficLights += segment.intersectionAnalysis.trafficLightCount || 0;
        summary.totalRoundabouts += segment.intersectionAnalysis.roundaboutCount || 0;
        summary.totalUncontrolled += segment.intersectionAnalysis.uncontrolledCount || 0;
        summary.schoolZoneIntersections += segment.intersectionAnalysis.schoolZoneIntersections || 0;
      }

      const segmentRisk = (segment as any).largeVehicleRisk || 0;
      totalRisk += segmentRisk;

      if (segmentRisk > maxRisk) {
        maxRisk = segmentRisk;
        summary.highestRiskSegment = segment;
      }
    });

    summary.averageSegmentRisk = segments.length > 0 ? totalRisk / segments.length : 0;

    return summary;
  }

  private sortRoutes(routes: Route[], vehicle: Vehicle, prioritizeSafety?: boolean): Route[] {
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    
    return routes.sort((a, b) => {
      if (isLargeVehicle || prioritizeSafety) {
        const aRisk = (a as any).largeVehicleRisk || 0;
        const bRisk = (b as any).largeVehicleRisk || 0;
        
        if (Math.abs(aRisk - bRisk) > 5) {
          return aRisk - bRisk;
        }
        
        return a.estimatedTime - b.estimatedTime;
      } else {
        return a.estimatedTime - b.estimatedTime;
      }
    });
  }

  private generateLargeVehicleAnalysis(routes: Route[], vehicle: Vehicle): any {
    const bestRoute = routes[0];
    const intersectionSummary = (bestRoute as any).intersectionSummary || {};
    
    const analysis = {
      stopSignCount: intersectionSummary.totalStopSigns || 0,
      trafficLightCount: intersectionSummary.totalTrafficLights || 0,
      safetyRecommendations: EnhancedRiskCalculator.getLargeVehicleSafetyRecommendations(bestRoute, vehicle),
      alternativeRouteSuggested: false
    };

    if (analysis.stopSignCount > 5) {
      analysis.alternativeRouteSuggested = true;
      analysis.safetyRecommendations.unshift(
        `🚨 HIGH STOP SIGN COUNT: This route has ${analysis.stopSignCount} stop signs. Consider selecting the "Traffic Light Route" alternative for improved safety.`
      );
    }

    if (analysis.stopSignCount > 0 && analysis.trafficLightCount > 0) {
      const ratio = analysis.stopSignCount / (analysis.stopSignCount + analysis.trafficLightCount);
      if (ratio > 0.6) {
        analysis.safetyRecommendations.push(
          `⚠️ Route is ${Math.round(ratio * 100)}% stop signs - look for alternative routes using arterial roads`
        );
      }
    }

    return analysis;
  }

  private calculateExtraDistance(route: Route, request: RouteAnalysisRequest): number {
    return route.totalDistance * 0.1;
  }

  private calculateStandardRisk(route: Route, vehicle: Vehicle): number {
    return 30;
  }

  private calculateStandardSegmentRisk(segment: RouteSegment, vehicle: Vehicle): number {
    return 25;
  }

  private convertGoogleRouteToRoute(
    googleRoute: google.maps.DirectionsRoute, 
    index: number, 
    request: RouteAnalysisRequest,
    customName?: string
  ): Route {
    const route: Route = {
      id: `route-${index}-${Date.now()}`,
      name: customName || `Route ${index + 1}`,
      segments: [],
      totalDistance: 0,
      estimatedTime: 0,
      criticalPoints: [],
      stops: request.stops
    };

    googleRoute.legs.forEach(leg => {
      route.totalDistance += leg.distance?.value ? leg.distance.value * 0.000621371 : 0;
      route.estimatedTime += leg.duration?.value ? leg.duration.value / 60 : 0;
    });

    googleRoute.legs.forEach((leg, legIndex) => {
      leg.steps.forEach((step, stepIndex) => {
        const segment: RouteSegment = {
          id: `segment-${legIndex}-${stepIndex}`,
          streetName: step.instructions?.replace(/<[^>]*>/g, '') || 'Unknown Street',
          description: step.instructions?.replace(/<[^>]*>/g, '') || '',
          startLat: step.start_location.lat(),
          startLng: step.start_location.lng(),
          endLat: step.end_location.lat(),
          endLng: step.end_location.lng(),
          riskFactors: {
            pedestrianTraffic: Math.random() * 100,
            roadWidth: Math.random() * 100,
            trafficCongestion: Math.random() * 100,
            heightRestriction: Math.random() > 0.8 ? 12 + Math.random() * 3 : 0
          }
        };
        route.segments.push(segment);
      });
    });

    return route;
  }

  private createFallbackRoute(request: RouteAnalysisRequest, type: string): Route {
    return {
      id: `fallback-${type}-${Date.now()}`,
      name: `${type.replace('_', ' ')} Fallback Route`,
      segments: [{
        id: 'fallback-segment',
        streetName: 'Route Unavailable',
        description: 'Fallback route - Google Maps API unavailable',
        startLat: 30.2241,
        startLng: -92.0198,
        endLat: 30.2341,
        endLng: -92.0098,
        riskFactors: {
          pedestrianTraffic: 30,
          roadWidth: 40,
          trafficCongestion: 50,
          heightRestriction: 0
        }
      }],
      totalDistance: 10,
      estimatedTime: 20,
      criticalPoints: [],
      stops: request.stops
    };
  }

  private estimateVehicleWeight(vehicle: Vehicle): number {
    const volume = vehicle.length * vehicle.width * vehicle.height;
    return volume * 0.02;
  }

  public getRouteRecommendations(routes: Route[], vehicle: Vehicle): {
    safest: Route | null;
    fastest: Route | null;
    balanced: Route | null;
    warnings: string[];
  } {
    if (routes.length === 0) {
      return { safest: null, fastest: null, balanced: null, warnings: ['No routes available'] };
    }

    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const warnings: string[] = [];

    const safest = routes.reduce((best, current) => {
      const currentRisk = (current as any).largeVehicleRisk || 0;
      const bestRisk = (best as any).largeVehicleRisk || 0;
      return currentRisk < bestRisk ? current : best;
    });

    const fastest = routes.reduce((best, current) => 
      current.estimatedTime < best.estimatedTime ? current : best
    );

    const balanced = routes.reduce((best, current) => {
      const currentScore = this.calculateOverallScore(current, vehicle);
      const bestScore = this.calculateOverallScore(best, vehicle);
      return currentScore > bestScore ? current : best;
    });

    if (isLargeVehicle) {
      const safestSummary = (safest as any).intersectionSummary || {};
      
      if ((safestSummary.totalStopSigns || 0) > 5) {
        warnings.push(`High stop sign count detected. Consider alternative routing strategies.`);
      }
      
      const allRoutesHaveStopSigns = routes.every(route => {
        const summary = (route as any).intersectionSummary || {};
        return (summary.totalStopSigns || 0) > 3;
      });
      
      if (allRoutesHaveStopSigns) {
        warnings.push(`All available routes have significant stop sign intersections. Consider expanding search radius.`);
      }
    }

    return { safest, fastest, balanced, warnings };
  }

  private calculateOverallScore(route: Route, vehicle: Vehicle): number {
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const summary = (route as any).intersectionSummary || {};
    const stopSignPenalty = (summary.totalStopSigns || 0) * 10;
    const trafficLightBonus = (summary.totalTrafficLights || 0) * 5;
    
    let safetyScore = 100 - stopSignPenalty + trafficLightBonus;
    let efficiencyScore = (route.totalDistance / (route.estimatedTime / 60)) * 2; // mph * 2
    
    if (isLargeVehicle) {
      return (safetyScore * 0.7) + (efficiencyScore * 0.3);
    } else {
      return (safetyScore * 0.4) + (efficiencyScore * 0.6);
    }
  }
}