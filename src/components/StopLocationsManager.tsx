import React, { useState } from 'react';
import { Plus, GripVertical, Clock, MapPin, Trash2, Edit2 } from 'lucide-react';
import { StopLocation } from '../types';
import { LocationInput } from './LocationInput';

interface StopLocationsManagerProps {
  stops: StopLocation[];
  onStopsChange: (stops: StopLocation[]) => void;
  disabled?: boolean;
}

export const StopLocationsManager: React.FC<StopLocationsManagerProps> = ({
  stops,
  onStopsChange,
  disabled = false
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStopTime, setEditStopTime] = useState(15);

  const addStop = () => {
    const newStop: StopLocation = {
      id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      address: '',
      order: stops.length,
      estimatedStopTime: 15,
      lat: undefined,
      lng: undefined,
    };
    onStopsChange([...stops, newStop]);
  };

  const removeStop = (stopId: string) => {
    const updatedStops = stops
      .filter(stop => stop.id !== stopId)
      .map((stop, index) => ({ ...stop, order: index }));
    onStopsChange(updatedStops);
  };

  const updateStop = (stopId: string, updates: Partial<StopLocation>) => {
    const updatedStops = stops.map(stop =>
      stop.id === stopId ? { ...stop, ...updates } : stop
    );
    onStopsChange(updatedStops);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newStops = [...stops];
    const draggedStop = newStops[draggedIndex];
    
    // Remove the dragged item
    newStops.splice(draggedIndex, 1);
    
    // Insert at new position
    newStops.splice(dropIndex, 0, draggedStop);
    
    // Update order numbers
    const reorderedStops = newStops.map((stop, index) => ({
      ...stop,
      order: index
    }));
    
    onStopsChange(reorderedStops);
    setDraggedIndex(null);
  };

  const startEditing = (stop: StopLocation) => {
    setEditingStopId(stop.id);
    setEditName(stop.name || '');
    setEditStopTime(stop.estimatedStopTime || 15);
  };

  const saveEdit = () => {
    if (editingStopId) {
      updateStop(editingStopId, {
        name: editName.trim() || undefined,
        estimatedStopTime: editStopTime
      });
      setEditingStopId(null);
      setEditName('');
      setEditStopTime(15);
    }
  };

  const cancelEdit = () => {
    setEditingStopId(null);
    setEditName('');
    setEditStopTime(15);
  };

  const getTotalStopTime = () => {
    return stops.reduce((total, stop) => total + (stop.estimatedStopTime || 0), 0);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <MapPin className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stop Locations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add intermediate stops along your route
            </p>
          </div>
        </div>
        
        {stops.length > 0 && (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {stops.length} stop{stops.length !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              ~{getTotalStopTime()} min total
            </div>
          </div>
        )}
      </div>

      {/* Stops List */}
      <div className="space-y-3 mb-4">
        {stops.map((stop, index) => (
          <div
            key={stop.id}
            draggable={!disabled && !editingStopId}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className={`p-4 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 ${
              draggedIndex === index ? 'opacity-50' : ''
            } ${!disabled && !editingStopId ? 'cursor-move hover:border-purple-300 dark:hover:border-purple-600' : ''}`}
          >
            <div className="flex items-start gap-3">
              {/* Drag Handle */}
              {!disabled && !editingStopId && (
                <div className="mt-2">
                  <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
              )}
              
              {/* Stop Number */}
              <div className="flex-shrink-0 mt-2">
                <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
              </div>

              {/* Stop Content */}
              <div className="flex-1 min-w-0">
                {editingStopId === stop.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Stop Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., Customer Pickup, Fuel Stop"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Stop Time (minutes)
                      </label>
                      <input
                        type="number"
                        value={editStopTime}
                        onChange={(e) => setEditStopTime(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        max="480"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-2">
                      <LocationInput
                        label=""
                        value={stop.address}
                        onChange={(address) => updateStop(stop.id, { address })}
                        placeholder="Enter stop address"
                        disabled={disabled}
                        onLocationSelect={(location) =>
                          updateStop(stop.id, {
                            address: location.address,
                            lat: location.lat,
                            lng: location.lng,
                          })
                        }
                      />
                    </div>
                    
                    {stop.name && (
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {stop.name}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{stop.estimatedStopTime || 15} min stop</span>
                      </div>
                      
                      {!disabled && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditing(stop)}
                            className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            title="Edit stop details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeStop(stop.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Remove stop"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Stop Button */}
      {!disabled && (
        <button
          onClick={addStop}
          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Stop Location
        </button>
      )}

      {/* Instructions */}
      {stops.length > 0 && !disabled && (
        <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
          <div className="text-sm text-purple-800 dark:text-purple-300">
            <div className="font-medium mb-1">Stop Management:</div>
            <div className="space-y-1 text-xs">
              <div>• Drag stops to reorder them along your route</div>
              <div>• Click edit to add names and adjust stop times</div>
              <div>• Stops will be included in route risk analysis</div>
              <div>• Total estimated stop time: <strong>{getTotalStopTime()} minutes</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
