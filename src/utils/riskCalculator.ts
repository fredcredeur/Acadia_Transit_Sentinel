import { Vehicle, RouteSegment, Route } from '../types';

export class RiskCalculator {
  private static readonly WEIGHTS = {
    pedestrianTraffic: 0.3,
    roadWidth: 0.3,
    trafficCongestion: 0.2,
    speedLimit: 0.1,
    heightRestriction: 0.1
  };

  static calculateSegmentRisk(segment: RouteSegment, vehicle: Vehicle): number {
    const factors = segment.riskFactors;
    
    // Adjust factors based on vehicle dimensions
    const adjustedFactors = {
      pedestrianTraffic: factors.pedestrianTraffic * this.getVehicleSizeMultiplier(vehicle),
      roadWidth: factors.roadWidth * this.getWidthRiskMultiplier(vehicle),
      trafficCongestion: factors.trafficCongestion,
      speedLimit: factors.speedLimit,
      heightRestriction: this.getHeightRisk(factors.heightRestriction, vehicle.height)
    };

    // Calculate weighted risk score
    const riskScore = Object.entries(this.WEIGHTS).reduce((total, [factor, weight]) => {
      return total + (adjustedFactors[factor as keyof typeof adjustedFactors] * weight);
    }, 0);

    return Math.min(Math.max(riskScore, 0), 100);
  }

  static calculateRouteRisk(route: Route, vehicle: Vehicle): number {
    const segmentRisks = route.segments.map(segment => 
      this.calculateSegmentRisk(segment, vehicle)
    );
    
    return segmentRisks.reduce((sum, risk) => sum + risk, 0) / segmentRisks.length;
  }

  private static getVehicleSizeMultiplier(vehicle: Vehicle): number {
    const size = vehicle.length * vehicle.width;
    if (size > 300) return 1.5; // Large vehicle
    if (size > 200) return 1.2; // Medium vehicle
    return 1.0; // Standard vehicle
  }

  private static getWidthRiskMultiplier(vehicle: Vehicle): number {
    if (vehicle.width > 8) return 1.8;
    if (vehicle.width > 7) return 1.4;
    return 1.0;
  }

  private static getHeightRisk(clearanceHeight: number, vehicleHeight: number): number {
    if (clearanceHeight === 0) return 0; // No height restriction
    if (vehicleHeight >= clearanceHeight) return 100; // Cannot pass
    if (vehicleHeight >= clearanceHeight - 1) return 80; // Very risky
    if (vehicleHeight >= clearanceHeight - 2) return 40; // Moderate risk
    return 10; // Low risk
  }

  static getRiskColor(riskScore: number): string {
    if (riskScore >= 70) return '#EF4444'; // Red
    if (riskScore >= 40) return '#F59E0B'; // Amber
    return '#10B981'; // Green
  }

  static getRiskLabel(riskScore: number): string {
    if (riskScore >= 70) return 'High Risk';
    if (riskScore >= 40) return 'Medium Risk';
    return 'Low Risk';
  }
}