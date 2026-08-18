import React from "react";

export default function AuraBackground({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen w-full bg-base-100 text-base-content overflow-x-hidden ${className}`}>
      {/* Ambient Mesh Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [data-theme='light']:bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-[15%] left-[5%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-primary/10 dark:bg-primary/8 blur-[100px] pointer-events-none" />
        <div className="absolute top-[40%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-secondary/8 dark:bg-secondary/6 blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-[10%] left-[20%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-accent/6 dark:bg-accent/4 blur-[100px] pointer-events-none" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
