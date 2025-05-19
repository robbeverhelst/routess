import { useState } from 'react';
import { LocationSearch } from './location-search';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

interface RouteGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: RouteGenerationParams) => void;
  mapboxToken: string;
}

export interface RouteGenerationParams {
  routeType: 'a-to-b' | 'loop';
  startPoint?: { lat: number; lng: number; name: string };
  endPoint?: { lat: number; lng: number; name: string };
  surfaceType: 'paved' | 'mixed' | 'unpaved';
}

export function RouteGeneratorModal({ isOpen, onClose, onGenerate, mapboxToken }: RouteGeneratorModalProps) {
  const [routeType, setRouteType] = useState<'a-to-b' | 'loop'>('a-to-b');
  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number; name: string } | undefined>(undefined);
  const [endPoint, setEndPoint] = useState<{ lat: number; lng: number; name: string } | undefined>(undefined);
  const [surfaceType, setSurfaceType] = useState<'paved' | 'mixed' | 'unpaved'>('paved');

  const handleGenerate = () => {
    if (routeType === 'a-to-b' && (!startPoint || !endPoint)) {
      // Consider using a toast or inline error message instead of alert for better UX with Shadcn
      alert('Please select a start and end point for A-to-B route.');
      return;
    }
    onGenerate({
      routeType,
      startPoint,
      endPoint,
      surfaceType,
    });
    onClose(); // Close the modal after attempting generation
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Generate Custom Route</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Route Type Selection */}
          <div className="grid gap-2">
            <Label className="font-semibold">Route Type:</Label>
            <RadioGroup
              value={routeType}
              onValueChange={(value: string) => setRouteType(value as 'a-to-b' | 'loop')}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="a-to-b" id="r1" />
                <Label htmlFor="r1">Point A to B</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="loop" id="r2" disabled />
                <Label htmlFor="r2" className="text-muted-foreground">Loop (Coming Soon)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Location Inputs */}
          {routeType === 'a-to-b' && (
            <div className="grid gap-3">
              <Label className="font-semibold">Locations:</Label>
              <div className="grid gap-1.5">
                <Label htmlFor="startPointSearch">Start Point (A):</Label>
                <LocationSearch 
                  mapboxToken={mapboxToken} 
                  onSelectLocation={setStartPoint} 
                  currentValue={startPoint?.name}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="endPointSearch">End Point (B):</Label>
                <LocationSearch 
                  mapboxToken={mapboxToken} 
                  onSelectLocation={setEndPoint} 
                  currentValue={endPoint?.name}
                />
              </div>
            </div>
          )}

          {/* Preferences */}
          <div className="grid gap-2">
            <Label htmlFor="surfaceTypeGenModal" className="font-semibold">Preferences:</Label>
            <Select value={surfaceType} onValueChange={(value: string) => setSurfaceType(value as 'paved' | 'mixed' | 'unpaved')}>
              <SelectTrigger id="surfaceTypeGenModal">
                <SelectValue placeholder="Select surface type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paved">Prefer Paved Roads</SelectItem>
                <SelectItem value="mixed">Mixed Surfaces</SelectItem>
                {/* <SelectItem value="unpaved" disabled>Prefer Unpaved & Trails (Coming Soon)</SelectItem> */}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            onClick={handleGenerate} 
            disabled={routeType === 'a-to-b' && (!startPoint || !endPoint)}
          >
            Generate Route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 