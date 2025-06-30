import { GoogleMapsService, RoadData } from './googleMapsService';
import { Route, RouteSegment, CriticalPoint, Vehicle, StopLocation, TruckRouteRestriction } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';
import { USTruckRoutingService } from './usTruckRoutingService';

export interface RouteAnalysisRequest {
  origin: string;
  destination: string;
  vehicle: Vehicle;
  stops?: StopLocation[];
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  isLoop?: boolean; // Added for loop route functionality
}

export interface RouteAnalysisResult {
  routes: Route[];
  recommendedRouteId: string;
}

export interface EnhancedRouteAnalysisResult extends RouteAnalysisResult {
  complianceAnalysis: {
    compliant: boolean;
    violations: TruckRouteRestriction[];
    recommendations: string[];
    nationalNetworkCoverage: number;
  };
}

export class RouteAnalysisService {
  private googleMapsService: GoogleMapsService;

  constructor() {
    this.googleMapsService = GoogleMapsService.getInstance();
  }

  public async analyzeRoutes(request: RouteAnalysisRequest): Promise<RouteAnalysisResult> {
    console.log('🚦 Starting route analysis with live traffic data...');
    
    try {
      // Ensure Google Maps is initialized
      await this.googleMapsService.initialize();
      console.log('Google Maps service initialized');

      // Test geocoding for origin and destination first
      let originValid = false;
      let destinationValid = false;
      let originResults: google.maps.GeocoderResult[] = [];
      let destinationResults: google.maps.GeocoderResult[] = [];
      
      try {
        originResults = await this.googleMapsService.geocodeAddress(request.origin);
        console.log('Origin geocoding results:', originResults.length, 'results found');
        originValid = originResults.length > 0;
        
        if (originResults.length > 0) {
          const location = originResults[0].geometry.location;
          console.log('Origin location:', originResults[0].formatted_address, `(${location.lat()}, ${location.lng()})`);
        }
      } catch (error) {
        console.error('Origin geocoding failed:', error);
        throw new Error(`Origin address not found: "${request.origin}"\n\nPlease try:\n• Adding city and state (e.g., "123 Main St, Lafayette, LA")\n• Using a more specific address\n• Checking for typos`);
      }

      try {
        destinationResults = await this.googleMapsService.geocodeAddress(request.destination);
        console.log('Destination geocoding results:', destinationResults.length, 'results found');
        destinationValid = destinationResults.length > 0;
        
        if (destinationResults.length > 0) {
          const location = destinationResults[0].geometry.location;
          console.log('Destination location:', destinationResults[0].formatted_address, `(${location.lat()}, ${location.lng()})`);
        }
      } catch (error) {
        console.error('Destination geocoding failed:', error);
        throw new Error(`Destination address not found: "${request.destination}"\n\nPlease try:\n• Adding city and state (e.g., "456 Oak Ave, Opelousas, LA")\n• Using a more specific address\n• Checking for typos`);
      }

      if (!originValid || !destinationValid) {
        throw new Error('One or both addresses could not be found. Please check your addresses and try again.');
      }

      // Validate stop locations if provided
      if (request.stops && request.stops.length > 0) {
        console.log('Validating stop locations...');
        for (const stop of request.stops) {
          try {
            const stopResults = await this.googleMapsService.geocodeAddress(stop.address);
            if (stopResults.length === 0) {
              throw new Error(`Stop location not found: "${stop.address}"`);
            }
            console.log('Stop validated:', stopResults[0].formatted_address);
          } catch (error) {
            console.error('Stop geocoding failed:', error);
            throw new Error(`Stop location not found: "${stop.address}"\n\nPlease check the address and try again.`);
          }
        }
      }

      // Check if addresses are in reasonable proximity
      if (originResults.length > 0 && destinationResults.length > 0) {
        const originLoc = originResults[0].geometry.location;
        const destLoc = destinationResults[0].geometry.location;
        
        // Calculate distance between the two points
        const distance = this.calculateDistance(
          originLoc.lat(), originLoc.lng(),
          destLoc.lat(), destLoc.lng()
        );
        
        console.log('Distance between addresses:', distance, 'miles');
        
        // If distance is very large, warn the user
        if (distance > 300) {
          throw new Error(`The addresses appear to be ${Math.round(distance)} miles apart. Please verify:\n• Origin: "${originResults[0].formatted_address}"\n• Destination: "${destinationResults[0].formatted_address}"\n\nIf this is correct, the route analysis will proceed. If not, please check your addresses.`);
        }
      }

      console.log('All addresses validated, requesting directions...');

      // Prepare waypoints from stops
      const waypoints = request.stops?.map(stop => stop.address) || [];
      console.log('Prepared waypoints for Google Maps:', waypoints);

      let allGoogleRoutes: google.maps.DirectionsRoute[] = [];

      if (request.isLoop) {
        console.log('🔄 Loop route requested. Fetching outbound and return legs.');
        // Outbound journey
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
          throw new Error(`No outbound route found from "${request.origin}" to "${request.destination}".`);
        }

        // Return journey (destination back to origin)
        const returnResponse = await this.googleMapsService.getRoutes({
          origin: request.destination,
          destination: request.origin,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: request.avoidHighways,
          avoidTolls: request.avoidTolls,
          departureTime: new Date()
        });

        if (!returnResponse.routes || returnResponse.routes.length === 0) {
          throw new Error(`No return route found from "${request.destination}" to "${request.origin}".`);
        }

        // Combine the best outbound and best return route into a single loop route
        const combinedRoute = this.combineRoutes(outboundResponse.routes[0], returnResponse.routes[0]);
        allGoogleRoutes.push(combinedRoute);
        console.log('Combined outbound and return routes for loop.');

      } else {
        // Standard one-way route
        const routeResponse = await this.googleMapsService.getRoutes({
          origin: request.origin,
          destination: request.destination,
          waypoints: waypoints.length > 0 ? waypoints : undefined,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: request.avoidHighways,
          avoidTolls: request.avoidTolls,
          departureTime: new Date() // 🚦 REQUEST LIVE TRAFFIC
        });

        if (!routeResponse.routes || routeResponse.routes.length === 0) {
          let errorMessage = `No routes found between:\n• From: "${request.origin}"\n• To: "${request.destination}"`;
          if (waypoints.length > 0) {
            errorMessage += `\n• Via: ${waypoints.join(', ')}`;
          }
          errorMessage += '\n\nPlease verify all locations are accessible by road.';
          throw new Error(errorMessage);
        }
        allGoogleRoutes = routeResponse.routes;
      }

      console.log('📊 Google Maps returned', allGoogleRoutes.length, 'routes with traffic data');

      // Convert Google Maps routes to our Route format
      let routes = await Promise.all(
        allGoogleRoutes.map((googleRoute, index) =>
          this.convertGoogleRouteToRoute(googleRoute, index, request.vehicle, request.stops)
        )
      );

      console.log('Converted', routes.length, 'routes, calculating risk analysis...');

      // Calculate overall risk for each route
      routes = routes.map(route => ({
        ...route,
        overallRisk: RiskCalculator.calculateRouteRisk(route, request.vehicle)
      }));

      // Sort routes by overall risk (lowest risk first)
      routes.sort((a, b) => a.overallRisk - b.overallRisk);

      // Ensure at least 2 routes are returned if possible, and select top 3 safest
      const finalRoutes = routes.slice(0, Math.max(2, Math.min(3, routes.length)));
      
      const recommendedRouteId = finalRoutes[0]?.id || '';

      console.log('Route analysis complete, recommended route:', recommendedRouteId);

      return {
        routes: finalRoutes,
        recommendedRouteId
      };
    } catch (error) {
      console.error('Route analysis error:', error);
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('NOT_FOUND')) {
          throw new Error(`Address not found. Please check your addresses:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"\n\nTip: Include city and state for better results.`);
        } else if (error.message.includes('ZERO_RESULTS')) {
          throw new Error(`No route found between these locations:\n• From: "${request.origin}"\n• To: "${request.destination}"\n\nPlease verify all locations are accessible by road.`);
        } else if (error.message.includes('OVER_QUERY_LIMIT')) {
          throw new Error('Google Maps API limit reached. Please wait a moment and try again.');
        } else if (error.message.includes('REQUEST_DENIED')) {
          throw new Error('Google Maps API access denied. Please check your API key configuration.');
        } else if (error.message.includes('API key')) {
          throw new Error('Google Maps API key is missing or invalid. Please check your configuration.');
        }
        
