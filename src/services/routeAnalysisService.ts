// Enhanced routeAnalysisService.ts

import { GoogleMapsService, RoadData } from './googleMapsService';
import { Route, RouteSegment, CriticalPoint, Vehicle, StopLocation } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';

export interface RouteAnalysisRequest {
  origin: string;
  destination: string;
  vehicle: Vehicle;
  stops?: StopLocation[];
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  isLoop?: boolean;
}

export interface RouteAnalysisResult {
  routes: Route[];
  recommendedRouteId: string;
}

export class RouteAnalysisService {
  private googleMapsService: GoogleMapsService;

  constructor() {
    this.googleMapsService = GoogleMapsService.getInstance();
  }

  public async analyzeRoutes(request: RouteAnalysisRequest): Promise<RouteAnalysisResult> {
    console.log('🚦 Starting enhanced route analysis...');
    console.log('📋 Request:', {
      origin: request.origin,
      destination: request.destination,
      stops: request.stops?.length || 0,
      isLoop: request.isLoop
    });

    try {
      // Step 1: Initialize Google Maps
      await this.googleMapsService.initialize();
      console.log('✅ Google Maps initialized');

      // Step 2: Enhanced address processing
      console.log('🔧 Processing addresses with smart enhancement...');
      const processedAddresses = await this.smartAddressProcessing(request);
      console.log('✅ Addresses processed:', processedAddresses);

      // Step 3: Multi-strategy route finding
      console.log('🛣️ Finding routes with multiple strategies...');
      const googleRoutes = await this.findRoutesWithFallback(processedAddresses, request);
      console.log(`✅ Found ${googleRoutes.length} route(s)`);

      // Step 4: Convert and analyze routes
      console.log('🧮 Converting routes and calculating risks...');
      const routes = await this.convertAndAnalyzeRoutes(googleRoutes, request);
      console.log(`✅ Analyzed ${routes.length} route(s)`);

      // Step 5: Select and sort routes
      const finalRoutes = this.selectBestRoutes(routes, request.vehicle);
      const recommendedRouteId = finalRoutes[0]?.id || '';

      console.log('🎉 Route analysis completed successfully');
      console.log(`📊 Recommended: ${recommendedRouteId} with ${Math.round(finalRoutes[0]?.overallRisk || 0)}% risk`);

      return {
        routes: finalRoutes,
        recommendedRouteId
      };

    } catch (error) {
      console.error('❌ Route analysis failed:', error);
      throw this.createUserFriendlyError(error, request);
    }
  }

  private async smartAddressProcessing(request: RouteAnalysisRequest): Promise<{
    origin: string;
    destination: string;
    originCoords: { lat: number; lng: number };
    destCoords: { lat: number; lng: number };
    stops?: Array<{ address: string; coords: { lat: number; lng: number } }>;
  }> {
    // Smart address enhancement
    const enhancedOrigin = this.enhanceAddress(request.origin);
    const enhancedDestination = this.enhanceAddress(request.destination);

    console.log(`   📍 Enhanced origin: "${request.origin}" → "${enhancedOrigin}"`);
    console.log(`   📍 Enhanced destination: "${request.destination}" → "${enhancedDestination}"`);

    // Geocode with multiple fallback strategies
    const originResult = await this.geocodeWithStrategies(enhancedOrigin, request.origin);
    const destResult = await this.geocodeWithStrategies(enhancedDestination, request.destination);

    const originCoords = {
      lat: originResult.geometry.location.lat(),
      lng: originResult.geometry.location.lng()
    };

    const destCoords = {
      lat: destResult.geometry.location.lat(),
      lng: destResult.geometry.location.lng()
    };

    console.log(`   ✅ Origin: ${originResult.formatted_address} (${originCoords.lat.toFixed(4)}, ${originCoords.lng.toFixed(4)})`);
    console.log(`   ✅ Destination: ${destResult.formatted_address} (${destCoords.lat.toFixed(4)}, ${destCoords.lng.toFixed(4)})`);

    // Process stops if present
    let processedStops;
    if (request.stops && request.stops.length > 0) {
      console.log(`   🛑 Processing ${request.stops.length} stop(s)...`);
      processedStops = [];
      
      for (const stop of request.stops) {
        try {
          const enhancedStop = this.enhanceAddress(stop.address);
          const stopResult = await this.geocodeWithStrategies(enhancedStop, stop.address);
          
          processedStops.push({
            address: stopResult.formatted_address,
            coords: {
              lat: stopResult.geometry.location.lat(),
              lng: stopResult.geometry.location.lng()
            }
          });
          
          console.log(`   ✅ Stop: ${stopResult.formatted_address}`);
        } catch (error) {
          console.warn(`   ⚠️ Skipping invalid stop: ${stop.address}`);
        }
      }
    }

    return {
      origin: originResult.formatted_address,
      destination: destResult.formatted_address,
      originCoords,
      destCoords,
      stops: processedStops
    };
  }

