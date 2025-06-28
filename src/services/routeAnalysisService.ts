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
    try {
      // Ensure Google Maps is initialized
      await this.googleMapsService.initialize();

      // Test geocoding for both addresses first
      try {
        await this.googleMapsService.geocodeAddress(request.origin);
      } catch (error) {
        throw new Error(`Origin address not found: "${request.origin}". Please try a more specific address with city and state.`);
      }

      try {
        await this.googleMapsService.geocodeAddress(request.destination);
      } catch (error) {
        throw new Error(`Destination address not found: "${request.destination}". Please try a more specific address with city and state.`);
      }

      // Get routes from Google Maps
      const routeResponse = await this.googleMapsService.getRoutes({
        origin: request.origin,
        destination: request.destination,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: request.avoidHighways,
        avoidTolls: request.avoidTolls
      });

      // Convert Google Maps routes to our Route format
      const routes = await Promise.all(
        routeResponse.routes.map((googleRoute, index) =>
          this.convertGoogleRouteToRoute(googleRoute, index, request.vehicle)
        )
      );

      // Use enhanced route comparison
      const routesWithAnalysis = RiskCalculator.compareRoutes(routes, request.vehicle);
      const recommendedRouteId = routesWithAnalysis[0]?.id || '';

      return {
        routes: routesWithAnalysis,
        recommendedRouteId
      };
    } catch (error) {
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('NOT_FOUND')) {
          throw new Error(`Address not found. Please check your addresses and try again:\n• Origin: "${request.origin}"\n• Destination: "${request.destination}"\n\nTip: Use complete addresses with city and state.`);
        } else if (error.message.includes('ZERO_RESULTS')) {
          throw new Error(`No route found between these locations:\n• From: "${request.origin}"\n• To: "${request.destination}"\n\nPlease check if both locations are accessible by road.`);
        } else if (error.message.includes('OVER_QUERY_LIMIT')) {
          throw new Error('Too many requests to Google Maps. Please wait a moment and try again.');
        } else if (error.message.includes('REQUEST_DENIED')) {
          throw new Error('Google Maps API request denied. Please check your API key configuration and ensure the following APIs are enabled:\n• Maps JavaScript API\n• Directions API\n• Geocoding API\n• Places API');
        }
      }
      
      throw error;
    }
  }

  private async convertGoogleRouteToRoute(
    googleRoute: google.maps.DirectionsRoute,
    index: number,
    vehicle: Vehicle
  ): Promise<Route> {
    const routeId = `route-${index + 1}`;
    const routeName = this.generateRouteName(googleRoute, index);
    
    // Extract basic route info
    const leg = googleRoute.legs[0];
    const totalDistance = this.metersToMiles(leg.distance?.value || 0);
    const estimatedTime = Math.round((leg.duration?.value || 0) / 60);

    // Create segments from route steps with enhanced analysis
    const segments = await this.createSegmentsFromSteps(
      googleRoute.legs[0].steps,
      routeId,
      vehicle
    );

    // Identify critical points with enhanced detection
    const criticalPoints = this.identifyCriticalPoints(segments, vehicle);

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
    
    // Fallback names
    const names = [
      'Main Route',
      'Highway Route', 
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