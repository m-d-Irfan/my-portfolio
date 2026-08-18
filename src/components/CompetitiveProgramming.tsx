import React from "react";
import { usePortfolio } from "../context/context";
import { Terminal, ExternalLink } from "lucide-react";

export default function CompetitiveProgramming() {
  const { data } = usePortfolio();

  return (
    <section id="competitive" className="py-16 sm:py-24 bg-base-200/40 relative border-t border-b border-base-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-3">
            Problem Solving
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Algorithmic Competence & Contests
          </h2>
          <p className="font-sans text-base text-base-content/75">
            Sharpening data structures, graph theory, dynamic programming, and computational thinking on competitive platforms.
          </p>
        </div>

        {/* CP Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.competitiveProgramming.map((cp, idx) => (
            <div
              key={idx}
              className="bg-base-100/90 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-base-200 flex items-center justify-center text-primary">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-outfit text-xl font-bold text-base-content">
                        {cp.platform}
                      </h3>
                      <span className="font-mono text-xs text-primary">
                        @{cp.username}
                      </span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-secondary/10 border border-secondary/25 font-mono text-xs font-semibold text-secondary">
                    {cp.badge}
                  </span>
                </div>

                <p className="font-sans text-sm text-base-content/80 leading-relaxed mb-6">
                  {cp.description}
                </p>
              </div>

              <a
                href={cp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm rounded-xl font-outfit justify-center gap-2 w-full"
              >
                View {cp.platform} Profile <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
