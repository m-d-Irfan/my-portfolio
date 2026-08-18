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

    // 3.4 seconds guaranteed precision timer using performance.now()
    const DURATION_MS = 3400;
    let animationFrameId: number;
    let startTimestamp: number | null = null;

    const animateProgress = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const calculatedProgress = Math.min(Math.floor((elapsed / DURATION_MS) * 100), 100);

      setProgress(calculatedProgress);

      if (elapsed < DURATION_MS) {
        animationFrameId = requestAnimationFrame(animateProgress);
      } else {
        setProgress(100);
        // Hold for 400ms at 100% before smoothly sliding up curtain
        setTimeout(() => {
          setIsSlidingUp(true);
          setTimeout(() => {
            setIsDone(true);
            finishIntro();
          }, 900);
        }, 400);
      }
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [introFinished, finishIntro]);

  if (isDone || introFinished) return null;

  const formattedProgress = progress < 10 ? `0${progress}` : `${progress}`;

  return (
    <div
      className={`fixed inset-0 w-screen h-screen z-[999999] overflow-hidden flex flex-col justify-between p-6 sm:p-16 bg-[#100e0b] text-[#f0fdfa] touch-none select-none transition-transform duration-900 ease-[cubic-bezier(0.76,0,0.24,1)] ${
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
      <div className="my-auto text-center space-y-4 sm:space-y-6 w-full max-w-full px-2">
        {/* Name with strict no-wrap per word, wide desktop gap, and adaptive mobile tracking */}
        <div className="overflow-hidden py-2 w-full">
          <h1 className="font-outfit text-[1.4rem] xs:text-[1.75rem] sm:text-5xl md:text-6xl font-bold uppercase text-gradient animate-pulse-slow flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-14 md:gap-20 w-full max-w-full">
            <span className="whitespace-nowrap inline-block tracking-[0.08em] xs:tracking-[0.12em] sm:tracking-[0.3em] sm:mr-6 md:mr-8 shrink-0">
              M O N Z U R U L
            </span>
            <span className="whitespace-nowrap inline-block tracking-[0.08em] xs:tracking-[0.12em] sm:tracking-[0.3em] shrink-0">
              I S L A M
            </span>
          </h1>
        </div>

        {/* Subheading Title */}
        <p className="font-outfit text-xs sm:text-sm md:text-base tracking-[0.18em] sm:tracking-[0.25em] uppercase opacity-80 text-secondary">
          Junior Software Engineer · Full Stack Developer
        </p>

        {/* Minimalist Glowing Progress Line */}
        <div className="w-44 sm:w-72 h-[2px] bg-white/10 mx-auto rounded-full overflow-hidden relative mt-2">
          <div
            className="h-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-75 ease-out shadow-[0_0_12px_rgba(34,211,238,0.8)]"
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
