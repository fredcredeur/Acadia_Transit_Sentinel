import { Vehicle } from '../types';

export interface TruckRouteRestriction {
  type: 'height' | 'weight' | 'length' | 'width' | 'hazmat' | 'commercial_ban' | 'bridge' | 'tunnel';
  value?: number; // feet for height, tons for weight
  description: string;
  severity: 'advisory' | 'restriction' | 'prohibition';
  source: 'FHWA' | 'FMCSA' | 'State_DOT' | 'Local';
  coordinates?: { lat: number; lng: number };
}

export interface NationalNetworkRoute {
  routeId: string;
  designation: 'Interstate' | 'US_Highway' | 'State_Route' | 'National_Network';
  truckFriendly: boolean;
  staaApproved: boolean; // Surface Transportation Assistance Act approved
  maxVehicleLength: number; // feet
  maxVehicleHeight: number; // feet
  maxVehicleWeight: number; // tons
  restrictions: TruckRouteRestriction[];
}

export interface StateRestrictionData {
  state: string;
  stateCode: string;
  parkwayBans: boolean; // e.g., NY parkways ban commercial vehicles
  specialRestrictions: TruckRouteRestriction[];
  approvedTruckRoutes: string[];
  restrictedRoads: string[];
}

export class USTruckRoutingService {
  private static instance: USTruckRoutingService;
  private fhwaData: Map<string, NationalNetworkRoute> = new Map();
  private stateRestrictions: Map<string, StateRestrictionData> = new Map();
  private realTimeRestrictions: TruckRouteRestriction[] = [];

  static getInstance(): USTruckRoutingService {
    if (!USTruckRoutingService.instance) {
      USTruckRoutingService.instance = new USTruckRoutingService();
    }
    return USTruckRoutingService.instance;
  }

  constructor() {
    this.initializeGovernmentData();
  }

  private async initializeGovernmentData() {
    console.log('🏛️ Initializing U.S. Government truck routing data...');
    
    // Load FHWA National Network data
    await this.loadFHWANationalNetwork();
    
    // Load FMCSA restriction data
    await this.loadFMCSARestrictions();
    
    // Load state-specific restrictions
    await this.loadStateRestrictions();
    
    console.log('✅ Government truck routing data initialized');
  }

  private async loadFHWANationalNetwork() {
    // In production, this would fetch from FHWA APIs or cached government data
    // For now, we'll simulate key National Network routes
    
    const nationalNetworkRoutes: NationalNetworkRoute[] = [
      {
        routeId: 'I-10',
        designation: 'Interstate',
        truckFriendly: true,
        staaApproved: true,
        maxVehicleLength: 65, // feet (tractor-trailer)
        maxVehicleHeight: 13.5, // feet
        maxVehicleWeight: 80, // tons
        restrictions: []
      },
      {
        routeId: 'I-49',
        designation: 'Interstate',
        truckFriendly: true,
        staaApproved: true,
        maxVehicleLength: 65,
        maxVehicleHeight: 13.5,
        maxVehicleWeight: 80,
        restrictions: []
      },
      {
        routeId: 'US-90',
        designation: 'US_Highway',
        truckFriendly: true,
        staaApproved: true,
        maxVehicleLength: 60,
        maxVehicleHeight: 13.5,
        maxVehicleWeight: 80,
        restrictions: []
      },
      {
        routeId: 'LA-14',
        designation: 'State_Route',
        truckFriendly: false,
        staaApproved: false,
        maxVehicleLength: 40,
        maxVehicleHeight: 12,
        maxVehicleWeight: 40,
        restrictions: [
          {
            type: 'height',
            value: 12,
            description: 'Low bridge clearance on LA-14 near Delcambre',
            severity: 'restriction',
            source: 'State_DOT'
          }
        ]
      }
    ];

    nationalNetworkRoutes.forEach(route => {
      this.fhwaData.set(route.routeId, route);
    });

    console.log(`📊 Loaded ${nationalNetworkRoutes.length} FHWA National Network routes`);
  }

  private async loadFMCSARestrictions() {
    // Load FMCSA safety and HazMat restrictions
    // In production, this would connect to FMCSA APIs
    
    const fmcsaRestrictions: TruckRouteRestriction[] = [
      {
        type: 'commercial_ban',
        description: 'Parkways in New York prohibit all commercial vehicles',
        severity: 'prohibition',
        source: 'FMCSA'
      },
      {
        type: 'weight',
        value: 34,
        description: 'Weight restriction on local bridges in Louisiana',
        severity: 'restriction',
        source: 'FMCSA'
      },
      {
        type: 'height',
        value: 11.5,
        description: 'Low clearance bridge on US-167 near Ville Platte',
        severity: 'restriction',
        source: 'FMCSA',
        coordinates: { lat: 30.6885, lng: -92.2626 }
      }
    ];

    this.realTimeRestrictions.push(...fmcsaRestrictions);
    console.log(`🚛 Loaded ${fmcsaRestrictions.length} FMCSA restrictions`);
  }

