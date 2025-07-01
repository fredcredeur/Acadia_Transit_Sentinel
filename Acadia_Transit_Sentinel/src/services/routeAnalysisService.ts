import { Route, RiskFactor } from '../types';

// Mock risk factors in the Acadia area
const RISK_FACTORS: RiskFactor[] = [
  {
    id: 'risk-1',
    name: 'Steep Road',
    description: 'Cadillac Mountain Road has steep grades and sharp turns',
    severity: 'high',
    location: { lat: 44.3431, lng: -68.2261 }
  },
  {
    id: 'risk-2',
    name: 'Congestion',
    description: 'Heavy tourist traffic during peak hours',
    severity: 'medium',
    location: { lat: 44.3876, lng: -68.2039 }
  },
  {
    id: 'risk-3',
    name: 'Wildlife Crossing',
    description: 'Frequent deer crossings reported in this area',
    severity: 'medium',
    location: { lat: 44.3097, lng: -68.1839 }
  },
  {
    id: 'risk-4',
    name: 'Poor Road Condition',
    description: 'Road surface damaged from winter weather',
    severity: 'low',
    location: { lat: 44.3615, lng: -68.2074 }
  },
  {
    id: 'risk-5',
    name: 'Blind Corner',
    description: 'Limited visibility around curve',
    severity: 'high',
    location: { lat: 44.3240, lng: -68.2511 }
  }
];

// Calculate risk score for a route based on proximity to known risk factors
export function analyzeRouteRisk(route: Route): { route: Route, riskFactors: RiskFactor[] } {
  const relevantRiskFactors: RiskFactor[] = [];
  let totalRiskScore = 0;
  
  // Check each point in the route against known risk factors
  route.points.forEach((point, index) => {
    if (index === 0) return; // Skip starting point
    
    const prevPoint = route.points[index - 1];
    
    // Check each risk factor
    RISK_FACTORS.forEach(factor => {
      // Calculate if this route segment passes near the risk factor
      const isNearRisk = isPointNearLineSegment(
        factor.location,
        prevPoint.location.position,
        point.location.position,
        0.01 // ~1km threshold
      );
      
      if (isNearRisk) {
        relevantRiskFactors.push(factor);
        
        // Add to risk score based on severity
        switch (factor.severity) {
          case 'low':
            totalRiskScore += 10;
            break;
          case 'medium':
            totalRiskScore += 25;
            break;
          case 'high':
            totalRiskScore += 40;
            break;
        }
      }
    });
  });
  
  // Normalize risk score to 0-100 range
  const normalizedScore = Math.min(100, totalRiskScore);
  
  // Create a new route with the risk score
  const analyzedRoute: Route = {
    ...route,
    riskScore: normalizedScore
  };
  
  return {
    route: analyzedRoute,
    riskFactors: relevantRiskFactors
  };
}

// Helper function to check if a point is near a line segment
function isPointNearLineSegment(
  point: { lat: number, lng: number },
  lineStart: { lat: number, lng: number },
  lineEnd: { lat: number, lng: number },
  threshold: number
): boolean {
  // Calculate distance from point to line segment
  const distance = distanceToLineSegment(
    point.lat, point.lng,
    lineStart.lat, lineStart.lng,
    lineEnd.lat, lineEnd.lng
  );
  
  return distance < threshold;
}

// Calculate distance from point to line segment
function distanceToLineSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// Get all risk factors for display
export function getAllRiskFactors(): RiskFactor[] {
  return RISK_FACTORS;
}