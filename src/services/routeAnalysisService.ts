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

      // Calculate risk scores for all routes
      const routesWithRisk = routes.map(route => ({
        ...route,
        overallRisk: RiskCalculator.calculateRouteRisk(route, request.vehicle)
      }));

      // Sort by risk (lowest first) and select recommended route
      routesWithRisk.sort((a, b) => a.overallRisk - b.overallRisk);
      const recommendedRouteId = routesWithRisk[0]?.id || '';

      return {
        routes: routesWithRisk,
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

    // Create segments from route steps
    const segments = await this.createSegmentsFromSteps(
      googleRoute.legs[0].steps,
      routeId
    );

    // Identify critical points
    const criticalPoints = this.identifyCriticalPoints(segments, vehicle);

    return {
      id: routeId,
      name: routeName,
      segments,
      totalDistance,
      estimatedTime,
      overallRisk: 0, // Will be calculated later
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
    routeId: string
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
      
      const segment: RouteSegment = {
        id: `${routeId}-seg-${i + 1}`,
        startLat: startLocation.lat(),
        startLng: startLocation.lng(),
        endLat: endLocation.lat(),
        endLng: endLocation.lng(),
        streetName,
        riskScore: 0, // Will be calculated by RiskCalculator
        riskFactors: {
          pedestrianTraffic: roadData.pedestrianTraffic || 30,
          roadWidth: roadData.roadWidth || 40,
          trafficCongestion: this.estimateTrafficCongestion(step),
          speedLimit: roadData.speedLimit || 35,
          heightRestriction: roadData.heightRestrictions || 0
        },
        description: this.generateSegmentDescription(step, roadData)
      };

      segments.push(segment);
    }

    return segments;
  }

  private extractStreetName(instructions: string): string {
    // Remove HTML tags and extract street name
    const cleanInstructions = instructions.replace(/<[^>]*>/g, '');
    
    // Common patterns to extract street names
    const patterns = [
      /on (.+?)(?:\s|$)/i,
      /onto (.+?)(?:\s|$)/i,
      /via (.+?)(?:\s|$)/i,
      /toward (.+?)(?:\s|$)/i
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
    if (speed < 15) return 80;
    if (speed < 25) return 60;
    if (speed < 35) return 40;
    return 20;
  }

  private generateSegmentDescription(
    step: google.maps.DirectionsStep,
    roadData: RoadData
  ): string {
    const factors = [];
    
    if ((roadData.pedestrianTraffic || 0) > 70) {
      factors.push('heavy pedestrian activity');
    }
    
    if ((roadData.roadWidth || 0) > 60) {
      factors.push('narrow road');
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
      
      // Identify critical points based on risk factors
      if (riskScore > 70) {
        let type: CriticalPoint['type'] = 'intersection';
        let description = '';

        if (segment.riskFactors.heightRestriction > 0 && 
            segment.riskFactors.heightRestriction <= vehicle.height + 1) {
          type = 'bridge';
          description = `Height restriction: ${segment.riskFactors.heightRestriction}ft clearance`;
        } else if (segment.riskFactors.roadWidth > 60) {
          type = 'narrow_road';
          description = 'Narrow road with limited maneuvering space';
        } else if (segment.riskFactors.pedestrianTraffic > 80) {
          type = 'intersection';
          description = 'High pedestrian traffic area';
        } else {
          type = 'turn';
          description = 'Complex navigation point';
        }

        criticalPoints.push({
          segmentId: segment.id,
          type,
          riskLevel: riskScore > 85 ? 'critical' : 'high',
          description: `Segment ${index + 1}: ${description}`,
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