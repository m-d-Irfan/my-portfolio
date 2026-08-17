import React from "react";

interface AuraBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export default function AuraBackground({ children, className = "" }: AuraBackgroundProps) {
  return (
    <div className={`aura-bg ${className}`}>
      {/* Layer 1 - normal linear gradient */}
      <div className="aura-layer-1" aria-hidden="true" />
      
      {/* Layer 2 - screen/multiply radial violet glow */}
      <div className="aura-layer-2" aria-hidden="true" />
      
      {/* Layer 3 - screen/multiply radial indigo glow */}
      <div className="aura-layer-3" aria-hidden="true" />
      
      {/* Layer 4 - overlay/multiply linear shimmer */}
      <div className="aura-layer-4" aria-hidden="true" />
      
      {/* Content wrapper sitting ABOVE all gradient layers */}
      <div className="relative z-[1] flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
