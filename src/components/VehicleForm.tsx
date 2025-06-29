import React from 'react';
import { Truck, AlertTriangle } from 'lucide-react';
import { Vehicle } from '../types';
import { VehicleClassificationService } from '../services/vehicleClassificationService';

interface VehicleFormProps {
  vehicle: Vehicle;
  onChange: (vehicle: Vehicle) => void;
}

export const VehicleForm: React.FC<VehicleFormProps> = ({ vehicle, onChange }) => {
  const handleInputChange = (field: keyof Vehicle, value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({
      ...vehicle,
      [field]: numValue
    });
  };

  const isOversized = vehicle.height > 13.5 || vehicle.length > 50 || vehicle.width > 8.5;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
          <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Vehicle Specifications</h2>
      </div>

      {isOversized && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mb-4 transition-colors duration-300">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Oversized vehicle detected - extra caution required
          </span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="height" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Height (feet)
          </label>
          <input
            type="number"
            id="height"
            value={vehicle.height || ''}
            onChange={(e) => handleInputChange('height', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-300"
            placeholder="Enter vehicle height"
            min="0"
            max="20"
            step="0.1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Standard truck: ~13.5ft, Box truck: ~11ft</p>
        </div>

        <div>
          <label htmlFor="length" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Length (feet)
          </label>
          <input
            type="number"
            id="length"
            value={vehicle.length || ''}
            onChange={(e) => handleInputChange('length', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-300"
            placeholder="Enter vehicle length"
            min="0"
            max="80"
            step="0.1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Delivery truck: ~20-30ft, Semi-trailer: ~53ft</p>
        </div>

        <div>
          <label htmlFor="width" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Width (feet)
          </label>
          <input
            type="number"
            id="width"
            value={vehicle.width || ''}
            onChange={(e) => handleInputChange('width', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-300"
            placeholder="Enter vehicle width"
            min="0"
            max="12"
            step="0.1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Standard truck: ~8ft, Wide load: {'>'} 8.5ft</p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors duration-300">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Vehicle Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Height:</span>
            <p className="font-medium text-gray-900 dark:text-white">{vehicle.height || 0}ft</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Length:</span>
            <p className="font-medium text-gray-900 dark:text-white">{vehicle.length || 0}ft</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Width:</span>
            <p className="font-medium text-gray-900 dark:text-white">{vehicle.width || 0}ft</p>
          </div>
        </div>
      </div>
      <VehicleClassificationDisplay vehicle={vehicle} />
    </div>
  );
};

const VehicleClassificationDisplay: React.FC<{ vehicle: Vehicle }> = ({ vehicle }) => {
  const vehicleClass = VehicleClassificationService.classifyVehicle(vehicle);
  const description = VehicleClassificationService.getVehicleDescription(vehicleClass);
  
  const getClassColor = (type: string) => {
    switch (type) {
      case 'passenger': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'delivery': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'bus': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'truck': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'oversized': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };
  
  return (
    <div className="mt-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          Vehicle Classification
        </h4>
        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getClassColor(vehicleClass.type)}`}>
          {vehicleClass.type}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {description}
      </p>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${vehicleClass.canMakeUTurns ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-gray-600 dark:text-gray-400">
            U-turns: {vehicleClass.canMakeUTurns ? 'Allowed' : 'Prohibited'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${vehicleClass.requiresBlockRouting ? 'bg-orange-400' : 'bg-green-400'}`} />
          <span className="text-gray-600 dark:text-gray-400">
            Routing: {vehicleClass.requiresBlockRouting ? 'Block/Loop' : 'Direct'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${vehicleClass.preferTruckRoutes ? 'bg-blue-400' : 'bg-gray-400'}`} />
          <span className="text-gray-600 dark:text-gray-400">
            Truck Routes: {vehicleClass.preferTruckRoutes ? 'Preferred' : 'Standard'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400" />
          <span className="text-gray-600 dark:text-gray-400">
            Min Turn Radius: {vehicleClass.minTurningRadius}ft
          </span>
        </div>
      </div>
    </div>
  );
};
