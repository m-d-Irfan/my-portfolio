import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { portfolioData } from "@/data/portfolio";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, Code, ExternalLink, Github, Sparkles, Flame, Milestone } from "lucide-react";

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const resolvedParams = await params;
  const project = portfolioData.projects.find((p) => p.id === resolvedParams.id);

  if (!project) {
    notFound();
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Back navigation */}
        <div className="mb-8">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors font-outfit"
          >
            <ArrowLeft className="w-4 h-4" /> Back to projects
          </Link>
        </div>

        {/* Project Header layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Left: Banner Image */}
          <div className="lg:col-span-7 rounded-3xl overflow-hidden bg-base-300 border border-base-300 shadow-xl relative aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.imageSrc}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right: Overview info pane */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-base-200/50 border border-base-300/40 shadow-lg flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono text-xs text-primary font-semibold">
                <Sparkles className="w-4 h-4" /> FEATURED WORK
              </div>
              <h1 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight text-gradient mb-4">
                {project.title}
              </h1>
              <p className="font-sans text-sm opacity-80 leading-relaxed mb-6">
                Overview of the implementation stack and live details.
              </p>
            </div>

            {/* CTA Links */}
            <div className="space-y-3">
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-block rounded-2xl gap-2 font-outfit"
              >
                Launch Live App <ExternalLink className="w-4 h-4" />
              </a>

              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-block rounded-2xl gap-2 font-outfit"
              >
                <Github className="w-5 h-5" /> {project.githubBackendUrl ? "Frontend Repository" : "GitHub Repository"}
              </a>

              {project.githubBackendUrl && (
                <a
                  href={project.githubBackendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-block rounded-2xl gap-2 font-outfit"
                >
                  <Github className="w-5 h-5" /> Backend Repository
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Details breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Tech Stack Side block */}
          <div className="lg:col-span-4 p-6 sm:p-8 rounded-3xl bg-base-200/40 border border-base-300/40 shadow-md">
            <h2 className="font-outfit text-xl font-bold mb-4 flex items-center gap-2 text-base-content/90 border-b border-base-300 pb-2">
              <Code className="w-5 h-5 text-primary" /> Tech Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 rounded-xl bg-base-100 border border-base-300 text-sm font-semibold opacity-90 hover:border-primary/40 transition-colors"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Text descriptions blocks */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Brief Description */}
            <div className="space-y-3">
              <h2 className="font-outfit text-2xl font-bold text-base-content/95">
                Project Description
              </h2>
              <p className="font-sans text-base sm:text-lg opacity-80 leading-relaxed">
                {project.description}
              </p>
            </div>

            {/* Challenges Faced */}
            <div className="p-6 sm:p-8 rounded-3xl bg-error/5 border border-error/20 space-y-4">
              <h2 className="font-outfit text-xl font-bold text-error flex items-center gap-2">
                <Flame className="w-5 h-5 animate-pulse" /> Challenges Faced
              </h2>
              <p className="font-sans text-sm sm:text-base opacity-80 leading-relaxed">
                {project.challenges}
              </p>
            </div>

            {/* Improvements and Future Plans */}
            <div className="p-6 sm:p-8 rounded-3xl bg-success/5 border border-success/20 space-y-4">
              <h2 className="font-outfit text-xl font-bold text-success flex items-center gap-2">
                <Milestone className="w-5 h-5" /> Future Plans & Improvements
              </h2>
              <p className="font-sans text-sm sm:text-base opacity-80 leading-relaxed">
                {project.improvements}
              </p>
            </div>

          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}

export async function generateStaticParams() {
  return portfolioData.projects.map((project) => ({
    id: project.id,
  }));
}