        // If it's already a formatted error message, pass it through
        throw error;
      }
      
      throw new Error('Route analysis failed. Please check your addresses and try again.');
    }
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

  private async convertGoogleRouteToRoute(
    googleRoute: google.maps.DirectionsRoute,
    index: number,
    vehicle: Vehicle,
    stops?: StopLocation[]
  ): Promise<Route> {
    const routeId = `route-${index + 1}`;
    const routeName = this.generateRouteName(googleRoute, index, stops);
    
    console.log(`Converting route ${index + 1}: ${routeName}`);
    
    // Extract basic route info - sum all legs for total distance and time
    const totalDistance = googleRoute.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
    const totalDuration = googleRoute.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
    
    const totalDistanceMiles = this.metersToMiles(totalDistance);
    const estimatedTimeMinutes = Math.round(totalDuration / 60);

    // Add stop time if stops are provided
    const stopTime = stops ? stops.reduce((sum, stop) => sum + (stop.estimatedStopTime || 0), 0) : 0;
    const totalTimeWithStops = estimatedTimeMinutes + stopTime;

    console.log(`Route ${index + 1} - Distance: ${totalDistanceMiles}mi, Time: ${estimatedTimeMinutes}min (${totalTimeWithStops}min with stops)`);
    console.log(`Route ${index + 1} - Start: ${googleRoute.legs[0].start_address}`);
    console.log(`Route ${index + 1} - End: ${googleRoute.legs[googleRoute.legs.length - 1].end_address}`);

    // Create segments from all route legs
    const segments = await this.createSegmentsFromLegs(
      googleRoute.legs,
      routeId,
      vehicle
    );

    console.log(`Created ${segments.length} segments for route ${index + 1}`);

    // Identify critical points with enhanced detection
    const criticalPoints = this.identifyCriticalPoints(segments, vehicle);

    console.log(`Identified ${criticalPoints.length} critical points for route ${index + 1}`);

    // Prepare waypoints list for the route
    const waypoints = stops?.map(stop => stop.address) || [];

    return {
      id: routeId,
      name: routeName,
      segments,
      totalDistance: totalDistanceMiles,
      estimatedTime: totalTimeWithStops, // Include stop time in total
      overallRisk: 0, // Will be calculated by RiskCalculator
      criticalPoints,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      stops
    };
  }

  private generateRouteName(googleRoute: google.maps.DirectionsRoute, index: number, stops?: StopLocation[]): string {
    const summary = googleRoute.summary;
    
    // If there are stops, include that in the name
    if (stops && stops.length > 0) {
      const stopCount = stops.length;
      const baseName = summary && summary.trim() ? summary : `Route ${index + 1}`;
      return `${baseName} (${stopCount} stop${stopCount > 1 ? 's' : ''})`;
    }
    
    if (summary && summary.trim()) {
      return summary;
    }
    
    // Try to extract main roads from the route
    if (googleRoute.legs && googleRoute.legs.length > 0) {
      const allSteps = googleRoute.legs.flatMap(leg => leg.steps || []);
      if (allSteps.length > 0) {
        const mainRoads = allSteps
          .map(step => this.extractStreetName(step.instructions))
          .filter(name => name && !name.includes('Unknown'))
          .slice(0, 2);
        
        if (mainRoads.length > 0) {
          return `via ${mainRoads.join(' & ')}`;
        }
      }
    }
    
    // Fallback names
    const names = [
      'Main Route',
      'Alternative Route', 
      'Scenic Route',
      'Express Route',
      'Local Route'
    ];
    
    return names[index] || `Route ${index + 1}`;
  }


  private calculateLiveTrafficCongestion(
    step: google.maps.DirectionsStep, 
    leg: google.maps.DirectionsLeg
  ): number {
    
    // Use live traffic data if available
    if (leg.duration_in_traffic && leg.duration) {
      const normalDuration = leg.duration.value;
      const trafficDuration = leg.duration_in_traffic.value;
      const trafficRatio = trafficDuration / normalDuration;
      
      console.log(`🚦 Live traffic ratio: ${trafficRatio.toFixed(2)} (${leg.duration.text} → ${leg.duration_in_traffic.text})`);
      
      // Convert ratio to congestion percentage
      if (trafficRatio <= 1.1) return 10;  // Light traffic
      if (trafficRatio <= 1.3) return 30;  // Moderate traffic  
      if (trafficRatio <= 1.7) return 60;  // Heavy traffic
      if (trafficRatio <= 2.0) return 80;  // Very heavy traffic
      return 95; // Severe congestion
    }
    
    // Fallback to speed-based estimation
    return this.estimateTrafficCongestion(step);
  }

  private async createSegmentsFromLegs(
    legs: google.maps.DirectionsLeg[],
    routeId: string,
    vehicle: Vehicle
  ): Promise<RouteSegment[]> {
    const segments: RouteSegment[] = [];
    let segmentCounter = 0;

    console.log(`🚦 Processing ${legs.length} legs with live traffic data`);

    for (const leg of legs) {
      const steps = leg.steps || [];
      console.log(`Processing ${steps.length} steps in leg with traffic data`);

      // Log live traffic information for this leg
      if (leg.duration_in_traffic) {
        const delay = leg.duration_in_traffic.value - leg.duration!.value;
        console.log(`🚦 Leg traffic delay: ${Math.round(delay / 60)} minutes`);
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const startLocation = step.start_location;
        const endLocation = step.end_location;

        // Get enhanced road data with live traffic
        const roadData = await this.googleMapsService.getEnhancedRoadData(
          startLocation.lat(),
          startLocation.lng()
        );

        const streetName = this.extractStreetName(step.instructions);
        
        // Use live traffic data for risk calculation
        const riskFactors = {
          pedestrianTraffic: roadData.pedestrianTraffic || 30,
          roadWidth: roadData.roadWidth || 40,
          trafficCongestion: this.calculateLiveTrafficCongestion(step, leg), // 🚦 LIVE DATA
          speedLimit: roadData.speedLimit || 35,
          heightRestriction: roadData.heightRestrictions || 0
        };

        const segment: RouteSegment = {
          id: `${routeId}-seg-${segmentCounter + 1}`,
          startLat: startLocation.lat(),
          startLng: startLocation.lng(),
          endLat: endLocation.lng(),
          endLng: endLocation.lng(),
          streetName,
          riskScore: 0,
          riskFactors,
          description: this.generateEnhancedSegmentDescription(step, roadData, riskFactors, vehicle),
          liveTrafficData: roadData.liveTraffic // 🚦 NEW: Include live traffic info
        };

        segments.push(segment);
        segmentCounter++;
      }
    }

    console.log(`✅ Created ${segments.length} segments with live traffic analysis`);
    return segments;
  }

  private calculateEnhancedRiskFactors(
    step: google.maps.DirectionsStep,
    roadData: RoadData,
    vehicle: Vehicle
  ) {
    const baseFactors = {
      pedestrianTraffic: roadData.pedestrianTraffic || 30,
      roadWidth: roadData.roadWidth || 40,
      trafficCongestion: this.estimateTrafficCongestion(step),
      speedLimit: roadData.speedLimit || 35,
      heightRestriction: roadData.heightRestrictions || 0
    };

    // Enhance factors based on step instructions and vehicle type
    const instructions = step.instructions.toLowerCase();
    
    // Detect turns and adjust road width risk
    if (instructions.includes('turn') || instructions.includes('onto')) {
      baseFactors.roadWidth += 20; // Turns are more challenging
      
      // Sharp turns are especially difficult for buses
      if ((instructions.includes('sharp') || instructions.includes('right') || instructions.includes('left')) && 
          vehicle.length >= 35) {
        baseFactors.roadWidth += 30;
      }
    }

    // Detect intersections
    if (instructions.includes('intersection') || instructions.includes('cross')) {
      baseFactors.pedestrianTraffic += 25;
    }

    // Detect highway vs local roads
    if (instructions.includes('highway') || instructions.includes('freeway') || instructions.includes('interstate')) {
      baseFactors.pedestrianTraffic = Math.max(baseFactors.pedestrianTraffic - 40, 0);
      baseFactors.roadWidth = Math.max(baseFactors.roadWidth - 30, 10);
    }

    // Detect residential areas
    if (instructions.includes('residential') || instructions.includes('neighborhood')) {
      baseFactors.pedestrianTraffic += 20;
      baseFactors.roadWidth += 15;
    }

    // Detect school zones or similar
    if (instructions.includes('school') || instructions.includes('park')) {
      baseFactors.pedestrianTraffic += 40;
    }

    // Clamp all values to 0-100 range
    Object.keys(baseFactors).forEach(key => {
      baseFactors[key as keyof typeof baseFactors] = Math.min(Math.max(baseFactors[key as keyof typeof baseFactors], 0), 100);
    });

    return baseFactors;
  }

