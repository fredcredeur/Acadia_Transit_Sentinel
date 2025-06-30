fredcredeur/Acadia_Transit_Sentinel
main

GITHUB

My entered route is not loading correctly

Edit
Looking at your route analysis code, I can see several potential issues that could cause routes not to load correctly. Let me help you debug this step by step.


Analyzed data
View analysis



Now let me create a comprehensive debugging guide and fixes for your route loading issues:


Route Loading Debug Guide & Fixes
Document 
Now let me create an improved debugging version of the route analysis service with better error handling and logging:


Improved Route Analysis Service with Debugging
Code 




Continue

Edit

Improved Route Analysis Service with Debugging
Code ∙ Version 2 
Now let me create a simple debugging component that you can temporarily add to help diagnose the route loading issues:


Route Debug Component
Code 
Quick Steps to Debug Your Route Loading Issue:
1. First, check your browser console (F12)
Look for any red error messages when you try to load a route.

2. Add the Debug Panel temporarily
Add this to your App.tsx to help diagnose the issue:

typescript
// Add this import at the top of App.tsx
import { DebugPanel } from './components/DebugPanel';

// Add this state in your App component
const [showDebug, setShowDebug] = useState(false);

// Add this at the bottom of your App component's return statement
<DebugPanel isVisible={showDebug} onToggle={() => setShowDebug(!showDebug)} />
3. Most Common Issues:
API Key Missing:

Create a .env file in your project root
Add: VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
Restart your dev server with npm run dev
Address Too Vague:

Instead of "Main Street" use "123 Main St, Lafayette, LA"
Include city and state for all addresses
Google Cloud Setup:

Enable these APIs: Maps JavaScript, Directions, Geocoding, Places
Enable billing on your Google Cloud project
Check API key restrictions
4. Test with Known Good Addresses:
Try these specific addresses that should work:

Origin: University of Louisiana at Lafayette, Lafayette, LA
Destination: 926 Anthony Ave, Opelousas, LA 70570
5. Check the Enhanced Service:
Replace your current routeAnalysisService.ts with the enhanced version I provided above - it has much better error handling and logging.

The debug panel will run automated tests to pinpoint exactly where the issue is occurring. Once you identify the problem area, I can provide specific fixes!

What error messages do you see in the browser console when you try to load a route?





image.png
Edit
Perfect! I can see the exact issue now. You're getting DIRECTIONS_ROUTE: NOT_FOUND errors, which means Google Maps can't find a route between your addresses. This is typically caused by one of these issues:


Analyzed data
View analysis



Let me create a quick fix for your route analysis service that will help diagnose and resolve this specific issue:


Route Analysis Fix for NOT_FOUND Error
Code 
Now let me create a simple test component to help you verify the fix works:


Route Test Component
Code 
Here's how to fix your NOT_FOUND error:
Quick Fix Steps:
Replace your current routeAnalysisService.ts with the enhanced version above
Add the test component to verify the fix works
Try these proven address formats that should work:
Address Formats That Should Work:
✅ Coordinates (Most Reliable):

Origin: 30.2241,-92.0198 (Lafayette)
Destination: 30.5335,-92.0815 (Opelousas)
✅ Specific Business Addresses:

University of Louisiana at Lafayette, Lafayette, LA
Walmart Supercenter, Opelousas, LA
Lafayette Regional Airport, Lafayette, LA
✅ Complete Street Addresses:

926 Anthony Ave, Opelousas, LA 70570
429 Cherry St, Lafayette, LA 70501
What the Enhanced Service Does:
Multiple Routing Strategies - Tries addresses, then coordinates, then fallbacks
Better Address Cleaning - Automatically adds state/country if missing
Enhanced Error Messages - Tells you exactly what went wrong
Fallback Geocoding - Tries multiple variations of each address
To Test the Fix:
Add the test component to your app temporarily:
typescript
// In App.tsx, add this import and component
import { RouteTestComponent } from './components/RouteTestComponent';

