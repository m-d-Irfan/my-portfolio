import React, { useState, useEffect } from "react";
import { usePortfolio } from "../context/context";
import { Project } from "../data/portfolio";
import { ExternalLink, Github, Info, ChevronLeft, ChevronRight, X } from "lucide-react";

export default function Projects() {
  const { data } = usePortfolio();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const categories = ["All", "Full Stack", "Backend", "CMS"];

  const filteredProjects = data.projects.filter((p) => {
    if (activeCategory === "All") return true;
    return p.category === activeCategory;
  });

  const total = filteredProjects.length;

  // Auto-slide every 3.5s with pause on middle card hover/touch
  useEffect(() => {
    if (isPaused || total <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 3500);
    return () => clearInterval(timer);
  }, [isPaused, total]);

  // Disable background scroll when viewing project modal
  useEffect(() => {
    if (selectedProject) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [selectedProject]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  return (
    <section id="projects" className="py-16 sm:py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-3">
            Portfolio
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Featured Projects & Systems
          </h2>
          <p className="font-sans text-base text-base-content/75">
            Selected software engineering projects demonstrating scalable REST APIs, relational modeling, and reactive frontends.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex justify-center flex-wrap gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setCurrentIndex(0);
              }}
              className={`px-4 py-2 rounded-full font-outfit text-xs sm:text-sm font-semibold transition-all duration-300 ${
                activeCategory === cat
                  ? "bg-primary text-black shadow-md shadow-primary/25"
                  : "bg-base-200 border border-base-300 text-base-content/75 hover:border-primary/40 hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 3-Card Infinity Carousel Stage */}
        {total > 0 && (
          <div
            className="relative w-full max-w-5xl mx-auto h-[480px] xs:h-[510px] sm:h-[560px] flex items-center justify-center overflow-hidden"
          >
            {filteredProjects.map((project, idx) => {
              const isCenter = idx === currentIndex;
              const isPrev = idx === (currentIndex - 1 + total) % total && total > 1;
              const isNext = idx === (currentIndex + 1) % total && total > 1;

              if (!isCenter && !isPrev && !isNext) return null;

              let cardStyles = "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] absolute w-[290px] xs:w-[320px] sm:w-[440px] max-w-[82vw] bg-base-100 border rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col will-change-transform ";
              
              if (isCenter) {
                // Middle Card: ONLY accessible card, pauses on hover/touch
                cardStyles += "z-20 scale-100 xs:scale-105 sm:scale-110 translate-x-0 opacity-100 border-primary/50 shadow-primary/20 shadow-2xl blur-none pointer-events-auto cursor-default hover:border-primary hover:shadow-primary/35 hover:scale-[1.03] sm:hover:scale-[1.12]";
              } else if (isPrev) {
                // Left Side Card: Inaccessible, non-interactive, transparent blurry
                cardStyles += "z-10 scale-80 xs:scale-85 -translate-x-[68%] sm:-translate-x-[70%] opacity-35 sm:opacity-40 blur-[2.5px] sm:blur-[3px] border-base-300 pointer-events-none select-none";
              } else if (isNext) {
                // Right Side Card: Inaccessible, non-interactive, transparent blurry
                cardStyles += "z-10 scale-80 xs:scale-85 translate-x-[68%] sm:translate-x-[70%] opacity-35 sm:opacity-40 blur-[2.5px] sm:blur-[3px] border-base-300 pointer-events-none select-none";
              }

              return (
                <article
                  key={project.id}
                  className={cardStyles}
                  aria-hidden={!isCenter}
                  onMouseEnter={() => {
                    if (isCenter) setIsPaused(true);
                  }}
                  onMouseLeave={() => {
                    if (isCenter) setIsPaused(false);
                  }}
                  onTouchStart={() => {
                    if (isCenter) setIsPaused(true);
                  }}
                  onTouchEnd={() => {
                    if (isCenter) setIsPaused(false);
                  }}
                >
                  {/* Thumbnail Image */}
                  <div className="relative w-full aspect-video overflow-hidden bg-base-300">
                    <img
                      src={project.imageSrc}
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-base-100/90 backdrop-blur-md border border-base-300 font-mono text-[11px] font-semibold text-secondary">
                      {project.category}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 sm:p-6 flex flex-col flex-grow">
                    <h3 className="font-outfit text-lg sm:text-xl font-bold text-base-content mb-1.5">
                      {project.title}
                    </h3>
                    <p className="font-sans text-xs sm:text-sm text-base-content/75 line-clamp-2 sm:line-clamp-3 mb-4 leading-relaxed flex-grow">
                      {project.description}
                    </p>

                    {/* Tech Stack Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {project.techStack.slice(0, 4).map((tech, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded-md bg-base-200 border border-base-300 text-[10px] sm:text-[11px] font-mono text-base-content/80"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.techStack.length > 4 && (
                        <span className="px-2 py-0.5 rounded-md bg-base-200 border border-base-300 text-[10px] sm:text-[11px] font-mono text-primary font-bold">
                          +{project.techStack.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Action Controls - Accessible ONLY on middle card */}
                    <div className="flex items-center gap-2 pt-3 border-t border-base-300">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCenter) setSelectedProject(project);
                        }}
                        disabled={!isCenter}
                        tabIndex={isCenter ? 0 : -1}
                        className="flex-1 btn btn-sm btn-outline rounded-xl font-outfit text-xs gap-1.5"
                      >
                        <Info className="w-3.5 h-3.5" /> Details
                      </button>

                      <a
                        href={isCenter ? project.liveUrl : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isCenter ? 0 : -1}
                        onClick={(e) => {
                          if (!isCenter) e.preventDefault();
                          e.stopPropagation();
                        }}
                        className={`flex-1 btn btn-sm btn-primary rounded-xl font-outfit text-xs gap-1.5 shadow-sm ${
                          !isCenter ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Live Demo
                      </a>

                      <a
                        href={isCenter ? project.githubUrl : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isCenter ? 0 : -1}
                        onClick={(e) => {
                          if (!isCenter) e.preventDefault();
                          e.stopPropagation();
                        }}
                        className={`btn btn-sm btn-ghost btn-circle text-base-content/80 hover:text-primary ${
                          !isCenter ? "pointer-events-none opacity-50" : ""
                        }`}
                        title="View Source Code"
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Carousel Navigation Arrows & Dots */}
        {total > 1 && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrev}
                className="btn btn-circle btn-sm btn-outline hover:btn-primary"
                aria-label="Previous project"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                {filteredProjects.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? "w-7 bg-primary" : "w-2 bg-base-300 hover:bg-base-content/40"
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="btn btn-circle btn-sm btn-outline hover:btn-primary"
                aria-label="Next project"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="font-mono text-xs text-base-content/60">
              {currentIndex + 1} / {total} · Slide arrows or swipe to cycle
            </div>
          </div>
        )}
      </div>

      {/* Case Study Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-base-100 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute top-4 right-4 btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-2">
              {selectedProject.category}
            </div>

            <h3 className="font-outfit text-2xl font-bold text-gradient mb-2">
              {selectedProject.title}
            </h3>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedProject.techStack.map((tech, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-base-200 border border-base-300 text-xs font-mono text-base-content/80"
                >
                  {tech}
                </span>
              ))}
            </div>

            <p className="font-sans text-sm text-base-content/85 leading-relaxed mb-6">
              {selectedProject.description}
            </p>

            {selectedProject.challenges && (
              <div className="mb-4">
                <h4 className="font-outfit text-sm font-bold uppercase tracking-wider text-secondary mb-1">
                  Architecture & Engineering Challenges
                </h4>
                <p className="font-sans text-xs sm:text-sm text-base-content/75">
                  {selectedProject.challenges}
                </p>
              </div>
            )}

            {selectedProject.improvements && (
              <div className="mb-6">
                <h4 className="font-outfit text-sm font-bold uppercase tracking-wider text-accent mb-1">
                  Performance & Future Improvements
                </h4>
                <p className="font-sans text-xs sm:text-sm text-base-content/75">
                  {selectedProject.improvements}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-base-300">
              <a
                href={selectedProject.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn btn-primary font-outfit text-xs gap-1.5 shadow-md"
              >
                <ExternalLink className="w-4 h-4" /> Open Live Application
              </a>

              <a
                href={selectedProject.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline font-outfit text-xs gap-1.5"
              >
                <Github className="w-4 h-4" /> GitHub Repository
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

