import React, { useState } from 'react';
import { LocationSearch } from './location-search';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, ChevronRight, X, Route, BarChart2, Compass, Map, LocateFixed } from "lucide-react";

interface RouteGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: RouteGenerationParams) => void;
  mapboxToken: string;
  isGenerating?: boolean; // New prop to indicate loading state
  userLocation: [number, number] | null;
  isUserLocationLoading: boolean;
  userLocationError: string | null;
}

export type LoopDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'ANY';
const loopDirections: LoopDirection[] = ['ANY', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export interface RouteGenerationParams {
  routeType: 'a-to-b' | 'loop';
  startPoint?: { lat: number; lng: number; name: string };
  endPoint?: { lat: number; lng: number; name: string };
  surfaceType: 'paved' | 'mixed' | 'unpaved';
  loopLengthKm?: number;
  loopDirection?: LoopDirection;
}

export function RouteGeneratorModal({ 
  isOpen, 
  onClose, 
  onGenerate, 
  mapboxToken, 
  isGenerating = false, 
  userLocation, 
  isUserLocationLoading, 
  userLocationError 
}: RouteGeneratorModalProps) {
  const [routeType, setRouteType] = useState<'a-to-b' | 'loop'>('a-to-b');
  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number; name: string } | undefined>(undefined);
  const [endPoint, setEndPoint] = useState<{ lat: number; lng: number; name: string } | undefined>(undefined);
  const [surfaceType, setSurfaceType] = useState<'paved' | 'mixed' | 'unpaved'>('paved');
  const [loopLengthKm, setLoopLengthKm] = useState<number | undefined>(undefined);
  const [loopDirection, setLoopDirection] = useState<LoopDirection>('ANY');

  const handleGenerate = () => {
    if (routeType === 'a-to-b' && (!startPoint || !endPoint)) {
      alert('Please select a start and end point for A-to-B route.');
      return;
    }
    if (routeType === 'loop' && (!startPoint || !loopLengthKm || loopLengthKm <= 0)) {
      alert('Please select a start point and a valid approximate length (must be > 0 km) for a loop route.');
      return;
    }

    onGenerate({
      routeType,
      startPoint,
      endPoint: routeType === 'a-to-b' ? endPoint : undefined,
      surfaceType,
      loopLengthKm: routeType === 'loop' ? loopLengthKm : undefined,
      loopDirection: routeType === 'loop' ? loopDirection : undefined,
    });
    // Don't close the modal here - leave it open for loading animation
    // The parent component will close it when generation is complete
  };
  
  const handleLoopLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valueString = e.target.value;
    if (valueString === '') {
      setLoopLengthKm(undefined);
      return;
    }
    const numValue = parseFloat(valueString);
    if (!isNaN(numValue)) {
      if (numValue > 500) {
        setLoopLengthKm(500);
      } else if (numValue < 0) { // Keep 0 as a possible input during typing, validation on generate button
        setLoopLengthKm(0);
      } else {
        setLoopLengthKm(numValue);
      }
    } 
    // If isNaN, do nothing, keeping the previous valid state or undefined
  };

  if (!isOpen) {
    return null;
  }

  // Determine if generate button should be disabled
  let isGenerateDisabled = isGenerating;
  if (!isGenerating) {
    if (routeType === 'a-to-b') {
      isGenerateDisabled = !startPoint || !endPoint;
    } else if (routeType === 'loop') {
      isGenerateDisabled = !startPoint || !loopLengthKm || loopLengthKm <= 0;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && !isGenerating && onClose()}>
      <DialogContent className="p-0 w-[330px] sm:max-w-[525px] sm:w-[525px] border-r" hideCloseButton>
        {/* Header */}
        <div className="border-b border-gray-100 dark:border-gray-800 relative px-4 py-4 pb-3">
          {/* Close Button */}
          <div className="absolute top-3 right-3 z-10">
            <DialogClose className="text-gray-400 hover:text-gray-500 transition-colors duration-150" disabled={isGenerating}>
              <X size={18} />
            </DialogClose>
          </div>
          
          <div className="flex items-center pr-8">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
              <Route size={16} />
            </div>
            <DialogTitle className="text-base font-medium m-0 p-0">
              {isGenerating ? 'Generating Route...' : 'Create Custom Route'}
            </DialogTitle>
          </div>
        </div>
        
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-5 px-6">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Loader2 className="w-9 h-9 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium mb-1">
                {routeType === 'a-to-b' 
                  ? 'Creating your A-to-B route...' 
                  : `Generating a ${loopLengthKm}km loop route...`}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This may take a few moments as we explore the best options.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
              {/* Route Type Selection */}
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Route Type</div>
                <RadioGroup
                  value={routeType}
                  onValueChange={(value: string) => {
                    const newRouteType = value as 'a-to-b' | 'loop';
                    setRouteType(newRouteType);
                    if (newRouteType === 'loop') {
                      setEndPoint(undefined);
                    } else {
                      setLoopLengthKm(undefined);
                      setLoopDirection('ANY');
                    }
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <Label htmlFor="r1" className={`flex flex-col items-center justify-center p-3 rounded-md border ${routeType === 'a-to-b' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-800'} cursor-pointer w-full h-full`}>
                    <RadioGroupItem value="a-to-b" id="r1" className="sr-only" />
                    <MapPin className={`w-5 h-5 mb-1 ${routeType === 'a-to-b' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span className={`text-sm font-medium ${routeType === 'a-to-b' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>A to B</span>
                  </Label>
                  <Label htmlFor="r2" className={`flex flex-col items-center justify-center p-3 rounded-md border ${routeType === 'loop' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-800'} cursor-pointer w-full h-full`}>
                    <RadioGroupItem value="loop" id="r2" className="sr-only" /> 
                    <Route className={`w-5 h-5 mb-1 ${routeType === 'loop' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span className={`text-sm font-medium ${routeType === 'loop' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>Loop</span>
                  </Label>
                </RadioGroup>
              </div>

              {/* Location Inputs */}
              <div className="mt-5">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Location{routeType === 'a-to-b' ? 's' : ''}</div>
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mr-2">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <Label htmlFor="startPointSearch" className="text-sm">{routeType === 'a-to-b' ? 'Start Point' : 'Start/End Point'}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-grow">
                        <LocationSearch 
                          mapboxToken={mapboxToken} 
                          onSelectLocation={setStartPoint} 
                          currentValue={startPoint?.name}
                        />
                      </div>
                      <Button 
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 flex-shrink-0 border-gray-300 dark:border-gray-600"
                        onClick={() => {
                          if (userLocation) {
                            setStartPoint({ lat: userLocation[1], lng: userLocation[0], name: 'My Current Location' });
                          }
                        }}
                        disabled={isUserLocationLoading || !userLocation || !!userLocationError}
                        title={isUserLocationLoading ? "Fetching location..." : userLocationError ? `Location error: ${userLocationError}` : !userLocation ? "Location not available" : "Use my current location"}
                      >
                        <LocateFixed size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Fixed-height placeholder for conditional content */}
                  <div className="h-20"> {/* Changed from h-24 to h-20 (80px) */}
                    {routeType === 'a-to-b' && (
                      <div className="grid gap-1.5"> {/* End Point Content */}
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mr-2">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <Label htmlFor="endPointSearch" className="text-sm">End Point</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-grow">
                            <LocationSearch 
                              mapboxToken={mapboxToken} 
                              onSelectLocation={setEndPoint} 
                              currentValue={endPoint?.name}
                            />
                          </div>
                          <Button 
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 flex-shrink-0 border-gray-300 dark:border-gray-600"
                            onClick={() => {
                              if (userLocation) {
                                setEndPoint({ lat: userLocation[1], lng: userLocation[0], name: 'My Current Location' });
                              }
                            }}
                            disabled={isUserLocationLoading || !userLocation || !!userLocationError}
                            title={isUserLocationLoading ? "Fetching location..." : userLocationError ? `Location error: ${userLocationError}` : !userLocation ? "Location not available" : "Use my current location"}
                          >
                            <LocateFixed size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                    {routeType === 'loop' && (
                      <div className="grid grid-cols-2 gap-3"> {/* Loop Settings Content */}
                        <div className="grid gap-1.5"> {/* Length Input */}
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 mr-2">
                              <BarChart2 className="w-3.5 h-3.5" />
                            </div>
                            <Label htmlFor="loopLengthKm" className="text-sm">Length (km)</Label>
                          </div>
                          <Input 
                            id="loopLengthKm" 
                            type="number" 
                            placeholder="e.g., 25" 
                            value={loopLengthKm === undefined ? '' : String(loopLengthKm)}
                            onChange={handleLoopLengthChange}
                            className="border-gray-300 dark:border-gray-600"
                          />
                        </div>
                        <div className="grid gap-1.5"> {/* Direction Select */}
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mr-2">
                              <Compass className="w-3.5 h-3.5" />
                            </div>
                            <Label htmlFor="loopDirection" className="text-sm">Direction</Label>
                          </div>
                          <Select value={loopDirection} onValueChange={(value: string) => setLoopDirection(value as LoopDirection)}>
                            <SelectTrigger id="loopDirection" className="border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder="Select direction" />
                            </SelectTrigger>
                            <SelectContent>
                              {loopDirections.map(dir => (
                                <SelectItem key={dir} value={dir}>{dir === 'ANY' ? 'Any Direction' : dir}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preferences */} 
              <div className="mt-5 pb-6">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Surface Preference</div>
                <div className="grid gap-1.5">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-2">
                      <Map className="w-3.5 h-3.5" />
                    </div>
                    <Label htmlFor="surfaceTypeGenModal" className="text-sm">Terrain Type</Label>
                  </div>
                  <Select value={surfaceType} onValueChange={(value: string) => setSurfaceType(value as 'paved' | 'mixed' | 'unpaved')}>
                    <SelectTrigger id="surfaceTypeGenModal" className="border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Select surface type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paved">Prefer Paved Roads</SelectItem>
                      <SelectItem value="mixed">Mixed Surfaces</SelectItem>
                      <SelectItem value="unpaved">Prefer Unpaved & Trails</SelectItem> 
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
              <div className="flex justify-between gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 h-10 border-gray-300 dark:border-gray-600"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button 
                  type="button" 
                  onClick={handleGenerate} 
                  disabled={isGenerateDisabled}
                  className="flex-1 h-10 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                >
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
          </>
        )}
        
        {isGenerating && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Please wait while we create your route
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 