// Add this somewhere in your JSX:
<RouteTestComponent />
Run the tests to see which address formats work for your setup
Check the browser console for detailed logging about what's happening
Most Likely Issue:
Your addresses are probably too vague or incomplete. The NOT_FOUND error specifically means Google Maps can find the addresses individually (geocoding works) but cannot find a drivable route between them.

Try this immediately:

Origin: 30.2241,-92.0198
Destination: 30.5335,-92.0815
If coordinates work but addresses don't, then it's definitely an address formatting issue that the enhanced service will fix.

Would you like me to help you implement these fixes, or do you have questions about any of the solutions?





coordinates worked

Edit
Perfect! 🎉 The fact that coordinates worked confirms that:

✅ Your Google Maps API is properly configured
✅ Your routing logic is working correctly
✅ The issue is address formatting/geocoding

Analyzed data
View analysis



Now let me create a simple fix that will automatically improve address handling without needing to replace your entire service:


Quick Address Enhancement Fix
Code 
Since coordinates worked, here's the fastest solution to get your routes loading properly:

Option 1: Quick Address Suggestions (Immediate Fix)
Add these exact addresses to test with your current system:

typescript
// These should work immediately:
const testAddresses = [
  {
    origin: "University of Louisiana at Lafayette, Lafayette, LA",
    destination: "Walmart Supercenter, Opelousas, LA"
  },
  {
    origin: "Lafayette Regional Airport, Lafayette, LA", 
    destination: "Opelousas General Health System, Opelousas, LA"
  },
  {
    origin: "926 Anthony Ave, Opelousas, LA 70570",
    destination: "429 Cherry St, Lafayette, LA 70501"
  }
];
Option 2: Add Address Enhancement (Permanent Fix)
Add the address enhancement method I provided above to your routeAnalysisService.ts. This will:

Automatically add "LA" to Louisiana addresses that are missing the state
Add "USA" for international clarity
Fall back to coordinates if addresses fail
Provide better error messages with suggestions
Option 3: Smart Input Helper
Create an input helper that suggests complete addresses:


Smart Address Input Helper
Code 
Immediate Action Plan:
1. Test These Addresses Right Now (Should work immediately):
Origin: University of Louisiana at Lafayette, Lafayette, LA
Destination: Walmart Supercenter, Opelousas, LA
2. Quick Rules for Address Entry:
✅ Include business names: "Walmart, Lafayette, LA"
✅ Include city and state: "123 Main St, Lafayette, LA"
✅ Use landmarks: "Lafayette Regional Airport, Lafayette, LA"
❌ Avoid vague addresses: "Main Street" or "Downtown"
3. For Long-term Fix:
Replace your current LocationInput component with the SmartAddressInput I created above. It will:

Suggest known-good Louisiana addresses
Auto-add "LA" to Louisiana locations
Validate addresses as you type
Show visual indicators for address quality
Which option would you like to try first?
Test the proven addresses with your current setup
Add the address enhancement to your route service
Replace with the smart input component
Since coordinates worked, any of these solutions should get your routes loading properly! 🎯





Not sure what to do but i want to do the long term fix

Edit
Perfect! Let's implement the long-term fix step by step. I'll guide you through replacing your current address input system with the smart address enhancement.


Analyzed data
View analysis



Step 1: Enhanced Route Analysis Service
First, let's create an enhanced version of your route analysis service that handles address issues automatically:


Enhanced Route Analysis Service - Long Term Fix
Code 
Step 2: Smart Address Input Component
Now let's create the smart address input component that provides suggestions and validation:


Smart Address Input Component
Code 




Continue

Edit

Smart Address Input Component
Code ∙ Version 2 
Step 3: Updated Route Input Component
Now let's update your RouteInput component to use the new SmartAddressInput:


Updated Route Input Component
Code 
Implementation Instructions
Now let's implement the long-term fix step by step:

