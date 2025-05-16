import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Timer, Route } from "lucide-react";

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
  return (
    <Card className={`w-auto shadow-lg bg-background/95 backdrop-blur-sm border transition-all ${expanded ? 'w-64' : 'w-44'}`}>
      <CardContent className="px-4 py-3 relative">
        <Button 
          variant="ghost" 
          size="icon"
          className="absolute top-1 right-1 h-6 w-6"
          onClick={onToggleExpand}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </Button>
        
        {expanded && (
          <h3 className="text-lg font-bold mb-3 text-center">Route Details</h3>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-green-500" />
            <span className="font-medium">{routeDistance}</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-amber-500" />
            <span className="font-medium">{routeDuration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 