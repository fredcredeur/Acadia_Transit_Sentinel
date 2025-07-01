// Centralized route color management for consistency across the app

export class RouteColorManager {
  // Consistent color palette for routes
  private static readonly ROUTE_COLORS = [
    '#4299E1', // Blue-500 - Primary route
    '#805AD5', // Purple-500 - Alternative route  
    '#38B2AC', // Teal-500 - Scenic/local route
    '#ED8936', // Orange-500 - Express route
    '#E53E3E', // Red-500 - Emergency/backup route
    '#48BB78', // Green-500 - Eco route
    '#D69E2E', // Yellow-600 - Commercial route
    '#9F7AEA'  // Purple-400 - Special route
  ];

  // Get color for a specific route index
  static getRouteColor(index: number): string {
    return this.ROUTE_COLORS[index % this.ROUTE_COLORS.length];
  }

  // Get color by route ID (extract index from ID)
  static getRouteColorById(routeId: string): string {
    // Extract number from route ID (e.g., "route-1" -> 0, "route-2" -> 1)
    const match = routeId.match(/route-(\d+)/);
    const index = match ? parseInt(match[1]) - 1 : 0;
    return this.getRouteColor(Math.max(0, index));
  }

  // Get color by route name
  static getRouteColorByName(routeName: string): string {
    // Extract number from route name (e.g., "Route 1" -> 0, "Route 2" -> 1)
    const match = routeName.match(/Route (\d+)/);
    const index = match ? parseInt(match[1]) - 1 : 0;
    return this.getRouteColor(Math.max(0, index));
  }

  // Get all colors for legend/reference
  static getAllColors(): string[] {
    return [...this.ROUTE_COLORS];
  }

  // Get lighter version of route color for backgrounds
  static getRouteColorLight(index: number): string {
    const color = this.getRouteColor(index);
    return color + '20'; // Add 20% opacity
  }

  // Get darker version of route color for borders
  static getRouteColorDark(index: number): string {
    const colors = [
      '#2B6CB0', // Blue-700
      '#6B46C1', // Purple-700
      '#2C7A7B', // Teal-700
      '#C05621', // Orange-700
      '#C53030', // Red-700
      '#38A169', // Green-600
      '#B7791F', // Yellow-700
      '#805AD5'  // Purple-600
    ];
    return colors[index % colors.length];
  }

  // Get route color with custom opacity
  static getRouteColorWithOpacity(index: number, opacity: number): string {
    const color = this.getRouteColor(index);
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return color + opacityHex;
  }
}