import React from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Flag } from 'lucide-react';
import { Route, Vehicle, TruckRouteRestriction } from '../types';

interface GovernmentCompliancePanelProps {
  route: Route & {
    complianceAnalysis?: {
      compliant: boolean;
      violations: TruckRouteRestriction[];
      recommendations: string[];
      nationalNetworkCoverage: number;
    };
  };
  vehicle: Vehicle;
}

export const GovernmentCompliancePanel: React.FC<GovernmentCompliancePanelProps> = ({
  route,
  vehicle
}) => {
  if (!route.complianceAnalysis) return null;

  const { compliant, violations, recommendations, nationalNetworkCoverage } = route.complianceAnalysis;

  const getComplianceColor = () => {
    if (compliant) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'prohibition': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'restriction': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'advisory': return <Flag className="w-4 h-4 text-blue-600" />;
      default: return <Shield className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Government Compliance
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            FHWA • FMCSA • State DOT Analysis
          </p>
        </div>
        <div className="ml-auto">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getComplianceColor()}`}>
            {compliant ? (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                COMPLIANT
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                NON-COMPLIANT
              </div>
            )}
          </div>
        </div>
      </div>

      {/* National Network Coverage */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">National Network Coverage</span>
          <span className="text-gray-900 dark:text-white">{nationalNetworkCoverage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              nationalNetworkCoverage >= 70 ? 'bg-green-600' :
              nationalNetworkCoverage >= 50 ? 'bg-yellow-600' : 'bg-red-600'
            }`}
            style={{ width: `${nationalNetworkCoverage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {nationalNetworkCoverage >= 70 ? 'Excellent' :
           nationalNetworkCoverage >= 50 ? 'Acceptable' : 'Poor'} coverage of approved truck routes
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Violations Detected ({violations.length})
          </h4>
          <div className="space-y-2">
            {violations.slice(0, 3).map((violation, index) => (
              <div key={index} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-start gap-2">
                  {getSeverityIcon(violation.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {violation.type.toUpperCase()} {violation.severity.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {violation.description}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Source: {violation.source}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {violations.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{violations.length - 3} more violations
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Official Recommendations
          </h4>
          <div className="space-y-1">
            {recommendations.map((rec, index) => (
              <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                <div className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Analysis for: {vehicle.length}ft L × {vehicle.width}ft W × {vehicle.height}ft H vehicle
          {vehicle.length >= 40 && ' (Large Bus/Coach)'}
        </div>
      </div>
    </div>
  );
};
