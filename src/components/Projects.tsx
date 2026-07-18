"use client";
import React, { useState } from "react";
import Link from "next/link";
import { portfolioData, Project } from "@/data/portfolio";
import { ArrowUpRight, Code, Layers } from "lucide-react";

export default function Projects() {
  const [filter, setFilter] = useState<string>("All");

  const categories = ["All", "Full Stack", "Backend", "CMS"];

  const filteredProjects = portfolioData.projects.filter((project) => {
    if (filter === "All") return true;
    return project.category === filter;
  });

  return (
    <section id="projects" className="section py-20 bg-base-200/20 border-y border-base-300/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Featured <span className="text-gradient">Projects</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            Explore a selection of my latest software engineering projects, showcasing end-to-end full-stack systems and secure backend APIs.
          </p>
        </div>

        {/* Categories Filtering tabs */}
        <div className="flex justify-center items-center gap-2 mb-12 flex-wrap font-outfit">
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

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group flex flex-col justify-between rounded-3xl bg-base-200/50 border border-base-300/50 hover:border-primary/45 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 overflow-hidden"
            >
              {/* Top Details (Image + Content) */}
              <div>
                {/* Project Image Frame */}
                <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-base-300">
                  {/* Backdrop tint */}
                  <div className="absolute inset-0 bg-base-900/10 z-10 transition-colors group-hover:bg-transparent"></div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.imageSrc}
                    alt={project.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Category Pill */}
                  <span className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-base-100/90 border border-base-300/60 font-outfit">
                    <Layers className="w-3 h-3 text-secondary" />
                    {project.category}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-6">
                  {/* Title */}
                  <h3 className="font-outfit text-xl font-bold text-base-content/95 group-hover:text-primary transition-colors duration-300 mb-2">
                    {project.title}
                  </h3>

                  {/* Description */}
                  <p className="font-sans text-sm opacity-75 line-clamp-3 leading-relaxed mb-6">
                    {project.description}
                  </p>

                  {/* Tech stack pills (preview) */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {project.techStack.slice(0, 4).map((tech) => (
                      <span
                        key={tech}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-base-100 border border-base-300/60 text-xs font-semibold opacity-85"
                      >
                        <Code className="w-3 h-3 text-primary" />
                        {tech}
                      </span>
                    ))}
                    {project.techStack.length > 4 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-base-100 border border-base-300/60 text-xs font-semibold opacity-65">
                        +{project.techStack.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* View More Details Action button */}
              <div className="p-6 pt-0">
                <Link
                  href={`/projects/${project.id}`}
                  className="btn btn-primary btn-outline btn-block rounded-2xl gap-1.5 font-outfit"
                >
                  View Details / More <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
