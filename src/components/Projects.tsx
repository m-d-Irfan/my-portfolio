"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/context";
import { ArrowUpRight, Code, Layers, ChevronLeft, ChevronRight } from "lucide-react";

export default function Projects() {
  const { data } = usePortfolio();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>("All");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const categories = ["All", "Full Stack", "Backend", "CMS"];

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

  const filteredProjects = data.projects.filter((project) => {
    if (filter === "All") return true;
    return project.category === filter;
  });

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [filter]);

  const total = filteredProjects.length;

  const handlePrev = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  // Touch swipe support for mobile
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

  if (total === 0) return null;

  // Calculate 3-card relative positions for the infinite coverflow carousel
  const getCardStyle = (index: number) => {
    if (!isInView) {
      return "scale-75 opacity-0 pointer-events-none translate-y-12";
    }

    if (total === 1) {
      return "relative z-30 scale-100 opacity-100 pointer-events-auto max-w-lg mx-auto transition-all duration-800";
    }

    // Relative offset from current active index in loop
    const diff = (index - currentIndex + total) % total;

    if (diff === 0) {
      // Active / Middle Card - Much bigger, sharp, centered, full opacity
      return "relative z-30 scale-100 sm:scale-105 opacity-100 shadow-2xl shadow-primary/15 border-primary/50 pointer-events-auto translate-x-0 transition-all duration-800 ease-[cubic-bezier(0.25,1,0.5,1)]";
    } else if (diff === 1 || (total === 2 && diff === 1)) {
      // Right Card - Half shown on right edge, scaled down, blurry & semi-transparent
      return "absolute z-10 scale-[0.82] sm:scale-85 opacity-40 hover:opacity-75 blur-[1px] translate-x-[48%] sm:translate-x-[52%] lg:translate-x-[56%] cursor-pointer pointer-events-auto transition-all duration-800 ease-[cubic-bezier(0.25,1,0.5,1)]";
    } else if (diff === total - 1) {
      // Left Card - Half shown on left edge, scaled down, blurry & semi-transparent
      return "absolute z-10 scale-[0.82] sm:scale-85 opacity-40 hover:opacity-75 blur-[1px] -translate-x-[48%] sm:-translate-x-[52%] lg:-translate-x-[56%] cursor-pointer pointer-events-auto transition-all duration-800 ease-[cubic-bezier(0.25,1,0.5,1)]";
    } else {
      // Hidden behind
      return "absolute z-0 scale-75 opacity-0 pointer-events-none translate-x-0 transition-all duration-800";
    }
  };

  return (
    <section id="projects" ref={sectionRef} className="section py-24 bg-base-200/20 border-y border-base-300/40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Featured <span className="text-gradient">Projects</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full" />
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            Explore a selection of my latest software engineering projects, showcasing end-to-end full-stack systems and secure backend APIs.
          </p>
        </div>

        {/* Categories Filtering tabs */}
        <div className="flex justify-center items-center gap-2 mb-14 flex-wrap font-outfit">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`btn btn-sm sm:btn-md rounded-xl border border-base-300 font-semibold transition-all duration-300 ${
                filter === cat
                  ? "btn-primary text-primary-content shadow-md shadow-primary/20"
                  : "btn-ghost hover:bg-base-200 hover:border-base-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* =========================================================
            3D Infinity Loop Carousel Container:
            - Middle card: Big, centered, focused
            - Left & Right cards: Half visible, blurry & transparent
           ========================================================= */}
        <div
          className="relative w-full max-w-5xl mx-auto min-h-[540px] sm:min-h-[580px] flex items-center justify-center py-6 select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {filteredProjects.map((project, index) => {
            const cardStyle = getCardStyle(index);
            const isCenter = index === currentIndex;

            return (
              <div
                key={project.id}
                onClick={() => {
                  if (!isCenter) setCurrentIndex(index);
                }}
                className={`w-full max-w-[340px] sm:max-w-md md:max-w-[420px] rounded-3xl bg-base-200/95 border border-base-300/60 overflow-hidden flex flex-col justify-between ${cardStyle}`}
              >
                {/* Top Details (Image + Content) */}
                <div>
                  {/* Project Image Frame */}
                  <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-base-300">
                    <div className="absolute inset-0 bg-base-900/10 z-10" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={project.imageSrc}
                      alt={project.title}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                    {/* Category Pill */}
                    <span className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-base-100/90 border border-base-300/60 font-outfit shadow-sm">
                      <Layers className="w-3 h-3 text-secondary" />
                      {project.category}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    <h3 className="font-outfit text-xl sm:text-2xl font-bold text-base-content/95 mb-2 line-clamp-1">
                      {project.title}
                    </h3>

                    <p className="font-sans text-xs sm:text-sm opacity-80 line-clamp-3 leading-relaxed mb-5 text-justify">
                      {project.description}
                    </p>

                    {/* Tech stack pills */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {project.techStack.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-base-100 border border-base-300/60 text-[11px] font-semibold opacity-85"
                        >
                          <Code className="w-3 h-3 text-primary" />
                          {tech}
                        </span>
                      ))}
                      {project.techStack.length > 4 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-base-100 border border-base-300/60 text-[11px] font-semibold opacity-65">
                          +{project.techStack.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* View Details Action button */}
                <div className="p-6 pt-0">
                  <Link
                    href={`/projects/${project.id}`}
                    className={`btn btn-primary btn-outline btn-block rounded-2xl gap-1.5 font-outfit text-sm ${
                      !isCenter ? "pointer-events-none" : ""
                    }`}
                  >
                    View Details / More <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carousel Slider Controls: Prev / Next Buttons + Indicators */}
        <div className="flex flex-col items-center justify-center gap-4 mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              className="btn btn-circle btn-sm sm:btn-md bg-base-200 border border-base-300 hover:bg-primary hover:text-primary-content hover:border-primary transition-all active:scale-90 shadow-md"
              aria-label="Previous project"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Indicator Dots */}
            <div className="flex items-center gap-2 px-2">
              {filteredProjects.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? "w-8 bg-primary shadow-sm shadow-primary/40"
                      : "w-2.5 bg-base-300 hover:bg-base-content/40"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="btn btn-circle btn-sm sm:btn-md bg-base-200 border border-base-300 hover:bg-primary hover:text-primary-content hover:border-primary transition-all active:scale-90 shadow-md"
              aria-label="Next project"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <span className="text-xs font-mono opacity-50">
            {currentIndex + 1} / {total} · Swipe or click to slide
          </span>
        </div>

      </div>
    </section>
  );
}
