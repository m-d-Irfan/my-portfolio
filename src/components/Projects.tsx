import React, { useState } from "react";
import { usePortfolio } from "../context/context";
import { Project } from "../data/portfolio";
import { ExternalLink, Github, Info, X } from "lucide-react";

export default function Projects() {
  const { data } = usePortfolio();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const categories = ["All", "Full Stack", "Backend", "CMS"];

  const filteredProjects = data.projects.filter((p) => {
    if (activeCategory === "All") return true;
    return p.category === activeCategory;
  });

  return (
    <section id="projects" className="py-16 sm:py-24 relative">
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
            Selected software engineering projects demonstrating end-to-end full-stack architectures and secure REST APIs.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex justify-center flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
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

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <article
              key={project.id}
              className="bg-base-200/60 border border-base-300 rounded-3xl overflow-hidden flex flex-col shadow-xl hover:border-primary/40 hover:shadow-2xl transition-all duration-300 group"
            >
              {/* Thumbnail Container */}
              <div className="relative w-full aspect-video overflow-hidden bg-base-300">
                <img
                  src={project.imageSrc}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-base-100/90 backdrop-blur-md border border-base-300 font-mono text-[11px] font-semibold text-secondary">
                  {project.category}
                </span>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="font-outfit text-xl font-bold text-base-content mb-2">
                  {project.title}
                </h3>

                <p className="font-sans text-xs sm:text-sm text-base-content/75 line-clamp-3 mb-4 leading-relaxed flex-grow">
                  {project.description}
                </p>

                {/* Tech Stack Pills */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {project.techStack.slice(0, 5).map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-base-100 border border-base-300 text-[11px] font-mono text-base-content/80"
                    >
                      {tech}
                    </span>
                  ))}
                  {project.techStack.length > 5 && (
                    <span className="px-2 py-0.5 rounded-md bg-base-100 border border-base-300 text-[11px] font-mono text-primary font-bold">
                      +{project.techStack.length - 5}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-base-300">
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="flex-1 btn btn-sm btn-outline rounded-xl font-outfit text-xs gap-1.5"
                  >
                    <Info className="w-3.5 h-3.5" /> Case Study
                  </button>

                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 btn btn-sm btn-primary rounded-xl font-outfit text-xs gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Live Demo
                  </a>

                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-ghost btn-circle text-base-content/80 hover:text-primary"
                    title="View Source Code"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
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

            <div className="w-full aspect-video rounded-2xl overflow-hidden mb-6 bg-base-300 border border-base-300">
              <img
                src={selectedProject.imageSrc}
                alt={selectedProject.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Quick Action Links */}
            <div className="flex flex-wrap gap-3 mb-6">
              <a
                href={selectedProject.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn btn-primary btn-sm rounded-xl font-outfit gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Live Application
              </a>

              <a
                href={selectedProject.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn btn-outline btn-sm rounded-xl font-outfit gap-2"
              >
                <Github className="w-4 h-4" /> Client Code
              </a>

              {selectedProject.githubBackendUrl && (
                <a
                  href={selectedProject.githubBackendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 btn btn-outline btn-secondary btn-sm rounded-xl font-outfit gap-2"
                >
                  <Github className="w-4 h-4" /> Server API Code
                </a>
              )}
            </div>

            {/* Key System Highlights */}
            <div className="mb-6">
              <h4 className="font-outfit text-base font-bold text-base-content mb-3">
                Key System Highlights
              </h4>
              <ul className="space-y-2 font-sans text-xs sm:text-sm text-base-content/85 list-disc pl-5 leading-relaxed text-justify">
                {(selectedProject.bullets || [selectedProject.description]).map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            </div>

            {/* Challenges */}
            <div className="p-4 rounded-2xl bg-base-200 border border-base-300 mb-4">
              <h5 className="font-mono text-xs font-bold text-warning uppercase mb-1.5">
                Technical Challenges
              </h5>
              <p className="font-sans text-xs sm:text-sm text-base-content/80 leading-relaxed text-justify">
                {selectedProject.challenges}
              </p>
            </div>

            {/* Roadmaps */}
            <div className="p-4 rounded-2xl bg-base-200 border border-base-300">
              <h5 className="font-mono text-xs font-bold text-primary uppercase mb-1.5">
                Future Roadmaps
              </h5>
              <p className="font-sans text-xs sm:text-sm text-base-content/80 leading-relaxed text-justify">
                {selectedProject.improvements}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
