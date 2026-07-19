"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { portfolioData } from "@/data/portfolio";
import { Github, Linkedin, Mail, Code, FileText, ArrowRight, Download } from "lucide-react";

export default function Hero() {
  const [theme, setTheme] = useState<string>("night");

  useEffect(() => {
    // Initial theme check
    const currentTheme = document.documentElement.getAttribute("data-theme") || "night";
    setTheme(currentTheme);

    // Event listener for theme changes from Navbar
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setTheme(customEvent.detail || "night");
    };

    window.addEventListener("theme-change", handleThemeChange);
    return () => window.removeEventListener("theme-change", handleThemeChange);
  }, []);

  const getSocialIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "github":
        return <Github className="w-5 h-5" />;
      case "linkedin":
        return <Linkedin className="w-5 h-5" />;
      case "codeforces":
        return <Code className="w-5 h-5" />;
      case "email":
        return <Mail className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <section id="home" className="relative min-h-[90vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Background glow animations */}
      <div className="glow-circle-1"></div>
      <div className="glow-circle-2"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12">
        
        {/* Left: Text Contents */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">



          {/* Heading */}
          <h1 className="font-outfit text-4xl sm:text-6xl font-bold tracking-tight mb-4">
            Hi, I'm <span className="text-gradient">{portfolioData.name}</span>
          </h1>
          
          {/* Subheading Designation */}
          <h2 className="font-outfit text-xl sm:text-2xl font-semibold text-secondary mb-6">
            {portfolioData.designation}
          </h2>

          {/* Objective Paragraph */}
          <p className="font-sans text-base sm:text-lg opacity-80 leading-relaxed mb-8 max-w-2xl">
            {portfolioData.careerObjective}
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-8">
            <Link
              href="/resume"
              className="btn btn-primary font-outfit shadow-lg shadow-primary/20 hover:shadow-primary/45 transition-all duration-300"
            >
              <FileText className="w-5 h-5" /> View Resume
            </Link>
            
            <a
              href="/Monzurul_Islam.pdf"
              download="Monzurul_Islam_Resume.pdf"
              className="btn btn-outline btn-secondary font-outfit"
            >
              <Download className="w-5 h-5" /> Download PDF
            </a>

            <Link href="/#contact" className="btn btn-ghost font-outfit gap-2">
              Contact Me <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right: Premium Graphic/Avatar Card */}
        <div className="lg:col-span-5 flex justify-center items-center">
          <div className="relative group w-72 h-72 sm:w-96 sm:h-96">
            
            {/* Pulsing Backlighting */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary to-secondary opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-500"></div>
            
            {/* Card Frame - Removed backdrop-blur-md and changed opacity to prevent horizontal line screen tearing */}
            <div className="relative w-full h-full bg-base-200/90 border border-base-300/60 rounded-3xl p-6 flex flex-col justify-center items-center overflow-hidden transition-all duration-500 group-hover:border-primary/40 group-hover:shadow-2xl group-hover:shadow-primary/5">
              
              {/* Floating Wrapper - decodes keyframe translateY animation */}
              <div className="animate-float mb-12">
                {/* Profile Image - handles scale transition on hover smoothly by using transition-transform instead of transition-all */}
                <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-2 border-primary/20 shadow-xl group-hover:border-primary/50 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                  <img
                    src={theme === "light" ? "/Monzurul Islam-Light.jpeg" : "/Monzurul Islam-Dark.jpeg"}
                    alt="Monzurul Islam"
                    className="w-full h-full object-cover object-center"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-base-950/80 via-transparent to-transparent opacity-60"></div>
                </div>
              </div>

              {/* Tag overlay */}
              <div className="absolute bottom-6 left-6 right-6 text-center">
                <span className="font-outfit font-bold text-lg tracking-wide block">Monzurul Islam</span>
                <span className="font-mono text-xs opacity-65 text-primary">{"<Backend & API Developer />"}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