  private enhanceAddress(address: string): string {
    let enhanced = address.trim();

    // Skip if already coordinates
    if (/^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/.test(enhanced)) {
      return enhanced;
    }

    // Louisiana-specific enhancements
    const louisianaKeywords = [
      'lafayette', 'opelousas', 'acadiana', 'vermilion', 'iberia', 'acadia',
      'eunice', 'crowley', 'rayne', 'scott', 'carencro', 'broussard', 'youngsville'
    ];

    const isLouisianaAddress = louisianaKeywords.some(keyword =>
      enhanced.toLowerCase().includes(keyword)
    );

    // Add state if missing
    if (isLouisianaAddress && !enhanced.includes(' LA') && !enhanced.includes('Louisiana')) {
      enhanced += ', LA';
    }

    // Add country for better geocoding
    if (!enhanced.includes('USA') && !enhanced.includes('United States')) {
      enhanced += ', USA';
    }

    // Common business name expansions
    enhanced = enhanced
      .replace(/\bWalmart\b/gi, 'Walmart Supercenter')
      .replace(/\bUL\b/gi, 'University of Louisiana')
      .replace(/\bLSU\b/gi, 'Louisiana State University');

    return enhanced;
  }

  private async geocodeWithStrategies(primaryAddress: string, fallbackAddress: string): Promise<google.maps.GeocoderResult> {
    const strategies = [
      { name: 'Primary Enhanced', address: primaryAddress },
      { name: 'Original Fallback', address: fallbackAddress },
      { name: 'City-Only Fallback', address: this.extractCityFromAddress(primaryAddress) }
    ];

    for (const strategy of strategies) {
      if (!strategy.address) continue;
      
      try {
        console.log(`     🧪 Trying ${strategy.name}: "${strategy.address}"`);
        const results = await this.googleMapsService.geocodeAddress(strategy.address);
        
        if (results.length > 0) {
          console.log(`     ✅ ${strategy.name} succeeded`);
          return results[0];
        }
      } catch (error) {
        console.warn(`     ❌ ${strategy.name} failed:`, error instanceof Error ? error.message : error);
      }
    }

    throw new Error(`Could not geocode address: "${primaryAddress}" or "${fallbackAddress}"`);
  }

  private extractCityFromAddress(address: string): string | null {
    const cityPatterns = [
      /\b(lafayette|opelousas|eunice|crowley|rayne|scott|carencro|broussard|youngsville)\b/gi
    ];

    for (const pattern of cityPatterns) {
      const match = address.match(pattern);
      if (match) {
        return `${match[0]}, LA, USA`;
      }
    }

    return null;
  }

