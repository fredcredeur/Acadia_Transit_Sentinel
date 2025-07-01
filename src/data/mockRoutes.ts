import { Route } from '../types';

export const mockRoutes: Route[] = [
  {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
    id: 'route-1',
    name: 'Main Street Route',
    totalDistance: 8.5,
    estimatedTime: 25,
    overallRisk: 0,
    segments: [
      {
        id: 'seg-1',
        startLat: 40.7128,
        startLng: -74.0060,
        endLat: 40.7138,
        endLng: -74.0050,
        streetName: 'Main Street',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 45,
          roadWidth: 25,
          trafficCongestion: 60,
          speedLimit: 30,
          heightRestriction: 0
        },
        description: 'Moderate pedestrian activity, standard road width'
      },
      {
        id: 'seg-2',
        startLat: 40.7138,
        startLng: -74.0050,
        endLat: 40.7148,
        endLng: -74.0040,
        streetName: 'Broadway',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 80,
          roadWidth: 60,
          trafficCongestion: 75,
          speedLimit: 25,
          heightRestriction: 0
        },
        description: 'Heavy pedestrian traffic, narrow road during peak hours'
      },
      {
        id: 'seg-3',
        startLat: 40.7148,
        startLng: -74.0040,
        endLat: 40.7158,
        endLng: -74.0030,
        streetName: 'Park Avenue',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 35,
          roadWidth: 40,
          trafficCongestion: 45,
          speedLimit: 35,
          heightRestriction: 0
        },
        description: 'Residential area with moderate traffic'
      },
      {
        id: 'seg-4',
        startLat: 40.7158,
        startLng: -74.0030,
        endLat: 40.7168,
        endLng: -74.0020,
        streetName: 'Commerce Street (Turn)',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 85,
          roadWidth: 70,
          trafficCongestion: 40,
          speedLimit: 20,
          heightRestriction: 0
        },
        description: 'Sharp turn with heavy pedestrian crossing, school zone'
      },
      {
        id: 'seg-5',
        startLat: 40.7168,
        startLng: -74.0020,
        endLat: 40.7178,
        endLng: -74.0010,
        streetName: 'Industrial Boulevard',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 15,
          roadWidth: 20,
          trafficCongestion: 30,
          speedLimit: 45,
          heightRestriction: 13.5
        },
        description: 'Bridge with 13.5ft clearance, low pedestrian activity'
      }
    ],
    criticalPoints: [
      {
        segmentId: 'seg-4',
        type: 'turn',
        riskLevel: 'high',
        description: '4th turn: Sharp right turn with heavy pedestrian crossings near elementary school',
        position: 3
      },
      {
        segmentId: 'seg-5',
        type: 'bridge',
        riskLevel: 'critical',
        description: 'Bridge clearance: 13.5ft height restriction',
        position: 4
      }
    ]
  },
  {
    id: 'route-2',
    name: 'Highway Bypass Route',
    totalDistance: 12.3,
    estimatedTime: 22,
    overallRisk: 0,
    segments: [
      {
        id: 'seg-a1',
        startLat: 40.7128,
        startLng: -74.0060,
        endLat: 40.7120,
        endLng: -74.0070,
        streetName: 'Highway 95 On-Ramp',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 5,
          roadWidth: 15,
          trafficCongestion: 50,
          speedLimit: 55,
          heightRestriction: 0
        },
        description: 'Highway entrance with minimal pedestrian activity'
      },
      {
        id: 'seg-a2',
        startLat: 40.7120,
        startLng: -74.0070,
        endLat: 40.7100,
        endLng: -74.0080,
        streetName: 'Highway 95 North',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 0,
          roadWidth: 10,
          trafficCongestion: 65,
          speedLimit: 65,
          heightRestriction: 0
        },
        description: 'Main highway stretch with heavy traffic during rush hour'
      },
      {
        id: 'seg-a3',
        startLat: 40.7100,
        startLng: -74.0080,
        endLat: 40.7080,
        endLng: -74.0090,
        streetName: 'Highway 95 North',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 0,
          roadWidth: 10,
          trafficCongestion: 40,
          speedLimit: 65,
          heightRestriction: 0
        },
        description: 'Continued highway with moderate traffic'
      },
      {
        id: 'seg-a4',
        startLat: 40.7080,
        startLng: -74.0090,
        endLat: 40.7178,
        endLng: -74.0010,
        streetName: 'Industrial Boulevard Off-Ramp',
        riskScore: 0,
        riskFactors: {
          pedestrianTraffic: 10,
          roadWidth: 25,
          trafficCongestion: 35,
          speedLimit: 35,
          heightRestriction: 0
        },
        description: 'Highway exit to destination area'
      }
    ],
    criticalPoints: [
      {
        segmentId: 'seg-a2',
        type: 'intersection',
        riskLevel: 'high',
        description: 'Heavy traffic congestion during peak hours',
        position: 1
      }
    ]
