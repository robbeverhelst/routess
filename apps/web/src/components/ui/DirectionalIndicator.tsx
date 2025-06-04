import React from 'react';

interface DirectionalIndicatorProps {
  direction: number; // Direction in degrees (0° = North, 90° = East, etc.)
  color: string; // Primary color for the indicator
  size?: number; // Size of the circular button (default: 44)
  beamLength?: number; // Length of the directional beam (default: 60)
  beamWidth?: number; // Width of the directional beam at base (default: 40)
  icon: React.ReactNode; // Icon to display in the center
  className?: string; // Additional CSS classes
}

export function DirectionalIndicator({
  direction,
  color,
  size = 44,
  beamLength = 60,
  beamWidth = 40,
  icon,
  className = ''
}: DirectionalIndicatorProps) {
  const normalizedDirection = ((direction % 360) + 360) % 360;

  return (
    <div className={`relative ${className}`}>
      {/* Directional beam extending from the button */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${normalizedDirection}deg)`,
          transformOrigin: 'center',
        }}
      >
        {/* Gradient beam using clip-path for triangular shape */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `-${size/2}px`, // Start from the edge of the circle
            width: `${beamWidth}px`,
            height: `${beamLength}px`,
            background: `linear-gradient(to top, transparent 0%, ${color}40 40%, ${color}80 70%, ${color} 100%)`, // Strong at tip, fade toward circle
            clipPath: 'polygon(0% 100%, 100% 100%, 60% 0%, 40% 0%)', // Wide at bottom (circle), narrow at top (direction)
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Circular button */}
      <div 
        className="relative flex items-center justify-center backdrop-blur-sm border-2 border-white/90 dark:border-gray-200/90"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {/* Colored circle inside */}
        <div
          className="flex items-center justify-center"
          style={{
            width: `${size - 8}px`,
            height: `${size - 8}px`,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
} 