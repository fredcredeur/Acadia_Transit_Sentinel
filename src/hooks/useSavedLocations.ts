import { useState, useEffect } from 'react';
import { SavedLocation } from '../types';

const STORAGE_KEY = 'acadia-saved-locations';

export const useSavedLocations = () => {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved locations from localStorage on mount
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const locations = JSON.parse(stored).map((loc: any) => ({
          ...loc,
          createdAt: new Date(loc.createdAt),
          lastUsed: loc.lastUsed ? new Date(loc.lastUsed) : undefined,
        }));
        setSavedLocations(locations);
      }
    } catch (error) {
      console.error('Failed to load saved locations:', error);
      setError('Failed to load saved locations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever locations change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
    } catch (error) {
      console.error('Failed to save locations:', error);
    }
  }, [savedLocations]);

  const addLocation = (location: Omit<SavedLocation, 'id' | 'createdAt'>) => {
    const newLocation: SavedLocation = {
      ...location,
      id: `loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    setSavedLocations(prev => [newLocation, ...prev]);
    return newLocation;
  };

  const updateLocation = (id: string, updates: Partial<SavedLocation>) => {
    setSavedLocations(prev =>
      prev.map(loc =>
        loc.id === id ? { ...loc, ...updates } : loc
      )
    );
  };

  const deleteLocation = (id: string) => {
    setSavedLocations(prev => prev.filter(loc => loc.id !== id));
  };

  const markAsUsed = (id: string) => {
    updateLocation(id, { lastUsed: new Date() });
  };

  const getLocationsByCategory = (category: SavedLocation['category']) => {
    return savedLocations.filter(loc => loc.category === category);
  };

  const searchLocations = (query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return savedLocations.filter(
      loc =>
        loc.name.toLowerCase().includes(lowercaseQuery) ||
        loc.address.toLowerCase().includes(lowercaseQuery)
    );
  };

  const clearAllLocations = () => {
    setSavedLocations([]);
  };

  const exportLocations = () => {
    return JSON.stringify(savedLocations, null, 2);
  };

  return {
    savedLocations,
    isLoading,
    error,
    addLocation,
    updateLocation,
    deleteLocation,
    markAsUsed,
    getLocationsByCategory,
    searchLocations,
    clearAllLocations,
    exportLocations,
  };
};