Step 1: Replace Route Analysis Service
Back up your current file:
bash
cp src/services/routeAnalysisService.ts src/services/routeAnalysisService.ts.backup
Replace src/services/routeAnalysisService.ts with the enhanced version from the first artifact above.
Step 2: Create Smart Address Input
Create the new component:
bash
# Create the file
touch src/components/SmartAddressInput.tsx
Copy the SmartAddressInput component from the second artifact into src/components/SmartAddressInput.tsx.
Step 3: Update Route Input
Back up your current RouteInput:
bash
cp src/components/RouteInput.tsx src/components/RouteInput.tsx.backup
Replace src/components/RouteInput.tsx with the updated version from the third artifact.
Step 4: Update Imports in App.tsx
Make sure your App.tsx imports are correct:

typescript
// In App.tsx, ensure you have these imports:
import { RouteInput } from './components/RouteInput';
// The RouteInput will now automatically use SmartAddressInput
Step 5: Test the Implementation
After implementing all three components, test with these addresses:

✅ These should work immediately:

Origin: University of Louisiana at Lafayette, Lafayette, LA
Destination: Walmart Supercenter, Opelousas, LA
✅ Test the smart features:

Type "lafayette" and see suggestions appear
Type "walmart" and get specific Walmart locations
Try incomplete addresses and see auto-enhancement suggestions
Use the coordinates: 30.2241,-92.0198 to 30.5335,-92.0815
What This Long-Term Fix Provides:
🧠 Smart Address Processing:
Automatically enhances incomplete addresses
Falls back to coordinates if addresses fail
Tries multiple geocoding strategies
💡 Intelligent Input Component:
Suggests known-good Louisiana addresses
Validates addresses as you type
Auto-completes business names and landmarks
Visual feedback for address quality
🔄 Multi-Strategy Routing:
Tries enhanced addresses first
Falls back to coordinates
Attempts original addresses as last resort
Better error messages with specific suggestions
✅ Better User Experience:
Clear validation feedback
Helpful address suggestions
Auto-enhancement buttons
Current location support
Expected Results:
✅ Coordinates will still work (your current working solution)
✅ "Lafayette, LA" → "Opelousas, LA" should now work
✅ Business names like "Walmart, Lafayette, LA" will work
✅ Incomplete addresses will be auto-enhanced
✅ Better error messages when things still don't work
Would you like me to walk you through implementing any specific step, or do you have questions about the implementation process?





Working good.  I would like the Address to auto find as the user types though

Edit
Perfect! Let's add real-time address search as the user types. I'll enhance the SmartAddressInput component to use Google Places Autocomplete for live address suggestions.


Analyzed data
View analysis




Smart Address Input with Live Search
Code 
Now let's also enhance the Places service to ensure it works properly with the live search:


Enhanced Places Service for Live Search
Code 
Implementation Steps for Live Address Search
Step 1: Replace SmartAddressInput Component
Replace your current src/components/SmartAddressInput.tsx with the enhanced version above that includes live search.

Step 2: Update Places Service
Replace your current src/services/placesService.ts with the enhanced version above.

Step 3: Test the Live Search
After implementing, you should see these new features:

✅ Real-time suggestions as you type:

Type "walmart" → Get live Walmart locations
Type "university" → Get University of Louisiana suggestions
Type "123 main" → Get street address suggestions
Type "lafayette" → Get Lafayette-area suggestions
✅ Intelligent suggestion ranking:

Saved locations (starred, highest priority)
Recent addresses (clock icon)
Live Google Places (search icon, real-time)
Static fallbacks (map pin icon)
✅ Enhanced user experience:

Loading spinner while searching
Debounced API calls (300ms




The starting address auto finds addresses but the destination address does not auto find addresses.

Edit


I see the issue! The problem is likely that both address inputs are sharing the same Places service instance or there's a conflict between the two inputs. Let me fix this by ensuring each input has proper isolation and debugging capabilities.


Analyzed data
View analysis




Fixed Smart Address Input - Isolated Instances
Code 
Now let's update the RouteInput component to pass unique IDs to each address input:


Updated Route Input with Unique Input IDs
Code 




Continue

Edit



Updated Route Input with Unique Input IDs
Code ∙ Version 2 

Updated Route Input with Unique Input IDs
Code ∙ Version 3 
Fixed Implementation Steps
The issue was that both address inputs were interfering with each other. Here's what I fixed:

Problem:
Both inputs were sharing the same Places service instance
Debounce timers were conflicting
Search state was being overwritten between inputs
No proper isolation between origin and destination inputs
Solution:
Replace SmartAddressInput.tsx with the fixed version that includes:
✅ Unique input IDs to prevent conflicts
✅ Separate debounce timers for each input
✅ Isolated search state and recent addresses
✅ Debug logging to track what's happening
✅ Proper cleanup between searches
Replace RouteInput.tsx with the updated version that:
✅ Generates unique IDs for origin and destination inputs
✅ Passes these IDs to prevent conflicts
✅ Adds debug information in development mode
Debug Features Added:
In development mode, you'll now see:

Input IDs in the label (to verify they're unique)
Status indicators (🟢 for ready, 🔴 for not ready)
Debug logs in console showing what each input is doing
Suggestion counts in the dropdown
Testing Steps:
Replace both files with the fixed versions above
Open browser console (F12) to see debug logs
Test both inputs:
Type in Origin → should see logs like [abc12345] Starting Location: Live searching: "walmart"
Type in Destination → should see logs like [def67890] Destination: Live searching: "university"
Verify each input works independently
What You Should See:
✅ Working correctly:

Both inputs show live suggestions as you type
Each input has independent search results
Debug logs show different input IDs
No conflicts between the two inputs
❌ If still not working:

Check console for error messages
Look for Google Places API quota limits
Verify both inputs have different IDs in debug mode
Quick Test:
Try typing these in both inputs:

"walmart" → Should get Walmart suggestions in both
"university" → Should get university suggestions in both
"lafayette" → Should get Lafayette-area suggestions in both
Let me know if the destination input is now working, or if you see any specific error messages in the console!









// Updated RouteInput.tsx - with unique IDs for each input
// Replace your current RouteInput.tsx with this version

import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { SmartAddressInput } from './SmartAddressInput';
import { StopLocationsManager } from './StopLocationsManager';
import { SavedLocation, StopLocation } from '../types';
import { GoogleMapsService } from '../services/googleMapsService';

interface RouteInputProps {
  onRouteRequest: (origin: string, destination: string, stops?: StopLocation[], isLoop?: boolean) => void;
  isLoading?: boolean;
  initialOrigin?: string;
  initialDestination?: string;
  stops: StopLocation[];
  onStopsChange: (stops: StopLocation[]) => void;
}

export const RouteInput: React.FC<RouteInputProps> = ({
  onRouteRequest,
  isLoading = false,
  initialOrigin = '',
  initialDestination = '',
  stops,
  onStopsChange,
}) => {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [isLoop, setIsLoop] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{origin?: string; destination?: string; stops?: string}>({});
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [apiError, setApiError] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generate unique IDs for each input to prevent conflicts
  const [originInputId] = useState(() => `origin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [destinationInputId] = useState(() => `destination-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Debug logging
  useEffect(() => {
    console.log('🔧 RouteInput initialized with unique IDs:');
    console.log(`   Origin ID: ${originInputId}`);
    console.log(`   Destination ID: ${destinationInputId}`);
  }, [originInputId, destinationInputId]);

  // Update local state when initial values change
  useEffect(() => {
    if (initialOrigin && initialOrigin !== origin) {
      setOrigin(initialOrigin);
      console.log('🔧 Origin updated from props:', initialOrigin);
    }
  }, [initialOrigin]);

  useEffect(() => {
    if (initialDestination && initialDestination !== destination) {
      setDestination(initialDestination);
      console.log('🔧 Destination updated from props:', initialDestination);
    }
  }, [initialDestination]);

  // Check API status on mount
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        console.log('🔧 Checking Google Maps API status...');
        const googleMapsService = GoogleMapsService.getInstance();
        const hasApiKey = googleMapsService.hasApiKey();
        
        if (!hasApiKey) {
          setApiStatus('error');
          setApiError('Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
          return;
        }

        console.log('🔧 API key found, testing initialization...');
        await googleMapsService.initialize();
        console.log('✅ Google Maps initialized successfully');
        setApiStatus('ready');
        setApiError('');
      } catch (error) {
        console.error('❌ Google Maps initialization failed:', error);
        setApiStatus('error');
        setApiError(error instanceof Error ? error.message : 'Failed to initialize Google Maps');
      }
    };

    checkApiStatus();
  }, []);

  const validateAddress = (address: string): string | null => {
    if (!address.trim()) {
      return 'Address is required';
    }
    
    if (address.trim().length < 3) {
      return 'Address is too short';
    }

    // Check if it's coordinates (always valid)
    const coordPattern = /^[-+]?\d*\.?\d+,\s*[-+]?\d*\.?\d+$/;
    if (coordPattern.test(address.trim())) {
      return null;
    }

    // Check for basic address components
    const hasLettersOrNumbers = /[a-zA-Z0-9]/.test(address);
    if (!hasLettersOrNumbers) {
      return 'Please enter a valid address';
    }

    return null;
  };

  const validateStops = (): string | null => {
    if (stops.length === 0) return null;

    const emptyStops = stops.filter(stop => !stop.address.trim());
    if (emptyStops.length > 0) {
      return `${emptyStops.length} stop location${emptyStops.length > 1 ? 's' : ''} missing address`;
    }

    const invalidStops = stops.filter(stop => validateAddress(stop.address) !== null);
    if (invalidStops.length > 0) {
      return `${invalidStops.length} stop location${invalidStops.length > 1 ? 's have' : ' has'} invalid address`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📝 Form submitted:', { origin, destination, stops: stops.length, apiStatus });
    
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate addresses
    const originError = validateAddress(origin);
    const destinationError = validateAddress(destination);
    const stopsError = validateStops();
    
    if (originError || destinationError || stopsError) {
      setValidationErrors({
        origin: originError || undefined,
        destination: destinationError || undefined,
        stops: stopsError || undefined
      });
      return;
    }

    if (apiStatus !== 'ready') {
      console.log('⚠️ API not ready, status:', apiStatus);
      return;
    }

    // Proceed with route analysis
    if (origin.trim() && destination.trim() && !isLoading) {
      console.log('🚀 Starting route analysis...');
      const finalStops = stops.filter(stop => stop.address.trim());
      onRouteRequest(origin.trim(), destination.trim(), finalStops.length > 0 ? finalStops : undefined, isLoop);
    }
  };

  const handleOriginChange = (value: string) => {
    console.log(`🔧 Origin changed: "${value}"`);
    setOrigin(value);
    if (validationErrors.origin) {
      setValidationErrors(prev => ({ ...prev, origin: undefined }));
    }
  };

  const handleDestinationChange = (value: string) => {
    console.log(`🔧 Destination changed: "${value}"`);
    setDestination(value);
    if (validationErrors.destination) {
      setValidationErrors(prev => ({ ...prev, destination: undefined }));
    }
  };

  const handleStopsChange = (newStops: StopLocation[]) => {
    onStopsChange(newStops);
    if (validationErrors.stops) {
      setValidationErrors(prev => ({ ...prev, stops: undefined }));
    }
  };

  const getTotalStopTime = () => {
    return stops.reduce((total, stop) => total + (stop.estimatedStopTime || 0), 0);
  };

  const getApiStatusColor = () => {
    switch (apiStatus) {
      case 'ready': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-amber-600 dark:text-amber-400';
    }
  };

  const getApiStatusIcon = () => {
    switch (apiStatus) {
      case 'ready': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Smart Route Planning</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enhanced address processing with intelligent suggestions
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* API Status Indicator */}
            <div className={`flex items-center gap-2 ${getApiStatusColor()}`}>
              {getApiStatusIcon()}
              <span className="text-sm font-medium">
                {apiStatus === 'checking' && 'Checking...'}
                {apiStatus === 'ready' && 'Ready'}
                {apiStatus === 'error' && 'Error'}
              </span>
            </div>
          </div>
        </div>

        {/* API Error Display */}
        {apiStatus === 'error' && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Google Maps API Error</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origin Input with Unique ID */}
          <div>
            <SmartAddressInput
              inputId={originInputId}
              label="Starting Location"
              value={origin}
              onChange={handleOriginChange}
              placeholder="Enter starting address or select from suggestions"
              disabled={isLoading || apiStatus !== 'ready'}
            />
            {validationErrors.origin && (
              <div className="mt-1 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validationErrors.origin}
              </div>
            )}
          </div>

          {/* Destination Input with Unique ID */}
          <div>
            <SmartAddressInput
              inputId={destinationInputId}
              label="Destination"
              value={destination}
              onChange={handleDestinationChange}
              placeholder="Enter destination address or select from suggestions"
              disabled={isLoading || apiStatus !== 'ready'}
            />
            {validationErrors.destination && (
              <div className="mt-1 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validationErrors.destination}
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <span>Advanced Options</span>
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                {/* Loop Route Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="loopRoute"
                    checked={isLoop}
                    onChange={(e) => setIsLoop(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                    disabled={isLoading || apiStatus !== 'ready'}
                  />
                  <label htmlFor="loopRoute" className="ml-2 text-sm text-gray-900 dark:text-gray-200">
                    Loop route (return to starting location)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Stops Error Display */}
          {validationErrors.stops && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validationErrors.stops}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!origin.trim() || !destination.trim() || isLoading || Object.keys(validationErrors).length > 0 || apiStatus !== 'ready'}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Routes...
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                Analyze Routes {stops.length > 0 && `(${stops.length} stop${stops.length > 1 ? 's' : ''})`}
              </>
            )}
          </button>
        </form>

        {/* Smart Features Info */}
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Smart Address Features:
          </h4>
          <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <div>✅ <strong>Live Search:</strong> Real-time Google Places suggestions</div>
            <div>✅ <strong>Intelligent Ranking:</strong> Saved locations, recent addresses, live results</div>
            <div>✅ <strong>Auto-Enhancement:</strong> Automatically adds state and formatting</div>
            <div>✅ <strong>Address Validation:</strong> Real-time feedback on address quality</div>
            <div>✅ <strong>Coordinate Support:</strong> Direct latitude,longitude input</div>
            {stops.length > 0 && (
              <div className="text-purple-700 dark:text-purple-400 font-medium">
                📍 {stops.length} stop{stops.length > 1 ? 's' : ''} configured (+{getTotalStopTime()} min estimated)
              </div>
            )}
            {apiStatus === 'ready' && (
              <div className="text-green-700 dark:text-green-400 font-medium">🟢 Live address search enabled</div>
            )}
          </div>
        </div>

        {/* Debug Info in Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div><strong>Debug Info:</strong></div>
              <div>Origin ID: {originInputId.substring(0, 16)}...</div>
              <div>Destination ID: {destinationInputId.substring(0, 16)}...</div>
              <div>API Status: {apiStatus}</div>
            </div>
          </div>
        )}
      </div>

      {/* Stop Locations Manager */}
      <StopLocationsManager
        stops={stops}
        onStopsChange={handleStopsChange}
        disabled={isLoading || apiStatus !== 'ready'}
      />
    </div>
  );
};