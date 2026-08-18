import React, { useState } from "react";
import { usePortfolio } from "../context/context";
import { Code2, Server, Layout, Cloud } from "lucide-react";

export default function Skills() {
  const { data } = usePortfolio();
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const categories = ["All", ...data.skills.map((s) => s.title)];

  const filteredCategories = data.skills.filter((cat) => {
    if (activeFilter === "All") return true;
    return cat.title === activeFilter;
  });

  const getCategoryIcon = (title: string) => {
    if (title.includes("Backend")) return <Server className="w-5 h-5 text-primary" />;
    if (title.includes("Frontend")) return <Layout className="w-5 h-5 text-secondary" />;
    if (title.includes("Languages")) return <Code2 className="w-5 h-5 text-accent" />;
    return <Cloud className="w-5 h-5 text-info" />;
  };

  return (
    <section id="skills" className="py-16 sm:py-24 bg-base-200/40 relative border-t border-b border-base-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-3">
            Expertise
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Technical Skills Matrix
          </h2>
          <p className="font-sans text-base text-base-content/75">
            A structured overview of the frameworks, databases, languages, and tools I use in production.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex justify-center flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-4 py-2 rounded-full font-outfit text-xs sm:text-sm font-semibold transition-all duration-300 ${
                activeFilter === cat
                  ? "bg-primary text-black shadow-md shadow-primary/25"
                  : "bg-base-200 border border-base-300 text-base-content/75 hover:border-primary/40 hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Skills Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCategories.map((category, idx) => (
            <div
              key={idx}
              className="bg-base-100/90 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl hover:border-primary/40 transition-all duration-300"
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-base-300 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-base-200 flex items-center justify-center">
                  {getCategoryIcon(category.title)}
                </div>
                <div>
                  <h3 className="font-outfit text-lg font-bold text-base-content">
                    {category.title}
                  </h3>
                  <p className="font-sans text-xs text-base-content/60">
                    {category.description}
                  </p>
                </div>
              </div>

              {/* Skills Items Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {category.skills.map((skill, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3.5 rounded-2xl bg-base-200/70 border border-base-300 hover:border-primary/40 hover:bg-base-200 transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-outfit font-bold text-xs sm:text-sm text-base-content group-hover:text-primary transition-colors">
                        {skill.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between font-mono text-[10px] text-primary">
                      <span>{skill.tag || "Skill"}</span>
                      <span className="opacity-60">{skill.level}%</span>
                    </div>

                    {/* Subtle Progress Bar */}
                    <div className="w-full h-1 bg-base-300 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                        style={{ width: `${skill.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
