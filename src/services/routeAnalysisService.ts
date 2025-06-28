import { GoogleMapsService, RoadData } from './googleMapsService';
import { Route, RouteSegment, CriticalPoint, Vehicle } from '../types';
import { RiskCalculator } from '../utils/riskCalculator';

export interface RouteAnalysisRequest {
  origin: string;
  destination: string;
  vehicle: Vehicle;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
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
    console.log('Starting route analysis for:', request.origin, '→', request.destination);
    
    try {
      // Ensure Google Maps is initialized
      await this.googleMapsService.initialize();
      console.log('Google Maps service initialized');

      // Test geocoding for both addresses first with better error handling
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

      // Check if addresses are in reasonable proximity (within Louisiana and surrounding states)
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

      console.log('Both addresses validated, requesting directions...');

      // Get routes from Google Maps with enhanced error handling
      const routeResponse = await this.googleMapsService.getRoutes({
        origin: request.origin,
        destination: request.destination,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: request.avoidHighways,
        avoidTolls: request.avoidTolls
      });

      console.log('Google Maps returned', routeResponse.routes.length, 'routes');

      if (!routeResponse.routes || routeResponse.routes.length === 0) {
        throw new Error(`No routes found between:\n• From: "${request.origin}"\n• To: "${request.destination}"\n\nPlease verify both locations are accessible by road.`);
      }

      // Convert Google Maps routes to our Route format
      const routes = await Promise.all(
        routeResponse.routes.map((googleRoute, index) =>
          this.convertGoogleRouteToRoute(googleRoute, index, request.vehicle)
        )
      );

      console.log('Converted', routes.length, 'routes, calculating risk analysis...');

      // Use enhanced route comparison
      const routesWithAnalysis = RiskCalculator.compareRoutes(routes, request.vehicle);
      const recommendedRouteId = routesWithAnalysis[0]?.id || '';

      console.log('Route analysis complete, recommended route:', recommendedRouteId);

      return {
        routes: routesWithAnalysis,
        recommendedRouteId
      };
    } catch (error) {
      console.error('Route analysis error:', error);
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('NOT_FOUND')) {
          throw new Error(`Address not found. Please check your addresses:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"\n\nTip: Include city and state for better results.`);
        } else if (error.message.includes('ZERO_RESULTS')) {
          throw new Error(`No route found between these locations:\n• From: "${request.origin}"\n• To: "${request.destination}"\n\nPlease verify both locations are accessible by road.`);
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
    vehicle: Vehicle
  ): Promise<Route> {
    const routeId = `route-${index + 1}`;
    const routeName = this.generateRouteName(googleRoute, index);
    
    console.log(`Converting route ${index + 1}: ${routeName}`);
    
    // Extract basic route info
    const leg = googleRoute.legs[0];
    const totalDistance = this.metersToMiles(leg.distance?.value || 0);
    const estimatedTime = Math.round((leg.duration?.value || 0) / 60);

    console.log(`Route ${index + 1} - Distance: ${totalDistance}mi, Time: ${estimatedTime}min`);
    console.log(`Route ${index + 1} - Start: ${leg.start_address}`);
    console.log(`Route ${index + 1} - End: ${leg.end_address}`);

    // Create segments from route steps with enhanced analysis
    const segments = await this.createSegmentsFromSteps(
      googleRoute.legs[0].steps,
      routeId,
      vehicle
    );

    console.log(`Created ${segments.length} segments for route ${index + 1}`);

    // Identify critical points with enhanced detection
    const criticalPoints = this.identifyCriticalPoints(segments, vehicle);

    console.log(`Identified ${criticalPoints.length} critical points for route ${index + 1}`);

    return {
      id: routeId,
      name: routeName,
      segments,
      totalDistance,
      estimatedTime,
      overallRisk: 0, // Will be calculated by RiskCalculator
      criticalPoints
    };
  }

  private generateRouteName(googleRoute: google.maps.DirectionsRoute, index: number): string {
    const summary = googleRoute.summary;
    if (summary && summary.trim()) {
      return summary;
    }
    
    // Try to extract main roads from the route
    const leg = googleRoute.legs[0];
    if (leg && leg.steps && leg.steps.length > 0) {
      const mainRoads = leg.steps
        .map(step => this.extractStreetName(step.instructions))
        .filter(name => name && !name.includes('Unknown'))
        .slice(0, 2);
      
      if (mainRoads.length > 0) {
        return `via ${mainRoads.join(' & ')}`;
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

  private async createSegmentsFromSteps(
    steps: google.maps.DirectionsStep[],
    routeId: string,
    vehicle: Vehicle
  ): Promise<RouteSegment[]> {
    const segments: RouteSegment[] = [];

    console.log(`Processing ${steps.length} steps for route segments`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const startLocation = step.start_location;
      const endLocation = step.end_location;

      // Get road data for this segment
      const roadData = await this.googleMapsService.getRoadData(
        startLocation.lat(),
        startLocation.lng()
      );

      // Extract street name from instructions
      const streetName = this.extractStreetName(step.instructions);
      
      // Enhanced risk factor calculation
      const riskFactors = this.calculateEnhancedRiskFactors(step, roadData, vehicle);
      
      const segment: RouteSegment = {
        id: `${routeId}-seg-${i + 1}`,
        startLat: startLocation.lat(),
        startLng: startLocation.lng(),
        endLat: endLocation.lat(),
        endLng: endLocation.lng(),
        streetName,
        riskScore: 0, // Will be calculated by RiskCalculator
        riskFactors,
        description: this.generateEnhancedSegmentDescription(step, roadData, riskFactors, vehicle)
      };

      segments.push(segment);
    }

    console.log(`Created ${segments.length} segments`);
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
    // Remove HTML tags and extract street name
    const cleanInstructions = instructions.replace(/<[^>]*>/g, '');
    
    // Common patterns to extract street names
    const patterns = [
      /on (.+?)(?:\s|$)/i,
      /onto (.+?)(?:\s|$)/i,
      /via (.+?)(?:\s|$)/i,
      /toward (.+?)(?:\s|$)/i,
      /continue on (.+?)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = cleanInstructions.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: use first few words of instructions
    const words = cleanInstructions.split(' ').slice(0, 3);
    return words.join(' ') || 'Unknown Street';
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

  private generateEnhancedSegmentDescription(
    step: google.maps.DirectionsStep,
    roadData: RoadData,
    riskFactors: any,
    vehicle: Vehicle
  ): string {
    const factors = [];
    const instructions = step.instructions.toLowerCase();
    
    // Analyze turn complexity for buses
    if (vehicle.length >= 35 && (instructions.includes('turn') || instructions.includes('onto'))) {
      if (instructions.includes('sharp') || riskFactors.roadWidth > 70) {
        factors.push('challenging turn for large vehicle');
      } else {
        factors.push('moderate turn');
      }
    }
    
    if (riskFactors.pedestrianTraffic > 70) {
      factors.push('heavy pedestrian activity');
    }
    
    if (riskFactors.roadWidth > 60) {
      factors.push('narrow road conditions');
    }
    
    if (riskFactors.trafficCongestion > 70) {
      factors.push('heavy traffic congestion');
    }
    
    if (roadData.heightRestrictions && roadData.heightRestrictions > 0) {
      factors.push(`${roadData.heightRestrictions}ft height limit`);
    }

    if (factors.length === 0) {
      return 'Standard road conditions';
    }

    return factors.join(', ');
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
}