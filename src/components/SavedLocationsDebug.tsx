import React, { useState } from 'react';
import { useSavedLocations } from '../hooks/useSavedLocations';
import { SavedLocation } from '../types';

export const SavedLocationsDebug: React.FC = () => {
  const { 
    savedLocations, 
    isLoading, 
    error, 
    addLocation, 
    deleteLocation, 
    clearAllLocations,
    exportLocations 
  } = useSavedLocations();
  
  const [testName, setTestName] = useState('');
  const [testAddress, setTestAddress] = useState('');

  const addTestLocation = () => {
    if (testName.trim() && testAddress.trim()) {
      console.log('🧪 Adding test location...');
      addLocation({
        name: testName.trim(),
        address: testAddress.trim(),
        category: 'other'
      });
      setTestName('');
      setTestAddress('');
    }
  };

  const addSampleLocations = () => {
    console.log('🧪 Adding sample locations...');
    const samples = [
      { name: 'Main Office', address: '123 Business St, Lafayette, LA', category: 'work' as const },
      { name: 'Home', address: '456 Residential Ave, Opelousas, LA', category: 'home' as const },
      { name: 'Warehouse A', address: '789 Industrial Blvd, Lafayette, LA', category: 'warehouse' as const }
    ];
    
    samples.forEach(sample => addLocation(sample));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        🐛 Saved Locations Debug Panel
      </h3>

      {/* Status Info */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>📊 Total Locations: <strong>{savedLocations.length}</strong></div>
          <div>⏳ Loading: <strong>{isLoading ? 'Yes' : 'No'}</strong></div>
          <div>❌ Error: <strong>{error || 'None'}</strong></div>
          <div>💾 Storage: <strong>{typeof(Storage) !== 'undefined' ? 'Available' : 'Not Available'}</strong></div>
        </div>
      </div>

      {/* Test Add Location */}
      <div className="mb-4 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
        <h4 className="font-medium mb-2">🧪 Test Add Location</h4>
        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            placeholder="Location name..."
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <input
            type="text"
            placeholder="Address..."
            value={testAddress}
            onChange={(e) => setTestAddress(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <div className="flex gap-2">
            <button
              onClick={addTestLocation}
              disabled={!testName.trim() || !testAddress.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
            >
              ➕ Add Test Location
            </button>
            <button
              onClick={addSampleLocations}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              📋 Add Sample Data
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={clearAllLocations}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
        >
          🗑️ Clear All
        </button>
        <button
          onClick={() => {
            const exported = exportLocations();
            console.log('📤 Exported data:', exported);
            navigator.clipboard?.writeText(exported);
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
        >
          📤 Export (to console & clipboard)
        </button>
      </div>

      {/* Saved Locations List */}
      <div>
        <h4 className="font-medium mb-2">📍 Current Saved Locations ({savedLocations.length})</h4>
        {savedLocations.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-sm italic">
            No saved locations yet...
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {savedLocations.map((location, index) => (
              <div key={location.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {index + 1}. {location.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {location.address} • {location.category}
                  </div>
                  <div className="text-xs text-gray-400">
                    Created: {location.createdAt.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    console.log('🗑️ Deleting location:', location.id);
                    deleteLocation(location.id);
                  }}
                  className="ml-2 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw Data Display */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
          🔍 Show Raw Data
        </summary>
        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(savedLocations, null, 2)}
        </pre>
      </details>
    </div>
  );
};
