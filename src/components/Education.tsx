import React from "react";
import { usePortfolio } from "../context/context";
import { GraduationCap, Award, Calendar, MapPin } from "lucide-react";

export default function Education() {
  const { data } = usePortfolio();

  return (
    <section id="education" className="py-16 sm:py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-3">
            Qualifications
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Academic Background
          </h2>
          <p className="font-sans text-base text-base-content/75">
            Formal computer science and engineering coursework and credentials.
          </p>
        </div>

        {/* Education Timeline */}
        <div className="max-w-3xl mx-auto space-y-6">
          {data.education.map((edu) => (
            <div
              key={edu.id}
              className="bg-base-200/60 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl hover:border-primary/40 transition-all duration-300 relative pl-8 sm:pl-10"
            >
              <div className="absolute left-3.5 sm:left-4 top-8 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-4 border-base-100 shadow-md shadow-primary/30" />

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-2 mb-2">
                <h3 className="font-outfit text-xl font-bold text-base-content flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                  {edu.degree}
                </h3>
                <span className="font-mono text-xs text-base-content/60 flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  {edu.dates}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-secondary font-semibold mb-4">
                <span>{edu.institution}</span>
                <span className="flex items-center gap-1 text-base-content/60 font-mono">
                  <MapPin className="w-3.5 h-3.5" /> {edu.location}
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-bold mb-4">
                <Award className="w-3.5 h-3.5" />
                <span>{edu.grade}</span>
              </div>

              <p className="font-sans text-xs sm:text-sm text-base-content/80 leading-relaxed mb-3">
                {edu.description}
              </p>

              {edu.highlights && (
                <ul className="space-y-1.5 font-sans text-xs sm:text-sm text-base-content/75 list-disc pl-4 leading-relaxed">
                  {edu.highlights.map((h, idx) => (
                    <li key={idx}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
