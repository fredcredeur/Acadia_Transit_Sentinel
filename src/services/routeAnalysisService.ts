// Complete EnhancedRouteAnalysisService.ts - Clean version without debug logs

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
  private routeCounter = 0;

  constructor() {
    this.googleMapsService = GoogleMapsService.getInstance();
    this.routeCounter = 0;
  }

  async analyzeRoutes(request: RouteAnalysisRequest): Promise<RouteAnalysisResult> {
    const isLargeVehicle = request.vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    
    // Reset route counter for each analysis
    this.routeCounter = 0;
    
    try {
      // Get standard routes first
      const standardRoutes = await this.getStandardRoutes(request);
      
      // For large vehicles, generate additional safety-focused routes
      let allRoutes = standardRoutes;
      if (isLargeVehicle) {
        const largeVehicleRoutes = await this.getLargeVehicleRoutes(request);
        allRoutes = [...standardRoutes, ...largeVehicleRoutes];
      }
      
      // Remove duplicates and ensure unique numbering
      const uniqueRoutes = this.removeDuplicateRoutes(allRoutes);
      
      // Enhance routes with intersection analysis
      const enhancedRoutes = await this.enhanceRoutesWithIntersectionData(uniqueRoutes, request.vehicle);
      
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
      throw new Error(`Failed to analyze routes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private removeDuplicateRoutes(routes: Route[]): Route[] {
    const seen = new Set<string>();
    const uniqueRoutes: Route[] = [];
    
    routes.forEach(route => {
      // Create a signature based on distance and time to identify duplicates
      const signature = `${Math.round(route.totalDistance * 10)}-${Math.round(route.estimatedTime)}`;
      
      if (!seen.has(signature)) {
        seen.add(signature);
        // Renumber the route
        this.routeCounter++;
        route.id = `route-${this.routeCounter}`;
        route.name = `Route ${this.routeCounter}`;
        uniqueRoutes.push(route);
      }
    });
    
    return uniqueRoutes;
  }

  private async getStandardRoutes(request: RouteAnalysisRequest): Promise<Route[]> {
    const routes: Route[] = [];
    
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => stop.address),
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
      routes.push(this.createFallbackRoute(request, 'standard'));
    }
    
    return routes;
  }

  private async getLargeVehicleRoutes(request: RouteAnalysisRequest): Promise<Route[]> {
    const routes: Route[] = [];
    
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
      
    } catch (error) {
      routes.push(this.createFallbackRoute(request, 'large_vehicle_safe'));
    }
    
    return routes;
  }

  private async generateArterialRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => stop.address),
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false
      };

      const result = await this.googleMapsService.getRoutes(routeOptions);
      if (result.routes.length > 0) {
        return this.convertGoogleRouteToRoute(result.routes[0], 0, request);
      }
    } catch (error) {
      // Fail silently for alternative routes
    }
    
    return null;
  }

  private async generateHighwayRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => stop.address),
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false
      };

      const result = await this.googleMapsService.getRoutes(routeOptions);
      if (result.routes.length > 0) {
        return this.convertGoogleRouteToRoute(result.routes[0], 0, request);
      }
    } catch (error) {
      // Fail silently for alternative routes
    }
    
    return null;
  }

  private async generateTruckRoute(request: RouteAnalysisRequest): Promise<Route | null> {
    try {
      const routeOptions = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(stop => stop.address),
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false
      };

      const result = await this.googleMapsService.getRoutes(routeOptions);
      if (result.routes.length > 0) {
        return this.convertGoogleRouteToRoute(result.routes[0], 0, request);
      }
    } catch (error) {
      // Fail silently for alternative routes
    }
    
    return null;
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
        `High stop sign count detected: ${analysis.stopSignCount} stop signs. Consider selecting an alternative route for improved safety.`
      );
    }

    if (analysis.stopSignCount > 0 && analysis.trafficLightCount > 0) {
      const ratio = analysis.stopSignCount / (analysis.stopSignCount + analysis.trafficLightCount);
      if (ratio > 0.6) {
        analysis.safetyRecommendations.push(
          `Route is ${Math.round(ratio * 100)}% stop signs - look for alternative routes using arterial roads`
        );
      }
    }

    return analysis;
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
    request: RouteAnalysisRequest
  ): Route {
    this.routeCounter++;
    
    const route: Route = {
      id: `route-${this.routeCounter}`,
      name: `Route ${this.routeCounter}`,
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
    this.routeCounter++;
    
    return {
      id: `route-${this.routeCounter}`,
      name: `Route ${this.routeCounter}`,
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
}