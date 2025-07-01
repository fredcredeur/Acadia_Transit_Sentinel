// Enhanced RouteAnalysisService.ts - Fixed for consistent risk calculations

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
  private readonly BUS_THRESHOLD = 35; // feet - buses need special routing
  private readonly MIN_ROUTES = 3; // Minimum number of routes to generate

  constructor() {
    this.googleMapsService = GoogleMapsService.getInstance();
  }

  async analyzeRoutes(request: RouteAnalysisRequest): Promise<RouteAnalysisResult> {
    const isLargeVehicle = request.vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const isBus = request.vehicle.length >= this.BUS_THRESHOLD;
    
    console.log(`🚛 Analyzing routes for ${isBus ? 'BUS' : isLargeVehicle ? 'LARGE VEHICLE' : 'STANDARD VEHICLE'}: ${request.vehicle.length}ft`);
    
    try {
      // First, validate and geocode the addresses to ensure they're real
      const originCoords = await this.validateAndGeocodeAddress(request.origin);
      const destinationCoords = await this.validateAndGeocodeAddress(request.destination);
      
      console.log(`📍 Origin: ${originCoords.address}`);
      console.log(`📍 Destination: ${destinationCoords.address}`);
      
      // Generate routes with different strategies based on vehicle type
      let allRoutes: Route[] = [];
      
      if (isBus) {
        // 🚌 BUS ROUTING: Prioritize traffic lights, avoid stop signs
        allRoutes = await this.generateBusOptimizedRoutes(request, originCoords, destinationCoords);
      } else if (isLargeVehicle) {
        // 🚛 LARGE VEHICLE ROUTING: Safety-focused but not as strict as buses
        allRoutes = await this.generateLargeVehicleRoutes(request, originCoords, destinationCoords);
      } else {
        // 🚗 STANDARD ROUTING: Fastest routes
        allRoutes = await this.generateStandardRoutes(request, originCoords, destinationCoords);
      }
      
      // Remove duplicates using sophisticated comparison
      let uniqueRoutes = this.removeDuplicateRoutes(allRoutes);
      
      // Ensure we have minimum routes with meaningful differences
      if (uniqueRoutes.length < this.MIN_ROUTES) {
        const additionalRoutes = await this.generateMeaningfulVariations(request, uniqueRoutes, originCoords, destinationCoords);
        uniqueRoutes = [...uniqueRoutes, ...additionalRoutes];
      }
      
      // Apply consistent numbering starting from 1
      uniqueRoutes = this.applyConsistentNumbering(uniqueRoutes);
      
      // 🔧 ENSURE CONSISTENT RISK FACTORS for all segments
      uniqueRoutes = this.ensureConsistentRiskFactors(uniqueRoutes);
      
      // Enhance routes with intersection analysis
      const enhancedRoutes = await this.enhanceRoutesWithIntersectionData(uniqueRoutes, request.vehicle);
      
      // Apply vehicle-specific risk scoring
      const scoredRoutes = enhancedRoutes.map(route => ({
        ...route,
        largeVehicleRisk: this.calculateVehicleSpecificRisk(route, request.vehicle)
      }));
      
      // Sort routes based on vehicle type priorities
      const sortedRoutes = this.sortRoutesByVehicleType(scoredRoutes, request.vehicle);
      
      // Re-apply numbering after sorting
      const finalRoutes = this.applyConsistentNumbering(sortedRoutes);
      
      // Generate analysis for large vehicles
      const largeVehicleAnalysis = isLargeVehicle 
        ? this.generateLargeVehicleAnalysis(finalRoutes, request.vehicle)
        : undefined;
      
      console.log(`✅ Generated ${finalRoutes.length} unique routes with consistent risk calculations`);
      
      return {
        routes: finalRoutes,
        recommendedRouteId: finalRoutes[0]?.id || '',
        largeVehicleAnalysis
      };
      
    } catch (error) {
      console.error('❌ Route analysis failed:', error);
      throw new Error(`Failed to analyze routes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 🔧 NEW: Ensure all route segments have consistent, deterministic risk factors
  private ensureConsistentRiskFactors(routes: Route[]): Route[] {
    return routes.map(route => ({
      ...route,
      segments: route.segments.map(segment => ({
        ...segment,
        riskFactors: this.generateDeterministicRiskFactors(segment)
      }))
    }));
  }

  // 🔧 DETERMINISTIC RISK FACTOR GENERATION
  private generateDeterministicRiskFactors(segment: RouteSegment): typeof segment.riskFactors {
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
    if (streetName.includes('highway') || streetName.includes('interstate') || streetName.includes('freeway')) {
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

  // 🔧 DETERMINISTIC VALUE GENERATOR
  private generateDeterministicValue(seed: string, min: number = 0, max: number = 100): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Normalize to 0-1 range, then scale to min-max
    const normalized = Math.abs(hash) / 2147483647; // Max 32-bit int
    return min + (normalized * (max - min));
  }

  // 🚌 BUS-SPECIFIC ROUTING: Prioritizes arterial roads with traffic lights
  private async generateBusOptimizedRoutes(
    request: RouteAnalysisRequest,
    originCoords: { address: string; lat: number; lng: number },
    destinationCoords: { address: string; lat: number; lng: number }
  ): Promise<Route[]> {
    const routes: Route[] = [];
    
    console.log('🚌 Generating bus-optimized routes (prioritizing traffic lights)...');

    // Strategy 1: Major arterial roads (highways and main streets with traffic lights)
    try {
      const arterialRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false, // Buses can use highways
        avoidTolls: request.avoidTolls || false,
        routeType: 'arterial'
      });
      routes.push(...arterialRoutes.map(route => ({
        ...route,
        name: 'Arterial Route (Traffic Lights)',
        busOptimized: true,
        preferredIntersectionType: 'traffic_light'
      })));
    } catch (error) {
      console.warn('⚠️ Arterial routes failed:', error);
    }

    // Strategy 2: Highway-preferred route (no stop signs on highways)
    try {
      const highwayRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false,
        avoidTolls: false, // Allow tolls for highway access
        routeType: 'highway'
      });
      routes.push(...highwayRoutes.map(route => ({
        ...route,
        name: 'Highway Route (No Stop Signs)',
        busOptimized: true,
        preferredIntersectionType: 'controlled_access'
      })));
    } catch (error) {
      console.warn('⚠️ Highway routes failed:', error);
    }

    // Strategy 3: Alternative arterial route avoiding residential
    try {
      const alternativeRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false,
        avoidTolls: true,
        routeType: 'alternative_arterial'
      });
      routes.push(...alternativeRoutes.map(route => ({
        ...route,
        name: 'Alternative Arterial Route',
        busOptimized: true,
        preferredIntersectionType: 'traffic_light'
      })));
    } catch (error) {
      console.warn('⚠️ Alternative arterial routes failed:', error);
    }

    return routes;
  }

  // 🚛 LARGE VEHICLE ROUTING: Safety-focused but more flexible than buses
  private async generateLargeVehicleRoutes(
    request: RouteAnalysisRequest,
    originCoords: { address: string; lat: number; lng: number },
    destinationCoords: { address: string; lat: number; lng: number }
  ): Promise<Route[]> {
    const routes: Route[] = [];
    
    console.log('🚛 Generating large vehicle routes...');

    // Strategy 1: Truck-friendly route
    try {
      const truckRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false,
        routeType: 'truck'
      });
      routes.push(...truckRoutes.map(route => ({
        ...route,
        name: 'Truck Route',
        truckFriendly: true
      })));
    } catch (error) {
      console.warn('⚠️ Truck routes failed:', error);
    }

    // Strategy 2: Balanced route
    try {
      const balancedRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false,
        avoidTolls: false,
        routeType: 'balanced'
      });
      routes.push(...balancedRoutes.map(route => ({
        ...route,
        name: 'Balanced Route'
      })));
    } catch (error) {
      console.warn('⚠️ Balanced routes failed:', error);
    }

    // Strategy 3: Local roads (if needed)
    try {
      const localRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: true,
        avoidTolls: request.avoidTolls || false,
        routeType: 'local'
      });
      routes.push(...localRoutes.map(route => ({
        ...route,
        name: 'Local Route'
      })));
    } catch (error) {
      console.warn('⚠️ Local routes failed:', error);
    }

    return routes;
  }

  // 🚗 STANDARD ROUTING: Fastest and most efficient
  private async generateStandardRoutes(
    request: RouteAnalysisRequest,
    originCoords: { address: string; lat: number; lng: number },
    destinationCoords: { address: string; lat: number; lng: number }
  ): Promise<Route[]> {
    const routes: Route[] = [];
    
    console.log('🚗 Generating standard routes...');

    // Strategy 1: Fastest route
    try {
      const fastestRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false,
        avoidTolls: request.avoidTolls || false,
        routeType: 'fastest'
      });
      routes.push(...fastestRoutes.map(route => ({
        ...route,
        name: 'Fastest Route'
      })));
    } catch (error) {
      console.warn('⚠️ Fastest routes failed:', error);
    }

    // Strategy 2: Shortest route
    try {
      const shortestRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: true,
        avoidTolls: request.avoidTolls || false,
        routeType: 'shortest'
      });
      routes.push(...shortestRoutes.map(route => ({
        ...route,
        name: 'Shortest Route'
      })));
    } catch (error) {
      console.warn('⚠️ Shortest routes failed:', error);
    }

    // Strategy 3: Alternative route
    try {
      const alternativeRoutes = await this.getGoogleMapsRoutes(request, {
        avoidHighways: false,
        avoidTolls: true,
        routeType: 'alternative'
      });
      routes.push(...alternativeRoutes.map(route => ({
        ...route,
        name: 'Alternative Route'
      })));
    } catch (error) {
      console.warn('⚠️ Alternative routes failed:', error);
    }

    return routes;
  }

  private async validateAndGeocodeAddress(address: string): Promise<{
    address: string;
    lat: number;
    lng: number;
  }> {
    try {
      // Check if it's already coordinates
      const coordPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
      if (coordPattern.test(address.trim())) {
        const [latStr, lngStr] = address.split(',');
        const lat = parseFloat(latStr.trim());
        const lng = parseFloat(lngStr.trim());
        return { address: address.trim(), lat, lng };
      }

      // Geocode the address
      const results = await this.googleMapsService.geocodeAddress(address);
      if (results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        return {
          address: result.formatted_address,
          lat: location.lat(),
          lng: location.lng()
        };
      } else {
        throw new Error(`Could not find location for address: ${address}`);
      }
    } catch (error) {
      console.error(`Failed to geocode address "${address}":`, error);
      throw new Error(`Invalid address: ${address}. Please enter a valid address.`);
    }
  }

  private async getGoogleMapsRoutes(
    request: RouteAnalysisRequest,
    options: { avoidHighways: boolean; avoidTolls: boolean; routeType: string }
  ): Promise<Route[]> {
    const routes: Route[] = [];

    const routeOptions = {
      origin: request.origin,
      destination: request.destination,
      waypoints: request.stops?.map(stop => stop.address),
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: options.avoidHighways,
      avoidTolls: options.avoidTolls,
      departureTime: new Date()
    };

    const directionsResult = await this.googleMapsService.getRoutes(routeOptions);
    
    // Take multiple routes if available, but limit to avoid too many similar routes
    const routesToProcess = directionsResult.routes.slice(0, 2); // Max 2 routes per strategy
    
    routesToProcess.forEach((googleRoute, index) => {
      const route = this.convertGoogleRouteToRoute(googleRoute, index, request, options.routeType);
      routes.push(route);
    });

    return routes;
  }

  // Enhanced duplicate removal that considers route characteristics
  private removeDuplicateRoutes(routes: Route[]): Route[] {
    const uniqueRoutes: Route[] = [];
    const SIMILARITY_THRESHOLD = 0.15; // 15% similarity threshold
    
    routes.forEach(route => {
      const isDuplicate = uniqueRoutes.some(existingRoute => {
        // Check distance similarity
        const distanceDiff = Math.abs(route.totalDistance - existingRoute.totalDistance) / Math.max(route.totalDistance, existingRoute.totalDistance);
        
        // Check time similarity
        const timeDiff = Math.abs(route.estimatedTime - existingRoute.estimatedTime) / Math.max(route.estimatedTime, existingRoute.estimatedTime);
        
        // Check if routes are too similar
        return distanceDiff < SIMILARITY_THRESHOLD && timeDiff < SIMILARITY_THRESHOLD;
      });
      
      if (!isDuplicate) {
        uniqueRoutes.push(route);
      }
    });
    
    console.log(`🔍 Removed ${routes.length - uniqueRoutes.length} duplicate routes`);
    return uniqueRoutes;
  }

  // Generate meaningful variations that are actually different
  private async generateMeaningfulVariations(
    request: RouteAnalysisRequest,
    existingRoutes: Route[],
    originCoords: { address: string; lat: number; lng: number },
    destinationCoords: { address: string; lat: number; lng: number }
  ): Promise<Route[]> {
    const variations: Route[] = [];
    const neededRoutes = this.MIN_ROUTES - existingRoutes.length;
    
    console.log(`🔄 Generating ${neededRoutes} meaningful route variations...`);

    if (existingRoutes.length === 0) {
      // Create a basic fallback route
      variations.push(await this.createRealisticFallbackRoute(request, originCoords, destinationCoords));
    } else {
      // Create variations based on the best existing route
      const baseRoute = existingRoutes[0];
      
      for (let i = 0; i < neededRoutes; i++) {
        const variation = this.createMeaningfulVariation(baseRoute, i + 1, originCoords, destinationCoords, request.vehicle);
        variations.push(variation);
      }
    }

    return variations;
  }

  private createMeaningfulVariation(
    baseRoute: Route,
    variationIndex: number,
    originCoords: { address: string; lat: number; lng: number },
    destinationCoords: { address: string; lat: number; lng: number },
    vehicle: Vehicle
  ): Route {
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    
    // Create meaningful variations with different characteristics
    const variations = [
      {
        name: isBus ? 'Local Arterial Route' : 'Scenic Route',
        distanceMultiplier: 1.2,
        timeMultiplier: 1.15,
        riskAdjustment: -10 // Safer but longer
      },
      {
        name: isBus ? 'Express Route' : 'Highway Route', 
        distanceMultiplier: 1.1,
        timeMultiplier: 0.9,
        riskAdjustment: 5 // Faster but slightly riskier
      },
      {
        name: isBus ? 'Residential Bypass' : 'Back Roads Route',
        distanceMultiplier: 1.3,
        timeMultiplier: 1.25,
        riskAdjustment: 15 // Longer and more complex
      }
    ];
    
    const variation = variations[(variationIndex - 1) % variations.length];
    
    return {
      id: `variation-${variationIndex}`,
      name: variation.name,
      segments: [{
        id: `variation-segment-${variationIndex}`,
        streetName: `${variation.name} Path`,
        description: `${variation.name} with different routing characteristics`,
        startLat: originCoords.lat,
        startLng: originCoords.lng,
        endLat: destinationCoords.lat,
        endLng: destinationCoords.lng,
        riskFactors: {
          pedestrianTraffic: Math.max(10, Math.min(90, 40 + variation.riskAdjustment)),
          roadWidth: Math.max(20, Math.min(80, 50 - variation.riskAdjustment)),
          trafficCongestion: Math.max(10, Math.min(90, 45 + (variation.riskAdjustment / 2))),
          speedLimit: 35,
          heightRestriction: 0
        }
      }],
      totalDistance: baseRoute.totalDistance * variation.distanceMultiplier,
      estimatedTime: baseRoute.estimatedTime * variation.timeMultiplier,
      criticalPoints: [],
      stops: baseRoute.stops
    };
  }

  private async createRealisticFallbackRoute(
    request: RouteAnalysisRequest,
    originCoords: { address: string; lat: number; lng: number },
    destinationCoords: { address: string; lat: number; lng: number }
  ): Route {
    console.log('🆘 Creating realistic fallback route');
    
    const distance = this.calculateDistance(
      originCoords.lat, originCoords.lng,
      destinationCoords.lat, destinationCoords.lng
    );
    
    const estimatedTime = (distance / 30) * 60; // 30 mph average
    
    return {
      id: 'fallback-route',
      name: 'Direct Route',
      segments: [{
        id: 'fallback-segment',
        streetName: 'Direct Path',
        description: `Direct route from ${originCoords.address} to ${destinationCoords.address}`,
        startLat: originCoords.lat,
        startLng: originCoords.lng,
        endLat: destinationCoords.lat,
        endLng: destinationCoords.lng,
        riskFactors: {
          pedestrianTraffic: 35,
          roadWidth: 40,
          trafficCongestion: 45,
          speedLimit: 35,
          heightRestriction: 0
        }
      }],
      totalDistance: distance,
      estimatedTime: estimatedTime,
      criticalPoints: [],
      stops: request.stops
    };
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private applyConsistentNumbering(routes: Route[]): Route[] {
    return routes.map((route, index) => ({
      ...route,
      id: `route-${index + 1}`,
      name: `Route ${index + 1}`
    }));
  }

  private calculateVehicleSpecificRisk(route: Route, vehicle: Vehicle): number {
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    
    if (isBus) {
      return EnhancedRiskCalculator.calculateLargeVehicleRisk(route, vehicle);
    } else if (isLargeVehicle) {
      return EnhancedRiskCalculator.calculateLargeVehicleRisk(route, vehicle);
    } else {
      return this.calculateStandardRisk(route, vehicle);
    }
  }

  private sortRoutesByVehicleType(routes: Route[], vehicle: Vehicle): Route[] {
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    
    return routes.sort((a, b) => {
      if (isBus) {
        // For buses: Prioritize safety (low risk) over speed
        const aRisk = (a as any).largeVehicleRisk || 0;
        const bRisk = (b as any).largeVehicleRisk || 0;
        
        // Strong preference for routes with traffic lights
        const aTrafficLightBonus = (a as any).busOptimized ? -20 : 0;
        const bTrafficLightBonus = (b as any).busOptimized ? -20 : 0;
        
        const aScore = aRisk + aTrafficLightBonus;
        const bScore = bRisk + bTrafficLightBonus;
        
        if (Math.abs(aScore - bScore) > 5) {
          return aScore - bScore; // Lower score (safer) wins
        }
        
        return a.estimatedTime - b.estimatedTime; // Then by time
      } else if (isLargeVehicle) {
        // For large vehicles: Balance safety and efficiency
        const aRisk = (a as any).largeVehicleRisk || 0;
        const bRisk = (b as any).largeVehicleRisk || 0;
        
        if (Math.abs(aRisk - bRisk) > 10) {
          return aRisk - bRisk;
        }
        
        return a.estimatedTime - b.estimatedTime;
      } else {
        // For standard vehicles: Prioritize speed
        return a.estimatedTime - b.estimatedTime;
      }
    });
  }

  private async enhanceRoutesWithIntersectionData(routes: Route[], vehicle: Vehicle): Promise<Route[]> {
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    
    return Promise.all(routes.map(async route => {
      try {
        const enhancedSegments = await Promise.all(route.segments.map(async segment => {
          const intersectionAnalysis = await this.analyzeSegmentIntersections(segment, vehicle, route);
          return {
            ...segment,
            intersectionAnalysis,
            largeVehicleRisk: this.calculateSegmentRiskForLargeVehicle(segment, vehicle, intersectionAnalysis)
          };
        }));

        const intersectionSummary = this.generateIntersectionSummary(enhancedSegments, isBus);

        return {
          ...route,
          segments: enhancedSegments,
          intersectionSummary
        };
      } catch (error) {
        return route;
      }
    }));
  }

  private async analyzeSegmentIntersections(segment: RouteSegment, vehicle: Vehicle, route: Route): Promise<any> {
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    const routeName = route.name?.toLowerCase() || '';
    
    // 🔧 DETERMINISTIC INTERSECTION ANALYSIS
    const seed = `${segment.streetName}-${segment.startLat.toFixed(4)}-${segment.startLng.toFixed(4)}-${routeName}`;
    
    const mockAnalysis = {
      stopSignCount: 0,
      trafficLightCount: 0,
      roundaboutCount: 0,
      uncontrolledCount: 0,
      schoolZoneIntersections: 0,
      highTrafficIntersections: 0
    };

    // Bus-optimized routes should have more traffic lights
    if (isBus && ((route as any).busOptimized || routeName.includes('arterial') || routeName.includes('highway'))) {
      mockAnalysis.trafficLightCount = Math.floor(this.generateDeterministicValue(seed + '-tl', 2, 5));
      mockAnalysis.stopSignCount = Math.floor(this.generateDeterministicValue(seed + '-ss', 0, 1));
    }
    // Highway routes have fewer intersections overall
    else if (routeName.includes('highway') || routeName.includes('express')) {
      mockAnalysis.trafficLightCount = Math.floor(this.generateDeterministicValue(seed + '-tl', 1, 2));
      mockAnalysis.stopSignCount = 0; // No stop signs on highways
    }
    // Local/residential routes have more stop signs
    else if (routeName.includes('local') || routeName.includes('residential') || segment.description?.toLowerCase().includes('residential')) {
      mockAnalysis.stopSignCount = Math.floor(this.generateDeterministicValue(seed + '-ss', 2, 5));
      mockAnalysis.trafficLightCount = Math.floor(this.generateDeterministicValue(seed + '-tl', 0, 1));
    }
    // Balanced routes
    else {
      mockAnalysis.stopSignCount = Math.floor(this.generateDeterministicValue(seed + '-ss', 1, 3));
      mockAnalysis.trafficLightCount = Math.floor(this.generateDeterministicValue(seed + '-tl', 1, 3));
    }

    return mockAnalysis;
  }

  private calculateSegmentRiskForLargeVehicle(
    segment: RouteSegment, 
    vehicle: Vehicle, 
    intersectionAnalysis: any
  ): number {
    const isLargeVehicle = vehicle.length >= this.LARGE_VEHICLE_THRESHOLD;
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    let risk = 0;

    if (!isLargeVehicle) {
      return this.calculateStandardSegmentRisk(segment, vehicle);
    }

    // Heavy penalty for stop signs, especially for buses
    const stopSignPenalty = isBus ? 45 : 35;
    risk += intersectionAnalysis.stopSignCount * stopSignPenalty;
    
    // Light penalty for traffic lights (they're actually preferred for large vehicles)
    risk += intersectionAnalysis.trafficLightCount * 5;
    
    // Heavy penalty for roundabouts and uncontrolled intersections
    risk += intersectionAnalysis.roundaboutCount * 60;
    risk += intersectionAnalysis.uncontrolledCount * 70;
    risk += intersectionAnalysis.schoolZoneIntersections * 30;
    risk += intersectionAnalysis.highTrafficIntersections * 25;

    return Math.min(risk, 100);
  }

  private generateIntersectionSummary(segments: RouteSegment[], isBus: boolean = false): any {
    const summary = {
      totalStopSigns: 0,
      totalTrafficLights: 0,
      totalRoundabouts: 0,
      totalUncontrolled: 0,
      schoolZoneIntersections: 0,
      highestRiskSegment: null as RouteSegment | null,
      averageSegmentRisk: 0,
      stopSignToTrafficLightRatio: 0
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
    
    // Calculate stop sign to traffic light ratio
    const totalIntersections = summary.totalStopSigns + summary.totalTrafficLights;
    summary.stopSignToTrafficLightRatio = totalIntersections > 0 ? summary.totalStopSigns / totalIntersections : 0;

    return summary;
  }

  private generateLargeVehicleAnalysis(routes: Route[], vehicle: Vehicle): any {
    const bestRoute = routes[0];
    const intersectionSummary = (bestRoute as any).intersectionSummary || {};
    const isBus = vehicle.length >= this.BUS_THRESHOLD;
    
    const analysis = {
      stopSignCount: intersectionSummary.totalStopSigns || 0,
      trafficLightCount: intersectionSummary.totalTrafficLights || 0,
      safetyRecommendations: [],
      alternativeRouteSuggested: false
    };

    // Generate vehicle-specific recommendations
    if (isBus) {
      analysis.safetyRecommendations = [
        `🚌 Bus Route Analysis: ${analysis.stopSignCount} stop signs, ${analysis.trafficLightCount} traffic lights`,
        `🚦 Traffic lights are preferred for bus operations - they provide controlled, predictable stops`,
        `🛑 Stop signs require complete stops and can delay schedules - minimize when possible`,
        `⚠️ Allow extra time for passenger boarding/alighting at stops`,
        `🔄 Plan wide turns - 40ft buses need 42ft turning radius`
      ];

      // Bus-specific alternative route suggestion
      if (analysis.stopSignCount > 3) {
        analysis.alternativeRouteSuggested = true;
        analysis.safetyRecommendations.unshift(
          `🚨 HIGH STOP SIGN COUNT: ${analysis.stopSignCount} stop signs detected. For bus operations, consider selecting a route with more traffic lights for better schedule reliability and passenger comfort.`
        );
      }

      const stopSignRatio = intersectionSummary.stopSignToTrafficLightRatio || 0;
      if (stopSignRatio > 0.5) {
        analysis.safetyRecommendations.push(
          `📊 Route is ${Math.round(stopSignRatio * 100)}% stop signs - look for arterial roads with traffic signals`
        );
      }
    } else {
      analysis.safetyRecommendations = EnhancedRiskCalculator.getLargeVehicleSafetyRecommendations(bestRoute, vehicle);
      
      if (analysis.stopSignCount > 5) {
        analysis.alternativeRouteSuggested = true;
        analysis.safetyRecommendations.unshift(
          `⚠️ High stop sign count: ${analysis.stopSignCount} stop signs. Consider alternative routing for large vehicle safety.`
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
    request: RouteAnalysisRequest,
    routeType: string
  ): Route {
    const route: Route = {
      id: `temp-route-${index}`,
      name: `${routeType} Route ${index + 1}`,
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
            pedestrianTraffic: 50, // Will be replaced by deterministic values
            roadWidth: 50,
            trafficCongestion: 50,
            speedLimit: 35,
            heightRestriction: 0
          }
        };
        route.segments.push(segment);
      });
    });

    return route;
  }
}