// Enhanced routeAnalysisService.ts with comprehensive debugging
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
    console.log('🚦 STARTING ROUTE ANALYSIS - Enhanced Debug Mode');
    console.log('📋 Request Details:', {
      origin: request.origin,
      destination: request.destination,
      stops: request.stops?.length || 0,
      isLoop: request.isLoop,
      vehicle: `${request.vehicle.length}ft x ${request.vehicle.width}ft x ${request.vehicle.height}ft`
    });

    try {
      // Step 1: Verify API Configuration
      console.log('🔧 Step 1: Checking API Configuration...');
      const hasApiKey = this.googleMapsService.hasApiKey();
      console.log(`   API Key Available: ${hasApiKey}`);
      
      if (!hasApiKey) {
        throw new Error('❌ Google Maps API key not found. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file');
      }

      // Step 2: Initialize Google Maps
      console.log('🔧 Step 2: Initializing Google Maps Service...');
      await this.googleMapsService.initialize();
      console.log('   ✅ Google Maps initialized successfully');

      // Step 3: Validate Addresses
      console.log('🔧 Step 3: Validating Addresses...');
      const validationResults = await this.validateAllAddresses(request);
      console.log(`   ✅ All addresses validated: ${validationResults.success}`);

      if (!validationResults.success) {
        throw new Error(validationResults.error);
      }

      // Step 4: Check Distance Reasonableness
      console.log('🔧 Step 4: Checking Route Distance...');
      const distance = this.calculateDistance(
        validationResults.originCoords!.lat, validationResults.originCoords!.lng,
        validationResults.destCoords!.lat, validationResults.destCoords!.lng
      );
      console.log(`   📏 Straight-line distance: ${distance.toFixed(1)} miles`);

      if (distance > 500) {
        console.warn(`   ⚠️ Large distance detected (${distance.toFixed(1)} miles)`);
      }

      // Step 5: Request Routes from Google
      console.log('🔧 Step 5: Requesting Routes from Google Maps...');
      const googleRoutes = await this.requestGoogleRoutes(request, distance);
      console.log(`   ✅ Google returned ${googleRoutes.length} route(s)`);

      // Step 6: Convert to Internal Format
      console.log('🔧 Step 6: Converting Routes to Internal Format...');
      const routes = await this.convertAndAnalyzeRoutes(googleRoutes, request);
      console.log(`   ✅ Converted ${routes.length} route(s) with risk analysis`);

      // Step 7: Select Recommended Route
      console.log('🔧 Step 7: Selecting Recommended Route...');
      const sortedRoutes = this.sortRoutesBySafety(routes, request.vehicle);
      const recommendedRouteId = sortedRoutes[0]?.id || '';
      
      console.log(`   ✅ Recommended route: ${recommendedRouteId} (${sortedRoutes[0]?.name})`);
      console.log(`   📊 Risk score: ${Math.round(sortedRoutes[0]?.overallRisk || 0)}%`);

      console.log('🎉 ROUTE ANALYSIS COMPLETED SUCCESSFULLY');
      console.log(`📋 Final Summary: ${sortedRoutes.length} routes, recommended: ${recommendedRouteId}`);

      return {
        routes: sortedRoutes,
        recommendedRouteId
      };

    } catch (error) {
      console.error('❌ ROUTE ANALYSIS FAILED');
      console.error('Error details:', error);
      
      // Enhanced error handling with specific messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('🔑 Google Maps API Key Issue:\n\n' +
            '1. Check that VITE_GOOGLE_MAPS_API_KEY is in your .env file\n' +
            '2. Verify the API key is correct in Google Cloud Console\n' +
            '3. Ensure billing is enabled for your Google Cloud project\n' +
            '4. Restart the development server after adding the API key');
        } 
        else if (error.message.includes('not found') || error.message.includes('geocoding')) {
          throw new Error(`📍 Address Not Found:\n\n${error.message}\n\n` +
            'Try using more specific addresses:\n' +
            '• Include street number, city, and state\n' +
            '• Example: "123 Main St, Lafayette, LA"\n' +
            '• Use business names: "Walmart, Lafayette, LA"');
        }
        else if (error.message.includes('ZERO_RESULTS')) {
          throw new Error('🛣️ No Route Found:\n\n' +
            'Google Maps could not find a drivable route between these locations.\n\n' +
            'Please verify:\n' +
            '• Both addresses are accessible by car\n' +
            '• No major barriers (water, mountains) block the route\n' +
            '• Addresses are in the same general region');
        }
        else if (error.message.includes('OVER_QUERY_LIMIT')) {
          throw new Error('🚫 API Limit Exceeded:\n\n' +
            'Too many requests to Google Maps API.\n\n' +
            'Please:\n' +
            '• Wait a few minutes and try again\n' +
            '• Check your Google Cloud quotas\n' +
            '• Consider upgrading your API plan');
        }
        
        // Re-throw the original error if no specific handling
        throw error;
      }
      
      throw new Error('❌ Unknown error occurred during route analysis. Check console for details.');
    }
  }

  private async validateAllAddresses(request: RouteAnalysisRequest): Promise<{
    success: boolean;
    error?: string;
    originCoords?: { lat: number; lng: number };
    destCoords?: { lat: number; lng: number };
  }> {
    try {
      // Validate origin
      console.log(`   📍 Validating origin: "${request.origin}"`);
      const originResults = await this.googleMapsService.geocodeAddress(request.origin);
      
      if (originResults.length === 0) {
        return {
          success: false,
          error: `Origin address not found: "${request.origin}"\n\nTry a more specific address with city and state.`
        };
      }

      const originLocation = originResults[0].geometry.location;
      const originCoords = { lat: originLocation.lat(), lng: originLocation.lng() };
      console.log(`   ✅ Origin validated: ${originResults[0].formatted_address} (${originCoords.lat.toFixed(4)}, ${originCoords.lng.toFixed(4)})`);

      // Validate destination
      console.log(`   📍 Validating destination: "${request.destination}"`);
      const destResults = await this.googleMapsService.geocodeAddress(request.destination);
      
      if (destResults.length === 0) {
        return {
          success: false,
          error: `Destination address not found: "${request.destination}"\n\nTry a more specific address with city and state.`
        };
      }

      const destLocation = destResults[0].geometry.location;
      const destCoords = { lat: destLocation.lat(), lng: destLocation.lng() };
      console.log(`   ✅ Destination validated: ${destResults[0].formatted_address} (${destCoords.lat.toFixed(4)}, ${destCoords.lng.toFixed(4)})`);

      // Validate stops if provided
      if (request.stops && request.stops.length > 0) {
        console.log(`   📍 Validating ${request.stops.length} stop location(s)...`);
        
        for (let i = 0; i < request.stops.length; i++) {
          const stop = request.stops[i];
          console.log(`   📍 Validating stop ${i + 1}: "${stop.address}"`);
          
          const stopResults = await this.googleMapsService.geocodeAddress(stop.address);
          if (stopResults.length === 0) {
            return {
              success: false,
              error: `Stop ${i + 1} address not found: "${stop.address}"\n\nPlease check the address and try again.`
            };
          }
          
          console.log(`   ✅ Stop ${i + 1} validated: ${stopResults[0].formatted_address}`);
        }
      }

      return {
        success: true,
        originCoords,
        destCoords
      };

    } catch (error) {
      console.error('   ❌ Address validation error:', error);
      return {
        success: false,
        error: `Address validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async requestGoogleRoutes(request: RouteAnalysisRequest, estimatedDistance: number): Promise<google.maps.DirectionsRoute[]> {
    const waypoints = request.stops?.map(stop => stop.address) || [];
    console.log(`   🗺️ Requesting routes via Google Maps API...`);
    console.log(`   📍 Origin: ${request.origin}`);
    console.log(`   📍 Destination: ${request.destination}`);
    console.log(`   📍 Waypoints: ${waypoints.length ? waypoints.join(' → ') : 'None'}`);
    console.log(`   🔄 Loop route: ${request.isLoop ? 'Yes' : 'No'}`);

    try {
      let allRoutes: google.maps.DirectionsRoute[] = [];

      if (request.isLoop) {
        console.log('   🔄 Processing loop route (outbound + return)...');
        
        // Outbound route
        console.log('   ➡️ Requesting outbound route...');
        const outboundResponse = await this.googleMapsService.getRoutes({
          origin: request.origin,
          destination: request.destination,
          waypoints: waypoints.length > 0 ? waypoints : undefined,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: request.avoidHighways,
          avoidTolls: request.avoidTolls,
          departureTime: new Date()
        });

        if (!outboundResponse.routes || outboundResponse.routes.length === 0) {
          throw new Error(`No outbound route found from "${request.origin}" to "${request.destination}"`);
        }
        console.log(`   ✅ Outbound route found: ${outboundResponse.routes[0].summary}`);

        // Return route
        console.log('   ⬅️ Requesting return route...');
        const returnResponse = await this.googleMapsService.getRoutes({
          origin: request.destination,
          destination: request.origin,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: request.avoidHighways,
          avoidTolls: request.avoidTolls,
          departureTime: new Date()
        });

        if (!returnResponse.routes || returnResponse.routes.length === 0) {
          throw new Error(`No return route found from "${request.destination}" to "${request.origin}"`);
        }
        console.log(`   ✅ Return route found: ${returnResponse.routes[0].summary}`);

        // Combine routes
        const combinedRoute = this.combineRoutes(outboundResponse.routes[0], returnResponse.routes[0]);
        allRoutes = [combinedRoute];
        console.log('   ✅ Combined outbound and return routes');

      } else {
        // Standard one-way route
        console.log('   ➡️ Requesting one-way route...');
        const routeResponse = await this.googleMapsService.getRoutes({
          origin: request.origin,
          destination: request.destination,
          waypoints: waypoints.length > 0 ? waypoints : undefined,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: request.avoidHighways,
          avoidTolls: request.avoidTolls,
          departureTime: new Date()
        });

        if (!routeResponse.routes || routeResponse.routes.length === 0) {
          let errorMsg = `No routes found between:\n• From: "${request.origin}"\n• To: "${request.destination}"`;
          if (waypoints.length > 0) {
            errorMsg += `\n• Via: ${waypoints.join(', ')}`;
          }
          errorMsg += '\n\nPlease verify all locations are accessible by road.';
          throw new Error(errorMsg);
        }

        allRoutes = routeResponse.routes;
        console.log(`   ✅ Found ${allRoutes.length} route option(s)`);
      }

      // Log route summaries
      allRoutes.forEach((route, index) => {
        const totalDistance = route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
        const totalTime = route.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
        console.log(`   📊 Route ${index + 1}: ${(totalDistance / 1609.34).toFixed(1)}mi, ${Math.round(totalTime / 60)}min - ${route.summary}`);
      });

      return allRoutes;

    } catch (error) {
      console.error('   ❌ Google Maps route request failed:', error);
      throw error;
    }
  }

  private async convertAndAnalyzeRoutes(
    googleRoutes: google.maps.DirectionsRoute[],
    request: RouteAnalysisRequest
  ): Promise<Route[]> {
    console.log(`   🔄 Converting ${googleRoutes.length} Google route(s) to internal format...`);

    const routes = await Promise.all(
      googleRoutes.map(async (googleRoute, index) => {
        console.log(`   📝 Processing route ${index + 1}...`);
        return await this.convertGoogleRouteToRoute(googleRoute, index, request.vehicle, request.stops, googleRoute);
      })
    );

    console.log(`   ✅ Successfully converted all routes`);

    // Calculate risk scores
    console.log(`   🧮 Calculating risk scores...`);
    const routesWithRisk = routes.map(route => {
      const overallRisk = RiskCalculator.calculateRouteRisk(route, request.vehicle);
      console.log(`   📊 ${route.name}: ${Math.round(overallRisk)}% risk, ${route.criticalPoints.length} critical points`);
      
      return {
        ...route,
        overallRisk
      };
    });

    return routesWithRisk;
  }

  private sortRoutesBySafety(routes: Route[], vehicle: Vehicle): Route[] {
    console.log(`   🔀 Sorting ${routes.length} routes by safety...`);
    
    const sorted = routes.sort((a, b) => {
      // Primary sort: overall risk (lower is better)
      if (Math.abs(a.overallRisk - b.overallRisk) > 5) {
        return a.overallRisk - b.overallRisk;
      }
      
      // Secondary sort: critical points (fewer is better)
      if (a.criticalPoints.length !== b.criticalPoints.length) {
        return a.criticalPoints.length - b.criticalPoints.length;
      }
      
      // Tertiary sort: time (faster is better)
      return a.estimatedTime - b.estimatedTime;
    });

    sorted.forEach((route, index) => {
      console.log(`   ${index + 1}. ${route.name} - ${Math.round(route.overallRisk)}% risk`);
    });

    return sorted;
  }

  // Include other necessary private methods from original service
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

  private combineRoutes(
    outboundRoute: google.maps.DirectionsRoute,
    returnRoute: google.maps.DirectionsRoute
  ): google.maps.DirectionsRoute {
    // Combine legs
    const combinedLegs = [...outboundRoute.legs, ...returnRoute.legs];

    // Calculate combined bounds
    const combinedBounds = new google.maps.LatLngBounds();
    outboundRoute.bounds && combinedBounds.union(outboundRoute.bounds);
    returnRoute.bounds && combinedBounds.union(returnRoute.bounds);

    // Create combined route
    const combinedDirectionsRoute: google.maps.DirectionsRoute = {
      legs: combinedLegs,
      bounds: combinedBounds,
      copyrights: [...outboundRoute.copyrights, ...returnRoute.copyrights],
      warnings: [...outboundRoute.warnings, ...returnRoute.warnings],
      overview_polyline: outboundRoute.overview_polyline, // Use outbound for simplicity
      summary: `Loop: ${outboundRoute.summary || ''} & ${returnRoute.summary || ''}`
    };

    return combinedDirectionsRoute;
  }

  // Add the convertGoogleRouteToRoute method and other private methods from the original
  private async convertGoogleRouteToRoute(
    googleRoute: google.maps.DirectionsRoute,
    index: number,
    vehicle: Vehicle,
    stops?: StopLocation[],
    originalGoogleRoute?: google.maps.DirectionsRoute
  ): Promise<Route> {
    const routeId = `route-${index + 1}`;
    const routeName = this.generateRouteName(googleRoute, index, stops);
    
    // Extract basic route info
    const totalDistance = googleRoute.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
    const totalDuration = googleRoute.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
    
    const totalDistanceMiles = this.metersToMiles(totalDistance);
    const estimatedTimeMinutes = Math.round(totalDuration / 60);

    // Add stop time if stops are provided
    const stopTime = stops ? stops.reduce((sum, stop) => sum + (stop.estimatedStopTime || 0), 0) : 0;
    const totalTimeWithStops = estimatedTimeMinutes + stopTime;

    // Create segments
    const segments = await this.createSegmentsFromLegs(
      googleRoute.legs,
      routeId,
      vehicle
    );

    // Identify critical points
    const criticalPoints = this.identifyCriticalPoints(segments, vehicle);

    return {
      id: routeId,
      name: routeName,
      segments,
      totalDistance: totalDistanceMiles,
      estimatedTime: totalTimeWithStops,
      overallRisk: 0, // Will be calculated later
      criticalPoints,
      waypoints: stops?.map(stop => stop.address),
      stops,
      googleRoute: originalGoogleRoute
    };
  }

  private generateRouteName(googleRoute: google.maps.DirectionsRoute, index: number, stops?: StopLocation[]): string {
    const summary = googleRoute.summary;
    
    if (stops && stops.length > 0) {
      const stopCount = stops.length;
      const baseName = summary && summary.trim() ? summary : `Route ${index + 1}`;
      return `${baseName} (${stopCount} stop${stopCount > 1 ? 's' : ''})`;
    }
    
    return summary && summary.trim() ? summary : `Route ${index + 1}`;
  }

  private async createSegmentsFromLegs(
    legs: google.maps.DirectionsLeg[],
    routeId: string,
    vehicle: Vehicle
  ): Promise<RouteSegment[]> {
    const segments: RouteSegment[] = [];
    let segmentCounter = 0;

    for (const leg of legs) {
      const steps = leg.steps || [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const startLocation = step.start_location;
        const endLocation = step.end_location;

        // Get road data
        const roadData = await this.googleMapsService.getRoadData(
          startLocation.lat(),
          startLocation.lng()
        );

        const streetName = this.extractStreetName(step.instructions);
        
        const riskFactors = {
          pedestrianTraffic: roadData.pedestrianTraffic || 30,
          roadWidth: roadData.roadWidth || 40,
          trafficCongestion: this.estimateTrafficCongestion(step),
          speedLimit: roadData.speedLimit || 35,
          heightRestriction: roadData.heightRestrictions || 0
        };

        const segment: RouteSegment = {
          id: `${routeId}-seg-${segmentCounter + 1}`,
          startLat: startLocation.lat(),
          startLng: startLocation.lng(),
          endLat: endLocation.lat(),
          endLng: endLocation.lng(),
          streetName,
          riskScore: 0,
          riskFactors,
          description: this.generateSegmentDescription(step, roadData, riskFactors, vehicle)
        };

        segments.push(segment);
        segmentCounter++;
      }
    }

    return segments;
  }

  private extractStreetName(instructions: string): string {
    // Remove HTML tags first
    const cleanInstructions = instructions.replace(/<[^>]*>/g, '');
    
    // Enhanced patterns to extract street names
    const patterns = [
      /(?:turn|continue).*?(?:onto|on)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
      /head\s+\w+\s+on\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
      /take.*?(?:ramp|exit).*?(?:onto|toward)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
      /continue\s+on\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
      /merge\s+onto\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
      /(?:on|onto|via|toward)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    ];

    for (const pattern of patterns) {
      const match = cleanInstructions.match(pattern);
      if (match && match[1]) {
        let streetName = match[1].trim();
        streetName = streetName.replace(/\s+(?:toward|for|until|in|at).*$/i, '');
        streetName = streetName.replace(/\s+/g, ' ').trim();
        
        if (streetName.length > 1 && streetName.length < 50) {
          return this.formatStreetName(streetName);
        }
      }
    }

    return 'Local Street';
  }

  private formatStreetName(streetName: string): string {
    return streetName
      .replace(/\bSt\b/g, 'Street')
      .replace(/\bAve\b/g, 'Avenue') 
      .replace(/\bBlvd\b/g, 'Boulevard')
      .replace(/\bRd\b/g, 'Road')
      .replace(/\bDr\b/g, 'Drive')
      .replace(/\bHwy\b/g, 'Highway')
      .replace(/\bI-(\d+)/g, 'Interstate $1')
      .replace(/\bUS-(\d+)/g, 'US Highway $1')
      .replace(/\bLA-(\d+)/g, 'Louisiana Highway $1')
      .trim();
  }

  private estimateTrafficCongestion(step: google.maps.DirectionsStep): number {
    const distance = step.distance?.value || 1;
    const duration = step.duration?.value || 1;
    const speed = (distance / 1609.34) / (duration / 3600); // mph

    if (speed < 10) return 90;
    if (speed < 15) return 80;
    if (speed < 25) return 60;
    if (speed < 35) return 40;
    if (speed < 45) return 25;
    return 15;
  }

  private generateSegmentDescription(
    step: google.maps.DirectionsStep,
    roadData: RoadData,
    riskFactors: { pedestrianTraffic: number; roadWidth: number; trafficCongestion: number; speedLimit: number; heightRestriction: number; },
    vehicle: Vehicle
  ): string {
    const descriptions = [];
    const instructions = step.instructions.toLowerCase();
    const distance = step.distance?.value || 0;
    const distanceMiles = Math.round((distance / 1609.34) * 10) / 10;

    // Movement type description
    let movementType = '';
    if (instructions.includes('turn left')) {
      movementType = riskFactors.roadWidth > 60 ? 'Sharp left turn' : 'Left turn';
    } else if (instructions.includes('turn right')) {
      movementType = riskFactors.roadWidth > 60 ? 'Sharp right turn' : 'Right turn';
    } else if (instructions.includes('continue') || instructions.includes('head')) {
      movementType = 'Continue straight';
    } else if (instructions.includes('merge')) {
      movementType = 'Merge into traffic';
    } else if (instructions.includes('exit') || instructions.includes('ramp')) {
      movementType = 'Take exit/ramp';
    } else {
      movementType = 'Proceed';
    }

    if (distanceMiles >= 0.5) {
      movementType += ` for ${distanceMiles} mile${distanceMiles !== 1 ? 's' : ''}`;
    }

    descriptions.push(movementType);

    // Add risk factors
    if (riskFactors.trafficCongestion > 75) {
      descriptions.push('heavy traffic expected');
    } else if (riskFactors.trafficCongestion > 50) {
      descriptions.push('moderate traffic');
    }

    if (vehicle.length >= 35 && instructions.includes('turn') && riskFactors.roadWidth > 60) {
      descriptions.push('⚠️ tight turn for large vehicle');
    }

    if (riskFactors.pedestrianTraffic > 70) {
      descriptions.push('⚠️ high pedestrian activity');
    }

    if (roadData.heightRestrictions && roadData.heightRestrictions > 0) {
      const clearance = roadData.heightRestrictions;
      if (clearance <= vehicle.height + 1) {
        descriptions.push(`🚨 CRITICAL: ${clearance}ft height limit`);
      } else if (clearance <= vehicle.height + 2) {
        descriptions.push(`⚠️ Low clearance: ${clearance}ft`);
      }
    }

    return descriptions.join(' • ');
  }

  private identifyCriticalPoints(segments: RouteSegment[], vehicle: Vehicle): CriticalPoint[] {
    const criticalPoints: CriticalPoint[] = [];

    segments.forEach((segment, index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      
      if (riskScore > 60) {
        let type: CriticalPoint['type'] = 'intersection';
        let description = '';

        // Height restrictions are always critical
        if (segment.riskFactors.heightRestriction > 0 && 
            segment.riskFactors.heightRestriction <= vehicle.height + 1) {
          type = 'bridge';
          description = `Height restriction: ${segment.riskFactors.heightRestriction}ft clearance`;
        } 
        // Narrow roads for large vehicles
        else if (segment.riskFactors.roadWidth > 70 && vehicle.length >= 35) {
          type = 'narrow_road';
          description = 'Narrow road with limited maneuvering space';
        } 
        // Turn complexity
        else if (segment.streetName.toLowerCase().includes('turn')) {
          type = 'turn';
          description = 'Complex turn requiring careful navigation';
        }
        // High pedestrian areas
        else if (segment.riskFactors.pedestrianTraffic > 80) {
          type = 'intersection';
          description = 'High pedestrian traffic area';
        } 
        else {
          description = 'High-risk navigation point';
        }

        criticalPoints.push({
          segmentId: segment.id,
          type,
          riskLevel: riskScore > 80 ? 'critical' : 'high',
          description,
          position: index
        });
      }
    });

    return criticalPoints;
  }

  private metersToMiles(meters: number): number {
    return Math.round((meters * 0.000621371) * 10) / 10;
  }
}