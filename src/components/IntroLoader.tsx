"use client";
import React, { useState, useEffect } from "react";
import { usePortfolio } from "@/context/context";

export default function IntroLoader() {
  const { introFinished, finishIntro, data } = usePortfolio();
  const [progress, setProgress] = useState(0);
  const [isSlidingUp, setIsSlidingUp] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (introFinished) {
      setIsDone(true);
      return;
    }

    // Smooth luxury progress counter
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Accelerate smoothly
        const increment = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + increment, 100);
      });
    }, 45);

    return () => clearInterval(interval);
  }, [introFinished]);

  useEffect(() => {
    if (progress === 100 && !isDone) {
      const timer = setTimeout(() => {
        setIsSlidingUp(true);
        const exitTimer = setTimeout(() => {
          setIsDone(true);
          finishIntro();
        }, 900);
        return () => clearTimeout(exitTimer);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [progress, isDone, finishIntro]);

  if (isDone || introFinished) return null;

  const formattedProgress = progress < 10 ? `0${progress}` : `${progress}`;

  return (
    <div
      className={`fixed inset-0 z-[999999] flex flex-col justify-between p-8 sm:p-16 bg-[#100e0b] text-[#f0fdfa] transition-transform duration-900 ease-[cubic-bezier(0.76,0,0.24,1)] ${
        isSlidingUp ? "-translate-y-full" : "translate-y-0"
      }`}
      aria-label="Loading portfolio"
    >
      {/* Top Header info */}
      <div className="flex justify-between items-center text-xs font-mono tracking-widest uppercase opacity-60">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          Monzurul Islam · Portfolio
        </span>
        <span>{new Date().getFullYear()}</span>
      </div>

      {/* Center: Luxury Name Reveal & Tracking Typography */}
      <div className="my-auto text-center space-y-6">
        {/* Name with character tracking expansion animation */}
        <div className="overflow-hidden py-2">
          <h1 className="font-outfit text-3xl sm:text-6xl md:text-7xl font-bold tracking-[0.25em] sm:tracking-[0.35em] uppercase text-gradient animate-pulse-slow">
            {data.name.split("").join(" ")}
          </h1>
        </div>

        {/* Subheading Title */}
        <p className="font-outfit text-xs sm:text-sm md:text-base tracking-[0.3em] uppercase opacity-75 text-secondary">
          {data.designation} · Backend & Full Stack
        </p>

        {/* Minimalist Glowing Progress Line */}
        <div className="w-48 sm:w-72 h-[2px] bg-white/10 mx-auto rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-150 ease-out shadow-[0_0_12px_rgba(34,211,238,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom Counter & Status */}
      <div className="flex justify-between items-end text-xs font-mono">
        <span className="opacity-50 tracking-wider">INITIALIZING SESSION...</span>
        <div className="flex items-baseline gap-1 font-mono text-2xl sm:text-3xl font-bold text-primary">
          <span>{formattedProgress}</span>
          <span className="text-xs opacity-60">%</span>
        </div>
      </div>
    </div>
  );
}
