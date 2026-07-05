import React from "react";
import { portfolioData } from "@/data/portfolio";
import { Award, Calendar, BookOpen, ExternalLink } from "lucide-react";

export default function Training() {
  return (
    <section id="training" className="section py-20 bg-base-100 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Professional <span className="text-gradient">Training</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            Bootcamps, specialized courses, and certifications in software development.
          </p>
        </div>

        {/* Training Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {portfolioData.training.map((train) => (
            <div
              key={train.id}
              className="p-6 sm:p-8 rounded-3xl bg-base-200/40 border border-base-300/40 hover:border-secondary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-secondary/5 flex flex-col justify-between"
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
                <p className="font-sans text-sm opacity-75 leading-relaxed mb-6">
                  {train.description}
                </p>
              </div>

              {/* Action Link (if present) */}
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
          ))}
        </div>

      </div>
    </section>
  );
}