  private async findRoutesWithFallback(
    addresses: {
      origin: string;
      destination: string;
      originCoords: { lat: number; lng: number };
      destCoords: { lat: number; lng: number };
      stops?: Array<{ address: string; coords: { lat: number; lng: number } }>;
    },
    request: RouteAnalysisRequest
  ): Promise<google.maps.DirectionsRoute[]> {
    
    const routingStrategies = [
      {
        name: 'Enhanced Addresses',
        origin: addresses.origin,
        destination: addresses.destination,
        waypoints: addresses.stops?.map(s => s.address)
      },
      {
        name: 'Coordinates',
        origin: `${addresses.originCoords.lat},${addresses.originCoords.lng}`,
        destination: `${addresses.destCoords.lat},${addresses.destCoords.lng}`,
        waypoints: addresses.stops?.map(s => `${s.coords.lat},${s.coords.lng}`)
      },
      {
        name: 'Original Addresses',
        origin: request.origin,
        destination: request.destination,
        waypoints: request.stops?.map(s => s.address)
      }
    ];

    for (const strategy of routingStrategies) {
      try {
        console.log(`   🛣️ Trying routing strategy: ${strategy.name}`);
        
        const routeResponse = await this.googleMapsService.getRoutes({
          origin: strategy.origin,
          destination: strategy.destination,
          waypoints: strategy.waypoints?.filter(Boolean),
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: request.avoidHighways || false,
          avoidTolls: request.avoidTolls || false,
          departureTime: new Date()
        });

        if (routeResponse.routes && routeResponse.routes.length > 0) {
          console.log(`   ✅ Strategy "${strategy.name}" found ${routeResponse.routes.length} route(s)`);
          return routeResponse.routes;
        }

      } catch (error) {
        console.warn(`   ❌ Strategy "${strategy.name}" failed:`, error instanceof Error ? error.message : error);
      }
    }

    throw new Error(`No routes found with any strategy between "${request.origin}" and "${request.destination}"`);
  }

  private async convertAndAnalyzeRoutes(
    googleRoutes: google.maps.DirectionsRoute[],
    request: RouteAnalysisRequest
  ): Promise<Route[]> {
    const routes = await Promise.all(
      googleRoutes.map(async (googleRoute, index) => {
        console.log(`   📝 Converting route ${index + 1}: ${googleRoute.summary}`);
        return await this.convertGoogleRouteToRoute(googleRoute, index, request.vehicle, request.stops);
      })
    );

    // Calculate risk scores
    return routes.map(route => ({
      ...route,
      overallRisk: RiskCalculator.calculateRouteRisk(route, request.vehicle)
    }));
  }

  private selectBestRoutes(routes: Route[], vehicle: Vehicle): Route[] {
    // Sort by risk, then by critical points, then by time
    const sorted = routes.sort((a, b) => {
      if (Math.abs(a.overallRisk - b.overallRisk) > 5) {
        return a.overallRisk - b.overallRisk;
      }
      if (a.criticalPoints.length !== b.criticalPoints.length) {
        return a.criticalPoints.length - b.criticalPoints.length;
      }
      return a.estimatedTime - b.estimatedTime;
    });

    // Return top 3 routes
    return sorted.slice(0, 3);
  }

