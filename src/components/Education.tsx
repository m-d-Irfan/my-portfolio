"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePortfolio } from "@/context/context";
import { GraduationCap, Calendar, MapPin, Award } from "lucide-react";

export default function Education() {
  const { data } = usePortfolio();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState<boolean>(false);

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

  return (
    <section id="education" ref={sectionRef} className="section py-20 bg-base-200/20 border-y border-base-300/40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Education <span className="text-gradient">History</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full" />
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            My academic journey and qualifications.
          </p>
        </div>

        {/* Responsive Timeline Grid */}
        <div className="max-w-4xl mx-auto relative pl-6 sm:pl-8 border-l border-base-300/70 space-y-12">
          {data.education.map((edu, index) => (
            <div
              key={edu.id}
              style={{ transitionDelay: `${index * 200}ms` }}
              className={`relative group transition-all duration-800 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
              }`}
            >
              
              {/* Timeline dot */}
              <span className="absolute -left-[35px] sm:-left-[43px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center shadow-md shadow-primary/10 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <GraduationCap className="w-4 h-4 text-primary group-hover:text-primary-content transition-colors duration-300" />
              </span>

              {/* Education Card content */}
              <div className="p-6 sm:p-8 rounded-3xl bg-base-200/50 border border-base-300/50 transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                  <div>
                    <h3 className="font-outfit text-xl sm:text-2xl font-bold text-base-content/95 group-hover:text-primary transition-colors duration-300">
                      {edu.degree}
                    </h3>
                    <p className="font-outfit text-base font-semibold text-secondary mt-1">
                      {edu.institution}
                    </p>
                  </div>

                  {/* Dates & Location Badge */}
                  <div className="flex flex-wrap items-center gap-3 md:shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-base-100/80 border border-base-300 font-mono text-xs opacity-80">
                      <Calendar className="w-3.5 h-3.5" />
                      {edu.dates}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-base-100/80 border border-base-300 font-sans text-xs opacity-80">
                      <MapPin className="w-3.5 h-3.5 text-accent" />
                      {edu.location}
                    </span>
                  </div>
                </div>

                {/* Score Grade Badge */}
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 font-outfit text-xs font-semibold text-primary">
                    <Award className="w-3.5 h-3.5" />
                    {edu.grade}
                  </span>
                </div>

                {/* Description */}
                {edu.description && (
                  <p className="mt-4 text-sm font-sans opacity-80 leading-relaxed text-justify">
                    {edu.description}
                  </p>
                )}
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