  private async loadStateRestrictions() {
    // Load state-specific truck routing data
    
    const stateData: StateRestrictionData[] = [
      {
        state: 'Louisiana',
        stateCode: 'LA',
        parkwayBans: false,
        specialRestrictions: [
          {
            type: 'length',
            value: 65,
            description: 'Louisiana allows 65ft vehicles on designated routes',
            severity: 'advisory',
            source: 'State_DOT'
          }
        ],
        approvedTruckRoutes: ['I-10', 'I-49', 'I-20', 'US-90', 'US-165', 'US-167'],
        restrictedRoads: ['LA-14 (height restrictions)', 'Local residential streets']
      },
      {
        state: 'Texas',
        stateCode: 'TX',
        parkwayBans: false,
        specialRestrictions: [
          {
            type: 'length',
            value: 75,
            description: 'Texas allows longer vehicles on approved routes',
            severity: 'advisory',
            source: 'State_DOT'
          }
        ],
        approvedTruckRoutes: ['I-10', 'I-20', 'I-35', 'US-59', 'US-90'],
        restrictedRoads: ['Farm-to-Market roads with weight limits']
      },
      {
        state: 'New York',
        stateCode: 'NY',
        parkwayBans: true, // Critical: NY parkways ban ALL commercial vehicles
        specialRestrictions: [
          {
            type: 'commercial_ban',
            description: 'All parkways (Belt, Cross Island, FDR, etc.) prohibit trucks and buses',
            severity: 'prohibition',
            source: 'State_DOT'
          }
        ],
        approvedTruckRoutes: ['I-95', 'I-87', 'I-84', 'I-90', 'US-1', 'US-9'],
        restrictedRoads: ['All parkways', 'Many NYC streets have truck restrictions']
      }
    ];

    stateData.forEach(state => {
      this.stateRestrictions.set(state.stateCode, state);
    });

    console.log(`🗺️ Loaded restrictions for ${stateData.length} states`);
  }

