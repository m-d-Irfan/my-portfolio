import React from "react";
import { portfolioData } from "@/data/portfolio";
import { Code, Server, Layout, Settings } from "lucide-react";

export default function Skills() {
  const getCategoryIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "languages":
        return <Code className="w-5 h-5 text-primary" />;
      case "backend & dbs":
        return <Server className="w-5 h-5 text-secondary" />;
      case "frontend development":
        return <Layout className="w-5 h-5 text-accent" />;
      default:
        return <Settings className="w-5 h-5 text-neutral-content" />;
    }
  };

  const getProgressColor = (title: string) => {
    switch (title.toLowerCase()) {
      case "languages":
        return "progress-primary";
      case "backend & dbs":
        return "progress-secondary";
      case "frontend development":
        return "progress-accent";
      default:
        return "";
    }
  };

  return (
    <section id="skills" className="section py-20 bg-base-100 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Technical <span className="text-gradient">Skills</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            A comprehensive overview of my programming languages, frameworks, databases, and DevOps tools.
          </p>
        </div>

        {/* Skill Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {portfolioData.skills.map((category) => (
            <div
              key={category.title}
              className="p-6 sm:p-8 rounded-3xl bg-base-200/40 border border-base-300/40 hover:border-primary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/5"
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-base-200/80 border border-base-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  {getCategoryIcon(category.title)}
                </div>
                <h3 className="font-outfit text-xl font-bold text-base-content/90">
                  {category.title}
                </h3>
              </div>

              {/* Skills List */}
              <div className="space-y-6">
                {category.skills.map((skill) => (
                  <div key={skill.name} className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="font-outfit opacity-90">{skill.name}</span>
                      <span className="font-mono text-xs opacity-65 text-primary">{skill.level}%</span>
                    </div>
                    {/* Glowing Progress bar */}
                    <div className="relative w-full">
                      <progress
                        className={`progress w-full h-2 rounded-full bg-base-300/50 ${getProgressColor(
                          category.title
                        )}`}
                        value={skill.level}
                        max="100"
                      ></progress>
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