<<<<<<< HEAD
=======
    id: '1',
    name: 'Island Explorer Route 1',
    description: 'Bar Harbor to Blackwoods Campground',
    color: '#0284c7',
    points: [
      {
        location: {
          id: 'village-green',
          name: 'Village Green',
          address: 'Bar Harbor, ME',
          position: { lat: 44.3876, lng: -68.2039 }
        },
        departureTime: '10:00 AM',
        isStop: true
      },
      {
        location: {
          id: 'visitor-center',
          name: 'Hulls Cove Visitor Center',
          address: 'Bar Harbor, ME',
          position: { lat: 44.4097, lng: -68.2469 }
        },
        arrivalTime: '10:15 AM',
        departureTime: '10:20 AM',
        isStop: true
      },
      {
        location: {
          id: 'sieur-de-monts',
          name: 'Sieur de Monts',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3615, lng: -68.2074 }
        },
        arrivalTime: '10:35 AM',
        departureTime: '10:40 AM',
        isStop: true
      },
      {
        location: {
          id: 'blackwoods',
          name: 'Blackwoods Campground',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3097, lng: -68.1839 }
        },
        arrivalTime: '11:00 AM',
        isStop: true
      }
    ],
    distance: 18200,
    duration: 3600,
    riskScore: 25
  },
  {
    id: '2',
    name: 'Island Explorer Route 3',
    description: 'Bar Harbor to Jordan Pond',
    color: '#7c3aed',
    points: [
      {
        location: {
          id: 'village-green',
          name: 'Village Green',
          address: 'Bar Harbor, ME',
          position: { lat: 44.3876, lng: -68.2039 }
        },
        departureTime: '10:15 AM',
        isStop: true
      },
      {
        location: {
          id: 'bubble-pond',
          name: 'Bubble Pond',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3384, lng: -68.2331 }
        },
        arrivalTime: '10:35 AM',
        departureTime: '10:40 AM',
        isStop: true
      },
      {
        location: {
          id: 'jordan-pond',
          name: 'Jordan Pond House',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3240, lng: -68.2511 }
        },
        arrivalTime: '10:55 AM',
        isStop: true
      }
    ],
    distance: 12500,
    duration: 2400,
    riskScore: 45
  },
  {
    id: '3',
    name: 'Cadillac Mountain Route',
    description: 'Bar Harbor to Cadillac Mountain Summit',
    color: '#ef4444',
    points: [
      {
        location: {
          id: 'village-green',
          name: 'Village Green',
          address: 'Bar Harbor, ME',
          position: { lat: 44.3876, lng: -68.2039 }
        },
        departureTime: '9:30 AM',
        isStop: true
      },
      {
        location: {
          id: 'cadillac-entrance',
          name: 'Cadillac Summit Road Entrance',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3526, lng: -68.2235 }
        },
        arrivalTime: '9:45 AM',
        departureTime: '9:50 AM',
        isStop: false
      },
      {
        location: {
          id: 'blue-hill-overlook',
          name: 'Blue Hill Overlook',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3431, lng: -68.2261 }
        },
        arrivalTime: '10:00 AM',
        departureTime: '10:05 AM',
        isStop: true
      },
      {
        location: {
          id: 'cadillac-summit',
          name: 'Cadillac Mountain Summit',
          address: 'Acadia National Park, ME',
          position: { lat: 44.3520, lng: -68.2273 }
        },
        arrivalTime: '10:15 AM',
        isStop: true
      }
    ],
    distance: 8700,
    duration: 2700,
    riskScore: 75
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
  }
];