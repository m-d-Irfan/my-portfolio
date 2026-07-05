"use client";
import React from "react";
import Link from "next/link";
import { portfolioData } from "@/data/portfolio";
import { ArrowLeft, Printer, Github, Linkedin, Mail, Phone, MapPin, Globe } from "lucide-react";

export default function ResumePage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content antialiased py-8 px-4 sm:px-6 lg:px-8">
      
      {/* Action Header controls */}
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 mb-8 no-print border-b border-base-300 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors font-outfit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Portfolio
        </Link>

        <button
          onClick={handlePrint}
          className="btn btn-primary btn-sm rounded-xl font-outfit gap-1.5 shadow-md shadow-primary/20"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Printable Sheet */}
      <main className="max-w-4xl mx-auto bg-base-200/30 border border-base-300/40 p-6 sm:p-10 rounded-3xl shadow-xl print-card print:p-0 print:border-none print:bg-white print:text-black">
        
        {/* Name and Title */}
        <div className="text-center md:text-left md:flex md:justify-between md:items-start border-b-2 border-base-300 print:border-gray-300 pb-6 mb-6">
          <div>
            <h1 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight text-gradient print:text-black print:bg-none">
              {portfolioData.name}
            </h1>
            <p className="font-outfit text-lg sm:text-xl font-semibold text-secondary mt-1 print:text-gray-800">
              {portfolioData.designation}
            </p>
          </div>

          {/* Contact Details Grid */}
          <div className="mt-4 md:mt-0 space-y-1.5 text-sm font-sans opacity-90 text-center md:text-right print:text-black">
            <div className="flex items-center justify-center md:justify-end gap-1.5">
              <Mail className="w-4 h-4 text-primary print:text-black" />
              <a href={`mailto:${portfolioData.email}`} className="hover:underline">{portfolioData.email}</a>
            </div>
            <div className="flex items-center justify-center md:justify-end gap-1.5">
              <Phone className="w-4 h-4 text-secondary print:text-black" />
              <a href={`tel:${portfolioData.phone}`} className="hover:underline">{portfolioData.phone}</a>
            </div>
            <div className="flex items-center justify-center md:justify-end gap-1.5">
              <MapPin className="w-4 h-4 text-accent print:text-black" />
              <span>{portfolioData.location}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 pt-1">
              <a
                href="https://github.com/m-d-Irfan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline text-xs opacity-75 print:text-black"
              >
                <Github className="w-3.5 h-3.5" /> github.com/m-d-Irfan
              </a>
              <a
                href="https://linkedin.com/in/monzurul-islam-irfan/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline text-xs opacity-75 print:text-black"
              >
                <Linkedin className="w-3.5 h-3.5" /> linkedin.com/in/...
              </a>
            </div>
          </div>
        </div>

        {/* Section: Career Objective */}
        <section className="mb-6">
          <h2 className="font-outfit text-lg font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-gray-300 pb-1 mb-2">
            Career Objective
          </h2>
          <p className="font-sans text-sm leading-relaxed opacity-95 text-justify">
            {portfolioData.careerObjective}
          </p>
        </section>

        {/* Section: Technical Skills */}
        <section className="mb-6">
          <h2 className="font-outfit text-lg font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-gray-300 pb-1 mb-2">
            Technical Skills
          </h2>
          <div className="space-y-1.5 text-sm font-sans">
            {portfolioData.skills.map((category) => (
              <div key={category.title} className="grid grid-cols-12 gap-2">
                <span className="col-span-3 md:col-span-2 font-bold opacity-90">{category.title}:</span>
                <span className="col-span-9 md:col-span-10 opacity-80">
                  {category.skills.map((s) => s.name).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Featured Projects */}
        <section className="mb-6">
          <h2 className="font-outfit text-lg font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-gray-300 pb-1 mb-3">
            Projects
          </h2>
          <div className="space-y-4">
            {portfolioData.projects.map((project) => (
              <div key={project.id} className="text-sm font-sans">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-outfit text-base font-bold opacity-95">{project.title}</h3>
                  <div className="flex gap-2 text-xs opacity-75 print:text-black">
                    <a href={project.liveUrl} target="_blank" className="hover:underline">Live Demo</a>
                    <span>|</span>
                    <a href={project.githubUrl} target="_blank" className="hover:underline">GitHub</a>
                  </div>
                </div>
                <p className="text-xs font-semibold text-secondary print:text-gray-800 mb-1">
                  Technologies: {project.techStack.join(", ")}
                </p>
                <p className="opacity-80 text-xs leading-relaxed text-justify mb-1">
                  {project.description}
                </p>
                <p className="text-[11px] opacity-75 italic">
                  <strong>Challenge:</strong> {project.challenges.substring(0, 180)}...
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Education */}
        <section className="mb-6">
          <h2 className="font-outfit text-lg font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-gray-300 pb-1 mb-3">
            Education
          </h2>
          <div className="space-y-3">
            {portfolioData.education.map((edu) => (
              <div key={edu.id} className="text-sm font-sans flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-outfit text-base font-bold opacity-95">{edu.degree}</h3>
                  <p className="opacity-85 text-xs">{edu.institution}</p>
                  <p className="text-xs font-semibold text-secondary print:text-gray-800 mt-0.5">{edu.grade}</p>
                </div>
                <div className="text-right text-xs opacity-80 print:text-black">
                  <p className="font-semibold">{edu.dates}</p>
                  <p>{edu.location}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Training & Bootcamps */}
        <section className="mb-2">
          <h2 className="font-outfit text-lg font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-gray-300 pb-1 mb-3">
            Training & Certifications
          </h2>
          <div className="space-y-3">
            {portfolioData.training.map((train) => (
              <div key={train.id} className="text-sm font-sans flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-outfit text-base font-bold opacity-95">{train.title}</h3>
                  <p className="opacity-85 text-xs">{train.provider}</p>
                  <p className="opacity-75 text-[11px] mt-1 leading-relaxed">{train.description}</p>
                </div>
                <div className="text-right text-xs opacity-80 print:text-black min-w-[90px]">
                  <p className="font-semibold">{train.dates}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Simple Printable warning helper */}
      <p className="text-center text-xs opacity-50 no-print mt-8">
        Designed for a perfect fit on A4 single sheet printing. Use 'Save as PDF' options in browser dialog.
      </p>
    </div>
  );
}