  private createUserFriendlyError(error: unknown, request: RouteAnalysisRequest): Error {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('geocode') || errorMessage.includes('address')) {
      return new Error(
        `📍 Address Issue\n\n` +
        `One or both addresses could not be found:\n` +
        `• Origin: "${request.origin}"\n` +
        `• Destination: "${request.destination}"\n\n` +
        `Try these formats:\n` +
        `• "University of Louisiana, Lafayette, LA"\n` +
        `• "Walmart, Opelousas, LA"\n` +
        `• "123 Main St, Lafayette, LA 70501"\n` +
        `• Business names work well for landmarks`
      );
    }

    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('ZERO_RESULTS')) {
      return new Error(
        `🚫 No Route Found\n\n` +
        `Could not find a drivable route between these locations.\n\n` +
        `This usually means:\n` +
        `• Locations are not connected by roads\n` +
        `• One address is inaccessible to vehicles\n` +
        `• Geographic barriers prevent routing\n\n` +
        `Please verify both locations are car-accessible.`
      );
    }

    return error instanceof Error ? error : new Error(errorMessage);
  }

  // Simplified route conversion for this implementation
  private async convertGoogleRouteToRoute(
    googleRoute: google.maps.DirectionsRoute,
    index: number,
    vehicle: Vehicle,
    stops?: StopLocation[]
  ): Promise<Route> {
    const routeId = `route-${index + 1}`;
    const routeName = googleRoute.summary || `Route ${index + 1}`;
    
    // Calculate totals
    const totalDistance = googleRoute.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
    const totalDuration = googleRoute.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
    
    const totalDistanceMiles = Math.round((totalDistance * 0.000621371) * 10) / 10;
    const estimatedTimeMinutes = Math.round(totalDuration / 60);
    
    // Add stop time
    const stopTime = stops ? stops.reduce((sum, stop) => sum + (stop.estimatedStopTime || 0), 0) : 0;
    
    // Create segments from route steps
    const segments = await this.createSegmentsFromRoute(googleRoute, routeId, vehicle);
    
    // Identify critical points
    const criticalPoints = this.identifyCriticalPoints(segments, vehicle);

    return {
      id: routeId,
      name: routeName,
      segments,
      totalDistance: totalDistanceMiles,
      estimatedTime: estimatedTimeMinutes + stopTime,
      overallRisk: 0, // Will be calculated later
      criticalPoints,
      waypoints: stops?.map(stop => stop.address),
      stops,
      googleRoute
    };
  }

  private async createSegmentsFromRoute(
    googleRoute: google.maps.DirectionsRoute,
    routeId: string,
    vehicle: Vehicle
  ): Promise<RouteSegment[]> {
    const segments: RouteSegment[] = [];
    let segmentCounter = 0;

    for (const leg of googleRoute.legs) {
      for (const step of leg.steps || []) {
        const streetName = this.extractStreetName(step.instructions);
        
        // Get road data
        const roadData = await this.googleMapsService.getRoadData(
          step.start_location.lat(),
          step.start_location.lng()
        );

        const riskFactors = {
          pedestrianTraffic: roadData.pedestrianTraffic || 30,
          roadWidth: roadData.roadWidth || 40,
          trafficCongestion: this.estimateTrafficCongestion(step),
          speedLimit: roadData.speedLimit || 35,
          heightRestriction: roadData.heightRestrictions || 0
        };

        segments.push({
          id: `${routeId}-seg-${++segmentCounter}`,
          startLat: step.start_location.lat(),
          startLng: step.start_location.lng(),
          endLat: step.end_location.lat(),
          endLng: step.end_location.lng(),
          streetName,
          riskScore: 0,
          riskFactors,
          description: this.generateSegmentDescription(step, riskFactors, vehicle)
        });
      }
    }

    return segments;
  }

  private extractStreetName(instructions: string): string {
    const clean = instructions.replace(/<[^>]*>/g, '');
    const patterns = [
      /(?:on|onto|via)\s+([^,\n]+)/i,
      /head\s+\w+\s+on\s+([^,\n]+)/i,
      /continue\s+on\s+([^,\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'Local Road';
  }

  private estimateTrafficCongestion(step: google.maps.DirectionsStep): number {
    const distance = step.distance?.value || 1;
    const duration = step.duration?.value || 1;
    const speed = (distance / 1609.34) / (duration / 3600); // mph

    if (speed < 10) return 90;
    if (speed < 15) return 70;
    if (speed < 25) return 50;
    if (speed < 35) return 30;
    return 15;
  }

  private generateSegmentDescription(
    step: google.maps.DirectionsStep,
    riskFactors: any,
    vehicle: Vehicle
  ): string {
    const instructions = step.instructions.replace(/<[^>]*>/g, '');
    const concerns = [];

    if (riskFactors.trafficCongestion > 70) {
      concerns.push('heavy traffic');
    }
    if (riskFactors.pedestrianTraffic > 70) {
      concerns.push('high pedestrian activity');
    }
    if (vehicle.length >= 35 && instructions.toLowerCase().includes('turn')) {
      concerns.push('large vehicle turn');
    }

    return concerns.length > 0 
      ? `${instructions} • ${concerns.join(' • ')}`
      : instructions;
  }

  private identifyCriticalPoints(segments: RouteSegment[], vehicle: Vehicle): CriticalPoint[] {
    const criticalPoints: CriticalPoint[] = [];

    segments.forEach((segment, index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      if (riskScore > 60) {
        criticalPoints.push({
          segmentId: segment.id,
          type: segment.riskFactors.heightRestriction > 0 ? 'bridge' : 
                segment.streetName.toLowerCase().includes('turn') ? 'turn' : 'intersection',
          riskLevel: riskScore > 80 ? 'critical' : 'high',
          description: `High-risk area: ${segment.streetName}`,
          position: index
        });
      }
    });

    return criticalPoints;
  }
}