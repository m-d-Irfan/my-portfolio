"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePortfolio } from "@/context/context";
import { Award, Calendar, BookOpen, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

export default function Training() {
  const { data } = usePortfolio();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -70px 0px", // Triggers visibly as user scrolls into the section
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const total = data.training.length;

  const handlePrev = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 45) {
      handleNext();
    } else if (diff < -45) {
      handlePrev();
    }
    setTouchStartX(null);
  };

  // Calculates animation & 3D slide state for training cards
  const getTrainingCardClass = (index: number) => {
    const diff = (index - currentIndex + total) % total;

    // Initial entrance animation states before user scrolls into view
    if (!isInView) {
      if (index === 0 || (total > 1 && index === 1)) {
        // Middle card drops from top
        return "opacity-0 -translate-y-28 scale-90 pointer-events-none";
      } else if (index === 0) {
        // Left card hides behind center
        return "opacity-0 translate-x-40 scale-75 pointer-events-none";
      } else {
        // Right card hides behind center
        return "opacity-0 -translate-x-40 scale-75 pointer-events-none";
      }
    }

    // After entrance animation triggered:
    if (diff === 0) {
      // Middle Active Card - Drops into place
      return "relative z-30 scale-100 opacity-100 shadow-2xl shadow-secondary/15 border-secondary/50 translate-x-0 translate-y-0 pointer-events-auto transition-all duration-900 ease-[cubic-bezier(0.34,1.56,0.64,1)]";
    } else if (diff === 1 || (total === 2 && diff === 1)) {
      // Right Card - Emerges from behind center card
      return "absolute md:relative z-10 scale-90 md:scale-95 opacity-50 md:opacity-90 hover:opacity-100 blur-[0.5px] md:blur-none translate-x-[48%] md:translate-x-0 pointer-events-auto transition-all duration-900 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-300";
    } else if (diff === total - 1) {
      // Left Card - Emerges from behind center card
      return "absolute md:relative z-10 scale-90 md:scale-95 opacity-50 md:opacity-90 hover:opacity-100 blur-[0.5px] md:blur-none -translate-x-[48%] md:translate-x-0 pointer-events-auto transition-all duration-900 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-300";
    } else {
      return "absolute z-0 scale-75 opacity-0 pointer-events-none translate-x-0 transition-all duration-900";
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
            - Entrance: Middle card drops from TOP, side cards emerge from behind it
            - Interactive: Infinity loop slide supported
           ========================================================= */}
        <div
          className="relative min-h-[440px] flex items-center justify-center md:grid md:grid-cols-3 gap-6 max-w-6xl mx-auto select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
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
                className={`w-full max-w-[340px] md:max-w-none p-6 sm:p-8 rounded-3xl bg-base-200/90 border border-base-300/60 hover:border-secondary/40 group hover:shadow-xl flex flex-col justify-between ${cardClass}`}
              >
                <div>
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
                  <h3 className="font-outfit text-xl font-bold text-base-content/95 group-hover:text-secondary transition-colors duration-300 mb-2">
                    {train.title}
                  </h3>
                  
                  {/* Provider */}
                  <p className="font-outfit text-sm font-semibold opacity-70 mb-4 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-accent" />
                    {train.provider}
                  </p>

                  {/* Description */}
                  <p className="font-sans text-xs sm:text-sm opacity-80 leading-relaxed mb-6 text-justify">
                    {train.description}
                  </p>
                </div>

                {/* Action Link */}
                {train.link && (
                  <div className="pt-2">
                    <a
                      href={train.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost btn-secondary pl-0 gap-1.5 font-outfit text-xs text-secondary hover:text-secondary-focus"
                    >
                      View Verification <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Carousel Slider Controls on Mobile */}
        <div className="flex md:hidden flex-col items-center justify-center gap-3 mt-8">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              className="btn btn-circle btn-sm bg-base-200 border border-base-300 hover:bg-secondary hover:text-secondary-content transition-all shadow-md"
              aria-label="Previous training"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2 px-2">
              {data.training.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? "w-6 bg-secondary shadow-sm"
                      : "w-2 bg-base-300"
                  }`}
                  aria-label={`Go to training ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="btn btn-circle btn-sm bg-base-200 border border-base-300 hover:bg-secondary hover:text-secondary-content transition-all shadow-md"
              aria-label="Next training"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
