"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePortfolio } from "@/context/context";
import { Award, Calendar, BookOpen, ExternalLink } from "lucide-react";

export default function Training() {
  const { data } = usePortfolio();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const total = data.training.length;

  // 2-second auto-slide loop on mobile when in view and not touched/paused
  useEffect(() => {
    if (!isInView || isPaused || total <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 2000);

    return () => clearInterval(interval);
  }, [isInView, isPaused, total]);

  const handlePrev = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  // Freeze on touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchStartX(e.touches[0].clientX);
  };

  // Resume and slide on touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX !== null) {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 40) {
        handleNext();
      } else if (diff < -40) {
        handlePrev();
      }
    }
    setTouchStartX(null);
    setIsPaused(false);
  };

  // Calculates animation & 3D slide state for training cards
  const getTrainingCardClass = (index: number) => {
    const diff = (index - currentIndex + total) % total;

    // Initial entrance animation states before user scrolls into view
    if (!isInView) {
      if (index === 0 || (total > 1 && index === 1)) {
        return "opacity-0 -translate-y-20 scale-95 pointer-events-none";
      } else if (index === 0) {
        return "opacity-0 translate-x-32 scale-80 pointer-events-none";
      } else {
        return "opacity-0 -translate-x-32 scale-80 pointer-events-none";
      }
    }

    // Active Card
    if (diff === 0) {
      return "relative z-30 scale-100 opacity-100 shadow-2xl shadow-secondary/15 border-secondary/50 translate-x-0 translate-y-0 pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]";
    } else if (diff === 1 || (total === 2 && diff === 1)) {
      // Right Card
      return "absolute md:relative z-10 scale-[0.88] md:scale-100 opacity-30 md:opacity-100 hover:opacity-100 blur-[0.5px] md:blur-none translate-x-[50%] md:translate-x-0 pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]";
    } else if (diff === total - 1) {
      // Left Card
      return "absolute md:relative z-10 scale-[0.88] md:scale-100 opacity-30 md:opacity-100 hover:opacity-100 blur-[0.5px] md:blur-none -translate-x-[50%] md:translate-x-0 pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]";
    } else {
      return "absolute z-0 scale-75 opacity-0 pointer-events-none translate-x-0 transition-all duration-700";
    }
  };

  return (
    <section id="training" ref={sectionRef} className="section py-24 bg-transparent relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Professional <span className="text-gradient">Training</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full" />
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            Bootcamps, specialized courses, and certifications in software engineering.
          </p>
        </div>

        {/* =========================================================
            Training Cards Container:
            - Desktop: Uniform grid with identically sized cards
            - Mobile: 2-second auto-loop slide with touch freeze
           ========================================================= */}
        <div
          className="relative min-h-[460px] sm:min-h-[480px] flex items-center justify-center md:grid md:grid-cols-3 gap-6 max-w-6xl mx-auto select-none items-stretch"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {data.training.map((train, index) => {
            const cardClass = getTrainingCardClass(index);
            const isCenter = index === currentIndex;

            return (
              <div
                key={train.id}
                onClick={() => {
                  if (!isCenter) setCurrentIndex(index);
                }}
                className={`w-full max-w-[340px] sm:max-w-[360px] md:max-w-none h-[450px] md:h-full md:min-h-[460px] p-6 sm:p-8 rounded-3xl bg-base-200/90 border border-base-300/60 hover:border-secondary/40 group hover:shadow-xl flex flex-col justify-between will-change-transform ${cardClass}`}
              >
                {/* Top Section */}
                <div className="flex flex-col flex-grow">
                  {/* Header Info */}
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Award className="w-5 h-5 text-secondary" />
                    </div>
                    
                    {/* Date badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-base-100 border border-base-300 font-mono text-xs opacity-75">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {train.dates}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-outfit text-lg sm:text-xl font-bold text-base-content/95 group-hover:text-secondary transition-colors duration-300 mb-2 line-clamp-2">
                    {train.title}
                  </h3>
                  
                  {/* Provider */}
                  <p className="font-outfit text-sm font-semibold opacity-70 mb-4 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-accent shrink-0" />
                    <span className="truncate">{train.provider}</span>
                  </p>

                  {/* Description */}
                  <p className="font-sans text-xs sm:text-sm opacity-80 leading-relaxed text-justify line-clamp-6 overflow-hidden">
                    {train.description}
                  </p>
                </div>

                {/* Bottom Action / Verification Container - Uniform across all cards */}
                <div className="pt-4 border-t border-base-300/40 min-h-[48px] flex items-center">
                  {train.link ? (
                    <a
                      href={train.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost btn-secondary pl-0 gap-1.5 font-outfit text-xs text-secondary hover:text-secondary-focus"
                    >
                      View Verification <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="font-mono text-xs opacity-40 italic">
                      Bootcamp Track
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* =========================================================
            Mobile Clean Pagination Dots
           ========================================================= */}
        <div className="flex md:hidden justify-center items-center gap-2.5 mt-8">
          {data.training.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-8 bg-secondary shadow-md shadow-secondary/30"
                  : "w-2.5 bg-base-300 hover:bg-base-content/40"
              }`}
              aria-label={`Go to training slide ${i + 1}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
