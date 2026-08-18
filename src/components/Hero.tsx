"use client";
import React from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/context";
import { Github, Linkedin, Mail, Code, FileText, ArrowRight, Download, ChevronDown } from "lucide-react";

export default function Hero() {
  const { theme, data, navigateToResume } = usePortfolio();

  return (
    <section id="home" className="relative min-h-[92vh] flex flex-col justify-center items-center pt-16 pb-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-8">
        
        {/* Left: Text Contents */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
          {/* Heading */}
          <h1 className="font-outfit text-4xl sm:text-6xl font-bold tracking-tight mb-4 leading-tight">
            Hi, I'm <span className="text-gradient">{data.name}</span>
          </h1>
          
          {/* Subheading Designation */}
          <h2 className="font-outfit text-xl sm:text-2xl font-semibold text-secondary mb-6">
            {data.designation}
          </h2>

          {/* Objective Paragraph */}
          <p className="font-sans text-base sm:text-lg opacity-85 leading-relaxed mb-8 max-w-2xl text-justify sm:text-left">
            {data.careerObjective}
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-4">
            <button
              onClick={navigateToResume}
              className="btn btn-primary font-outfit shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/35 transition-all duration-300 hover:scale-[1.03] gap-2"
            >
              <FileText className="w-5 h-5" /> View Resume
            </button>
            
            <a
              href="/Monzurul_Islam.pdf"
              download="Monzurul_Islam_Resume.pdf"
              className="btn btn-outline btn-secondary font-outfit gap-2 hover:scale-[1.03] transition-all"
            >
              <Download className="w-5 h-5" /> Download PDF
            </a>

            <Link href="/#contact" className="btn btn-ghost font-outfit gap-2 hover:text-primary">
              Contact Me <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right: Graphic/Avatar Card */}
        <div className="lg:col-span-5 flex justify-center items-center">
          <div className="relative group w-72 h-72 sm:w-96 sm:h-96">
            
            {/* Pulsing Backlighting */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary to-secondary opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-500" />
            
            {/* Card Frame */}
            <div className="relative w-full h-full bg-base-200/90 border border-base-300/60 rounded-3xl p-6 flex flex-col justify-center items-center overflow-hidden transition-all duration-500 group-hover:border-primary/40 group-hover:shadow-2xl group-hover:shadow-primary/10">
              
              {/* Floating Profile Image */}
              <div className="animate-float mb-12">
                <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-2 border-primary/30 shadow-2xl group-hover:border-primary/60 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={theme === "light" ? "/Monzurul Islam-Light.jpeg" : "/Monzurul Islam-Dark.jpeg"}
                    alt="Monzurul Islam"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                </div>
              </div>

              {/* Tag overlay */}
              <div className="absolute bottom-6 left-6 right-6 text-center">
                <span className="font-outfit font-bold text-lg tracking-wide block">{data.name}</span>
                <span className="font-mono text-xs opacity-75 text-primary">{"<Full Stack Developer />"}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Animated Scroll Down Indicator to Explore More Sections */}
      <div className="mt-8 mb-2 flex justify-center z-20">
        <Link
          href="/#about"
          className="flex flex-col items-center gap-1.5 group opacity-75 hover:opacity-100 transition-all"
          aria-label="Scroll down to explore sections"
        >
          <span className="font-outfit text-[11px] font-semibold tracking-widest uppercase text-primary group-hover:text-primary/90 transition-colors">
            Scroll to explore
          </span>
          <div className="w-5 h-8 rounded-full border-2 border-primary/40 flex justify-center p-1 group-hover:border-primary transition-colors">
            <div className="w-1 h-2 rounded-full bg-primary animate-bounce" />
          </div>
          <ChevronDown className="w-4 h-4 text-primary/70 -mt-1 animate-pulse" />
        </Link>
      </div>
    </section>
  );
}
