import { Route } from '../types';

export const mockRoutes: Route[] = [
  {
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
  }
];