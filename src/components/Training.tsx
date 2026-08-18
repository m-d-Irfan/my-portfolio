import React from "react";
import { usePortfolio } from "../context/context";
import { BookOpen, ExternalLink, Calendar } from "lucide-react";

export default function Training() {
  const { data } = usePortfolio();

  return (
    <section id="training" className="py-16 sm:py-24 bg-base-200/40 relative border-t border-base-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/25 text-secondary font-mono text-xs font-semibold mb-3">
            Bootcamps
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Specialized Bootcamps & Certifications
          </h2>
          <p className="font-sans text-base text-base-content/75">
            Intensive industry-oriented software engineering bootcamps and verified certifications.
          </p>
        </div>

        {/* Training Cards */}
        <div className="max-w-4xl mx-auto space-y-6">
          {data.training.map((train) => (
            <div
              key={train.id}
              className="bg-base-100/90 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl hover:border-secondary/40 transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-2 mb-2">
                <h3 className="font-outfit text-lg sm:text-xl font-bold text-base-content flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-secondary shrink-0" />
                  {train.title}
                </h3>
                <span className="font-mono text-xs text-base-content/60 flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  {train.dates}
                </span>
              </div>

              <div className="font-mono text-xs font-semibold text-primary mb-3">
                Provider: {train.provider}
              </div>

              <p className="font-sans text-xs sm:text-sm text-base-content/80 leading-relaxed mb-4 text-justify">
                {train.description}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {train.skills && (
                  <div className="flex flex-wrap gap-1.5">
                    {train.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-md bg-base-200 border border-base-300 text-[11px] font-mono text-base-content/80"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {train.link && (
                  <a
                    href={train.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-primary hover:underline"
                  >
                    Verified Certificate <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
