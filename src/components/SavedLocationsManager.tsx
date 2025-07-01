import React, { useState } from 'react';
import { Star, Edit2, Trash2, Home, Building, Warehouse, Truck, MapPin, Search, X, LucideIcon } from 'lucide-react';
import { SavedLocation } from '../types';
import { useSavedLocations } from '../hooks/useSavedLocations';

interface SavedLocationsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect?: (location: SavedLocation) => void;
}

export const SavedLocationsManager: React.FC<SavedLocationsManagerProps> = ({
  isOpen,
  onClose,
  onLocationSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<SavedLocation['category']>('other');
  const [selectedCategory, setSelectedCategory] = useState<SavedLocation['category'] | 'all'>('all');

  const { savedLocations, updateLocation, deleteLocation, searchLocations, getLocationsByCategory } = useSavedLocations();

  if (!isOpen) return null;

  const getCategoryIcon = (category: SavedLocation['category']) => {
    switch (category) {
      case 'home': return Home;
      case 'work': return Building;
      case 'warehouse': return Warehouse;
      case 'depot': return Truck;
      default: return MapPin;
    }
  };

  const getCategoryColor = (category: SavedLocation['category']) => {
    switch (category) {
      case 'home': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'work': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'warehouse': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'depot': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'customer': return 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const handleEditStart = (location: SavedLocation) => {
    setEditingLocation(location);
    setEditName(location.name);
    setEditCategory(location.category);
  };

  const handleEditSave = () => {
    if (editingLocation && editName.trim()) {
      updateLocation(editingLocation.id, {
        name: editName.trim(),
        category: editCategory,
      });
      setEditingLocation(null);
      setEditName('');
      setEditCategory('other');
    }
  };

  const handleEditCancel = () => {
    setEditingLocation(null);
    setEditName('');
    setEditCategory('other');
  };

  const handleDelete = (location: SavedLocation) => {
    if (confirm(`Are you sure you want to delete "${location.name}"?`)) {
      deleteLocation(location.id);
    }
  };

  const handleLocationClick = (location: SavedLocation) => {
    onLocationSelect?.(location);
    onClose();
  };

  // Filter locations
  let filteredLocations = savedLocations;
  
  if (searchQuery.trim()) {
    filteredLocations = searchLocations(searchQuery);
  } else if (selectedCategory !== 'all') {
    filteredLocations = getLocationsByCategory(selectedCategory);
  }

  // Group by category
  const locationsByCategory = filteredLocations.reduce((acc, location) => {
    if (!acc[location.category]) {
      acc[location.category] = [];
    }
    acc[location.category].push(location);
    return acc;
  }, {} as Record<SavedLocation['category'], SavedLocation[]>);

  const categories: { key: SavedLocation['category'] | 'all'; label: string; icon: LucideIcon }[] = [
    { key: 'all', label: 'All', icon: Star },
    { key: 'home', label: 'Home', icon: Home },
    { key: 'work', label: 'Work', icon: Building },
    { key: 'warehouse', label: 'Warehouse', icon: Warehouse },
    { key: 'depot', label: 'Depot', icon: Truck },
    { key: 'customer', label: 'Customer', icon: MapPin },
    { key: 'other', label: 'Other', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Star className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Saved Locations</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your frequently used addresses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Search locations..."
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto">
              {categories.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery.trim() ? 'No matching locations' : 'No saved locations'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery.trim() 
                  ? 'Try adjusting your search terms'
                  : 'Save frequently used addresses for quick access during route planning'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(locationsByCategory).map(([category, locations]) => {
                const Icon = getCategoryIcon(category as SavedLocation['category']);
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <h3 className="font-medium text-gray-900 dark:text-white capitalize">
                        {category} ({locations.length})
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {locations.map((location) => (
                        <div
                          key={location.id}
                          className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          {editingLocation?.id === location.id ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Location name"
                              />
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value as SavedLocation['category'])}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="home">Home</option>
                                <option value="work">Work</option>
                                <option value="warehouse">Warehouse</option>
                                <option value="depot">Depot</option>
                                <option value="customer">Customer</option>
                                <option value="other">Other</option>
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleEditSave}
                                  className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleEditCancel}
                                  className="flex-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1 rounded ${getCategoryColor(location.category)}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {location.name}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditStart(location)}
                                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    title="Edit location"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(location)}
                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="Delete location"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                {location.address}
                              </p>
                              
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {location.lastUsed ? (
                                    `Last used: ${location.lastUsed.toLocaleDateString()}`
                                  ) : (
                                    `Added: ${location.createdAt.toLocaleDateString()}`
                                  )}
                                </div>
                                
                                {onLocationSelect && (
                                  <button
                                    onClick={() => handleLocationClick(location)}
                                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                  >
                                    Use Location
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