private extractStreetName(instructions: string): string {
  // Remove HTML tags first
  const cleanInstructions = instructions.replace(/<[^>]*>/g, '');
  
  // Enhanced patterns to extract street names with better context
  const patterns = [
    // "Turn right onto Main Street" -> "Main Street"
    /(?:turn|continue).*?(?:onto|on)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    // "Head north on Highway 90" -> "Highway 90" 
    /head\s+\w+\s+on\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    // "Take the ramp onto I-10 W" -> "I-10 W"
    /take.*?(?:ramp|exit).*?(?:onto|toward)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    // "Continue on I-49 S" -> "I-49 S"
    /continue\s+on\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    // "Merge onto US-167 N" -> "US-167 N"
    /merge\s+onto\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    // "Keep right to stay on I-10" -> "I-10"
    /keep.*?(?:stay\s+on|on)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
    // General fallback patterns
    /(?:on|onto|via|toward)\s+(.+?)(?:\s+(?:toward|for|until|\.|,)|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanInstructions.match(pattern);
    if (match && match[1]) {
      let streetName = match[1].trim();
      
      // Clean up common suffixes that aren't part of the street name
      streetName = streetName.replace(/\s+(?:toward|for|until|in|at).*$/i, '');
      
      // Clean up extra whitespace
      streetName = streetName.replace(/\s+/g, ' ').trim();
      
      // If we got a reasonable street name, return it
      if (streetName.length > 1 && streetName.length < 50) {
        return this.formatStreetName(streetName);
      }
    }
  }

  // Last resort: try to extract something meaningful from the instructions
  const meaningfulWords = cleanInstructions
    .split(' ')
    .filter(word => 
      word.length > 2 && 
      !['the', 'and', 'turn', 'head', 'continue', 'toward', 'then', 'take'].includes(word.toLowerCase())
    )
    .slice(0, 3)
    .join(' ');

  return meaningfulWords || 'Local Street';
}

  private estimateTrafficCongestion(step: google.maps.DirectionsStep): number {
    // Estimate traffic based on duration vs distance
    const distance = step.distance?.value || 1;
    const duration = step.duration?.value || 1;
    const speed = (distance / 1609.34) / (duration / 3600); // mph

    // Lower speeds indicate higher congestion
    if (speed < 10) return 90;
    if (speed < 15) return 80;
    if (speed < 25) return 60;
    if (speed < 35) return 40;
    if (speed < 45) return 25;
    return 15;
  }

private formatStreetName(streetName: string): string {
  // Handle common abbreviations and formatting
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

  private generateEnhancedSegmentDescription(
    step: google.maps.DirectionsStep,
    roadData: RoadData,
    riskFactors: { pedestrianTraffic: number; roadWidth: number; trafficCongestion: number; speedLimit: number; heightRestriction: number; },
    vehicle: Vehicle
  ): string {
  const descriptions = [];
  const instructions = step.instructions.toLowerCase();
  const distance = step.distance?.value || 0;
  const duration = step.duration?.value || 0;
  const distanceMiles = Math.round((distance / 1609.34) * 10) / 10; // Round to 1 decimal

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

  // Add distance info for longer segments
  if (distanceMiles >= 0.5) {
    movementType += ` for ${distanceMiles} mile${distanceMiles !== 1 ? 's' : ''}`;
  }

  descriptions.push(movementType);

  // Road type context
  if (instructions.includes('highway') || instructions.includes('interstate') || instructions.includes('freeway')) {
    descriptions.push('highway conditions');
  } else if (instructions.includes('residential') || riskFactors.pedestrianTraffic > 50) {
    descriptions.push('residential area');
  } else if (instructions.includes('downtown') || instructions.includes('business')) {
    descriptions.push('commercial district');
  }

  // Traffic and congestion info
  const avgSpeed = distanceMiles / (duration / 3600); // mph
  if (riskFactors.trafficCongestion > 75 || avgSpeed < 15) {
    descriptions.push('heavy traffic expected');
  } else if (riskFactors.trafficCongestion > 50 || avgSpeed < 25) {
    descriptions.push('moderate traffic');
  } else if (avgSpeed > 45) {
    descriptions.push('free-flowing traffic');
  }

  // Vehicle-specific concerns
  if (vehicle.length >= 35) { // Large vehicle
    if (instructions.includes('turn') && riskFactors.roadWidth > 60) {
      descriptions.push('⚠️ tight turn for large vehicle');
    }
    if (instructions.includes('roundabout')) {
      descriptions.push('⚠️ large vehicle roundabout navigation');
    }
  }

  // Pedestrian activity
  if (riskFactors.pedestrianTraffic > 70) {
    descriptions.push('⚠️ high pedestrian activity');
  } else if (riskFactors.pedestrianTraffic > 40) {
    descriptions.push('moderate pedestrian activity');
  }

  // Road width concerns
  if (riskFactors.roadWidth > 70) {
    descriptions.push('⚠️ narrow road conditions');
  } else if (riskFactors.roadWidth > 50) {
    descriptions.push('somewhat narrow road');
  }

  // Height restrictions
  if (roadData.heightRestrictions && roadData.heightRestrictions > 0) {
    const clearance = roadData.heightRestrictions;
    if (clearance <= vehicle.height + 1) {
      descriptions.push(`🚨 CRITICAL: ${clearance}ft height limit (vehicle: ${vehicle.height}ft)`);
    } else if (clearance <= vehicle.height + 2) {
      descriptions.push(`⚠️ Low clearance: ${clearance}ft height limit`);
    } else {
      descriptions.push(`Height limit: ${clearance}ft`);
    }
  }

  // Speed considerations
  if (riskFactors.speedLimit <= 25) {
    descriptions.push('low speed zone');
  } else if (riskFactors.speedLimit >= 55) {
    descriptions.push('high speed zone');
  }

  // Special area detection
  if (instructions.includes('school')) {
    descriptions.push('⚠️ school zone - reduced speed');
  }
  if (instructions.includes('construction')) {
    descriptions.push('⚠️ construction zone');
  }
  if (instructions.includes('bridge')) {
    descriptions.push('bridge crossing');
  }

  // Default fallback
  if (descriptions.length === 1 && descriptions[0] === movementType) {
    descriptions.push('standard road conditions');
  }

  return descriptions.join(' • ');
}

  private identifyCriticalPoints(segments: RouteSegment[], vehicle: Vehicle): CriticalPoint[] {
    const criticalPoints: CriticalPoint[] = [];

    segments.forEach((segment, index) => {
      const riskScore = RiskCalculator.calculateSegmentRisk(segment, vehicle);
      const detailedRisk = RiskCalculator.calculateDetailedRisk(segment, vehicle);
      
      // Enhanced critical point detection
      if (riskScore > 60 || detailedRisk.primaryConcerns.length > 0) {
        let type: CriticalPoint['type'] = 'intersection';
        let description = '';

        // Height restrictions are always critical
        if (segment.riskFactors.heightRestriction > 0 && 
            segment.riskFactors.heightRestriction <= vehicle.height + 1) {
          type = 'bridge';
          description = `Height restriction: ${segment.riskFactors.heightRestriction}ft clearance (Vehicle: ${vehicle.height}ft)`;
        } 
        // Narrow roads for large vehicles
        else if (segment.riskFactors.roadWidth > 70 && vehicle.length >= 35) {
          type = 'narrow_road';
          description = 'Narrow road with limited maneuvering space for large vehicle';
        } 
        // Turn complexity for buses
        else if (vehicle.length >= 35 && segment.streetName.toLowerCase().includes('turn')) {
          type = 'turn';
          const turnAnalysis = RiskCalculator.analyzeTurn(segment, vehicle);
          description = `${turnAnalysis.difficulty.replace('_', ' ')} turn - ${Math.round(turnAnalysis.angle)}° angle, ${Math.round(turnAnalysis.clearanceRequired)}ft clearance needed`;
        }
        // High pedestrian areas
        else if (segment.riskFactors.pedestrianTraffic > 80) {
          type = 'intersection';
          description = 'High pedestrian traffic area with crossing activity';
        } 
        // General high-risk area
        else {
          type = 'intersection';
          description = detailedRisk.primaryConcerns[0] || 'High-risk navigation point';
        }

        criticalPoints.push({
          segmentId: segment.id,
          type,
          riskLevel: riskScore > 80 ? 'critical' : 'high',
          description: `${description}`,
          position: index
        });
      }
    });

    return criticalPoints;
  }

  private metersToMiles(meters: number): number {
    return Math.round((meters * 0.000621371) * 10) / 10;
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

    // Combine copyrights (if any)
    const combinedCopyrights = [...outboundRoute.copyrights, ...returnRoute.copyrights];

    // Combine warnings (if any)
    const combinedWarnings = [...outboundRoute.warnings, ...returnRoute.warnings];

    // Combine overview polyline
    const combinedOverviewPath = [
      ...(outboundRoute.overview_path || []),
      ...(returnRoute.overview_path || [])
    ];
    const combinedOverviewPolyline = new google.maps.Polyline({ path: combinedOverviewPath });

    // Create a new DirectionsRoute object
    const combinedDirectionsRoute: google.maps.DirectionsRoute = {
      legs: combinedLegs,
      bounds: combinedBounds,
      copyrights: combinedCopyrights,
      warnings: combinedWarnings,
      overview_polyline: { points: google.maps.geometry.encoding.encodePath(combinedOverviewPath) },
      fare: outboundRoute.fare || returnRoute.fare, // Take fare from either, if available
      summary: `Loop: ${outboundRoute.summary || ''} & ${returnRoute.summary || ''}` // Custom summary
    };

    return combinedDirectionsRoute;
  }
}

export class EnhancedRouteAnalysisService extends RouteAnalysisService {
  private usTruckRoutingService: USTruckRoutingService;

  constructor() {
    super();
    this.usTruckRoutingService = USTruckRoutingService.getInstance();
  }

  public async analyzeRoutes(request: RouteAnalysisRequest): Promise<EnhancedRouteAnalysisResult> {
    console.log('🏛️ Starting enhanced route analysis with government compliance...');
    
    // Run standard route analysis first
    const standardResult = await super.analyzeRoutes(request);
    
    // Add government compliance analysis
    const routesWithCompliance = await Promise.all(
      standardResult.routes.map(async route => {
        const complianceAnalysis = this.usTruckRoutingService.evaluateRouteCompliance(
          route.segments.map(seg => ({
            streetName: seg.streetName,
            startLat: seg.startLat,
            startLng: seg.startLng
          })),
          request.vehicle
        );

        return {
          ...route,
          complianceAnalysis,
          // Adjust risk score based on compliance
          overallRisk: this.adjustRiskForCompliance(route.overallRisk, complianceAnalysis)
        };
      })
    );

    // Sort routes prioritizing compliant routes
    const sortedRoutes = routesWithCompliance.sort((a, b) => {
      // Non-compliant routes go to bottom
      if (!a.complianceAnalysis.compliant && b.complianceAnalysis.compliant) return 1;
      if (a.complianceAnalysis.compliant && !b.complianceAnalysis.compliant) return -1;
      
      // Among compliant routes, sort by risk
      return a.overallRisk - b.overallRisk;
    });

    // Select recommended route (first compliant route)
    const recommendedRoute = sortedRoutes.find(r => r.complianceAnalysis.compliant) || sortedRoutes[0];

    return {
      ...standardResult,
      routes: sortedRoutes,
      recommendedRouteId: recommendedRoute.id,
      complianceAnalysis: recommendedRoute.complianceAnalysis
    };
  }

  private adjustRiskForCompliance(
    baseRisk: number, 
    compliance: { compliant: boolean; violations: TruckRouteRestriction[]; nationalNetworkCoverage: number }
  ): number {
    let adjustedRisk = baseRisk;
    
    // Severe penalty for non-compliant routes
    if (!compliance.compliant) {
      const prohibitions = compliance.violations.filter(v => v.severity === 'prohibition').length;
      adjustedRisk += prohibitions * 30; // +30% risk per prohibition
    }
    
    // Bonus for high National Network coverage
    if (compliance.nationalNetworkCoverage >= 80) {
      adjustedRisk -= 15; // -15% risk for good coverage
    } else if (compliance.nationalNetworkCoverage < 50) {
      adjustedRisk += 10; // +10% risk for poor coverage
    }
    
    // Height/weight restriction penalties
    const criticalViolations = compliance.violations.filter(v => 
      v.type === 'height' || v.type === 'weight'
    ).length;
    adjustedRisk += criticalViolations * 20; // +20% risk per critical violation

    return Math.min(Math.max(adjustedRisk, 0), 100);
  }
}