  // Main method to evaluate route compliance for large buses
  public evaluateRouteCompliance(
    routeSegments: Array<{ streetName: string; startLat: number; startLng: number }>,
    vehicle: Vehicle
  ): {
    compliant: boolean;
    violations: TruckRouteRestriction[];
    recommendations: string[];
    nationalNetworkCoverage: number; // percentage of route on approved network
  } {
    console.log('🔍 Evaluating route compliance for large vehicle...');
    
    const violations: TruckRouteRestriction[] = [];
    const recommendations: string[] = [];
    let nationalNetworkSegments = 0;

    // Check each route segment against government data
    routeSegments.forEach((segment, index) => {
      const streetName = segment.streetName.toLowerCase();
      
      // Check against FHWA National Network
      const networkRoute = this.findNationalNetworkRoute(streetName);
      if (networkRoute) {
        nationalNetworkSegments++;
        
        // Check vehicle compliance with route limits
        if (vehicle.length > networkRoute.maxVehicleLength) {
          violations.push({
            type: 'length',
            value: networkRoute.maxVehicleLength,
            description: `Vehicle length ${vehicle.length}ft exceeds ${networkRoute.routeId} limit of ${networkRoute.maxVehicleLength}ft`,
            severity: 'restriction',
            source: 'FHWA'
          });
        }
        
        if (vehicle.height > networkRoute.maxVehicleHeight) {
          violations.push({
            type: 'height',
            value: networkRoute.maxVehicleHeight,
            description: `Vehicle height ${vehicle.height}ft exceeds ${networkRoute.routeId} limit of ${networkRoute.maxVehicleHeight}ft`,
            severity: 'restriction',
            source: 'FHWA'
          });
        }
      }
      
      // Check state-specific restrictions
      const stateRestrictions = this.checkStateRestrictions(segment, vehicle);
      violations.push(...stateRestrictions);
      
      // Check real-time restrictions from FMCSA
      const fmcsaRestrictions = this.checkFMCSARestrictions(segment, vehicle);
      violations.push(...fmcsaRestrictions);
    });

    const nationalNetworkCoverage = (nationalNetworkSegments / routeSegments.length) * 100;

    // Generate recommendations based on analysis
    if (nationalNetworkCoverage < 70) {
      recommendations.push('Route primarily uses non-National Network roads - consider alternatives via Interstate or US Highways');
    }
    
    if (violations.some(v => v.severity === 'prohibition')) {
      recommendations.push('🚨 CRITICAL: Route contains prohibited roads for commercial vehicles - must use alternative route');
    }
    
    if (violations.some(v => v.type === 'height')) {
      recommendations.push('⚠️ Height clearance issues detected - verify exact vehicle height and consider alternative route');
    }
    
    if (vehicle.length >= 40) { // Bus-specific advice
      recommendations.push('Large bus detected - prioritize Interstate and US Highway routes when possible');
      
      if (nationalNetworkCoverage >= 80) {
        recommendations.push('✅ Excellent route choice - primarily uses truck-approved infrastructure');
      }
    }

    const compliant = violations.filter(v => v.severity === 'prohibition').length === 0;

    console.log(`📋 Route compliance: ${compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
    console.log(`📊 National Network coverage: ${nationalNetworkCoverage.toFixed(1)}%`);
    console.log(`⚠️ Violations found: ${violations.length}`);

    return {
      compliant,
      violations,
      recommendations,
      nationalNetworkCoverage
    };
  }

  private findNationalNetworkRoute(streetName: string): NationalNetworkRoute | null {
    // Match street names to National Network routes
    for (const [routeId, route] of this.fhwaData) {
      if (streetName.includes(routeId.toLowerCase()) || 
          streetName.includes(routeId.replace('-', ' ')) ||
          streetName.includes('interstate') && routeId.startsWith('I-') ||
          streetName.includes('highway') && routeId.startsWith('US-')) {
        return route;
      }
    }
    return null;
  }

  private checkStateRestrictions(
    segment: { streetName: string; startLat: number; startLng: number },
    vehicle: Vehicle
  ): TruckRouteRestriction[] {
    const violations: TruckRouteRestriction[] = [];
    const streetName = segment.streetName.toLowerCase();
    
    // Determine state from coordinates (simplified - in production use geocoding)
    const state = this.getStateFromCoordinates(segment.startLat, segment.startLng);
    const stateData = this.stateRestrictions.get(state);
    
    if (!stateData) return violations;

    // Check for parkway restrictions (critical for NY)
    if (stateData.parkwayBans && streetName.includes('parkway')) {
      violations.push({
        type: 'commercial_ban',
        description: `${state} parkways prohibit all commercial vehicles including buses`,
        severity: 'prohibition',
        source: 'State_DOT'
      });
    }

    // Check if route is on restricted roads list
    const isRestricted = stateData.restrictedRoads.some(restrictedRoad => 
      streetName.includes(restrictedRoad.toLowerCase()) ||
      restrictedRoad.toLowerCase().includes(streetName)
    );

    if (isRestricted) {
      violations.push({
        type: 'commercial_ban',
        description: `Road appears on ${state} restricted routes list for large vehicles`,
        severity: 'restriction',
        source: 'State_DOT'
      });
    }

    return violations;
  }

  private checkFMCSARestrictions(
    segment: { streetName: string; startLat: number; startLng: number },
    vehicle: Vehicle
  ): TruckRouteRestriction[] {
    // Check against real-time FMCSA restrictions
    return this.realTimeRestrictions.filter(restriction => {
      if (restriction.coordinates) {
        // Check if segment is near restriction coordinates (within ~1 mile)
        const distance = this.calculateDistance(
          segment.startLat, segment.startLng,
          restriction.coordinates.lat, restriction.coordinates.lng
        );
        return distance < 1; // within 1 mile
      }
      return false;
    });
  }

  private getStateFromCoordinates(lat: number, lng: number): string {
    // Simplified state detection - in production, use proper geocoding
    if (lat >= 29 && lat <= 33 && lng >= -94 && lng <= -89) return 'LA';
    if (lat >= 25.5 && lat <= 36.5 && lng >= -106.5 && lng <= -93.5) return 'TX';
    if (lat >= 40.5 && lat <= 45 && lng >= -79.5 && lng <= -71.5) return 'NY';
    return 'UNKNOWN';
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

  // Method to get approved alternative routes
  public getApprovedAlternatives(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    vehicle: Vehicle
  ): string[] {
    const alternatives: string[] = [];
    
    // Recommend National Network routes based on vehicle type
    if (vehicle.length >= 35) { // Large bus
      alternatives.push('Prioritize Interstate highways (I-10, I-49, I-20)');
      alternatives.push('Use US Highways for regional travel (US-90, US-165, US-167)');
      alternatives.push('Avoid local roads and residential streets');
    }
    
    // State-specific recommendations
    const originState = this.getStateFromCoordinates(origin.lat, origin.lng);
    const destState = this.getStateFromCoordinates(destination.lat, destination.lng);
    
    if (originState === 'NY' || destState === 'NY') {
      alternatives.push('🚨 NEW YORK: Avoid ALL parkways - use I-95, I-87, I-84, or I-90 only');
    }
    
    if (originState === 'LA' || destState === 'LA') {
      alternatives.push('LOUISIANA: I-10 and I-49 are optimal for large vehicles');
      alternatives.push('US-90 acceptable but monitor bridge clearances');
    }

    return alternatives;
  }

  // Real-time 511 service integration (simplified)
  public async getRealTimeRestrictions(state: string): Promise<TruckRouteRestriction[]> {
    console.log(`🚧 Checking real-time restrictions for ${state}...`);
    
    // In production, this would call state 511 APIs
    // For now, simulate common real-time restrictions
    
    const mockRestrictions: TruckRouteRestriction[] = [
      {
        type: 'weight',
        value: 25,
        description: 'Temporary weight restriction due to bridge construction on I-10 near Lafayette',
        severity: 'restriction',
        source: 'State_DOT'
      }
    ];

    return mockRestrictions;
  }
}
