import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Timer, Route, Flame, Leaf, Wind } from "lucide-react";

interface RouteDetailsProps {
  routeDistance: string;
  routeDuration: string;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function RouteDetails({
  routeDistance,
  routeDuration,
  expanded,
  onToggleExpand
}: RouteDetailsProps) {
  // Extract numeric values for calculations
  const distanceNum = parseFloat(routeDistance.replace(/[^0-9.]/g, '')) || 0;
  const durationNum = parseInt(routeDuration.replace(/[^0-9]/g, '')) || 0;
  
  // Calculate additional metrics
  const avgSpeed = durationNum > 0 ? (distanceNum / (durationNum / 60)).toFixed(1) : '0';
  const caloriesBurned = Math.round(distanceNum * 65); // Rough estimate: ~65 calories per km walking
  const carbonSaved = (distanceNum * 0.2).toFixed(1); // Rough estimate: ~0.2 kg CO2 saved per km vs driving

  return (
    <Card className={`shadow-md bg-background/95 backdrop-blur-sm border transition-all duration-200 ${expanded ? 'w-64' : 'w-48'}`}>
      <CardContent className={`p-3 relative`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-slate-800">Route Info</h3>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-6 w-6 hover:bg-slate-100"
            onClick={onToggleExpand}
            aria-label={expanded ? "Collapse route details" : "Expand route details"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>

        <div className="space-y-2">
          {/* Main metrics - always visible */}
          <div className="flex items-center gap-2">
            <Route size={16} className="text-blue-500 shrink-0" />
            <div>
              <span className="font-medium">{routeDistance}</span>
              {expanded && <span className="text-xs text-slate-500 ml-1">distance</span>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-amber-500 shrink-0" />
            <div>
              <span className="font-medium">{routeDuration}</span>
              {expanded && <span className="text-xs text-slate-500 ml-1">duration</span>}
            </div>
          </div>
          
          {/* Additional metrics - only visible when expanded */}
          {expanded && (
            <>
              <hr className="my-2 border-slate-200" />
              
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-red-500 shrink-0" />
                <div>
                  <span className="font-medium">{caloriesBurned}</span>
                  <span className="text-xs text-slate-500 ml-1">calories burned</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Wind size={16} className="text-indigo-500 shrink-0" />
                <div>
                  <span className="font-medium">{avgSpeed} km/h</span>
                  <span className="text-xs text-slate-500 ml-1">average speed</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Leaf size={16} className="text-green-500 shrink-0" />
                <div>
                  <span className="font-medium">{carbonSaved} kg</span>
                  <span className="text-xs text-slate-500 ml-1">CO₂ saved</span>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 