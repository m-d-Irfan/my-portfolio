"use client";
import React from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/context";
import { FileText, ArrowRight, Download, ChevronDown } from "lucide-react";

export default function Hero() {
  const { theme, data, navigateToResume } = usePortfolio();

  return (
    <section
      id="home"
      className="relative min-h-[90vh] sm:min-h-[92vh] flex flex-col justify-center items-center py-6 sm:py-12 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 my-auto">
        
        {/* =========================================================
            MOBILE LAYOUT (< lg screens): Balanced split header + content
           ========================================================= */}
        <div className="flex lg:hidden flex-col justify-center gap-4 py-2">
          {/* Top Row: Left (Name & Designation) + Right (Prominent Avatar) */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Heading & Designation */}
            <div className="flex-1">
              <h1 className="font-outfit text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                Hi, I'm{" "}
                <span className="text-gradient block font-bold text-3xl xs:text-4xl sm:text-5xl mt-0.5">
                  {data.name}
                </span>
              </h1>
              <h2 className="font-outfit text-sm xs:text-base sm:text-xl font-semibold text-secondary mt-1">
                {data.designation}
              </h2>
            </div>

            {/* Right: Prominent Avatar Card */}
            <div className="relative group shrink-0">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary to-secondary opacity-40 blur-md group-hover:opacity-70 transition-opacity" />
              <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-2 border-primary/40 shadow-xl bg-base-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theme === "light" ? "/Monzurul Islam-Light.jpeg" : "/Monzurul Islam-Dark.jpeg"}
                  alt="Monzurul Islam"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>

          {/* Middle: Objective Paragraph */}
          <p className="font-sans text-xs xs:text-sm sm:text-base opacity-85 leading-relaxed text-justify my-1">
            {data.careerObjective}
          </p>

          {/* Bottom Actions: View Resume & Download PDF */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={navigateToResume}
              className="btn btn-primary btn-sm sm:btn-md font-outfit shadow-md shadow-primary/20 hover:shadow-xl transition-all duration-300 gap-1.5 text-xs sm:text-sm rounded-xl"
            >
              <FileText className="w-4 h-4" /> View Resume
            </button>

            <a
              href="/Monzurul_Islam.pdf"
              download="Monzurul_Islam_Resume.pdf"
              className="btn btn-outline btn-secondary btn-sm sm:btn-md font-outfit gap-1.5 text-xs sm:text-sm rounded-xl"
            >
              <Download className="w-4 h-4" /> Download PDF
            </a>
          </div>
        </div>

        {/* =========================================================
            DESKTOP LAYOUT (>= lg screens): 12-Column Grid
           ========================================================= */}
        <div className="hidden lg:grid grid-cols-12 gap-12 items-center py-6">
          {/* Left: Text Contents */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <h1 className="font-outfit text-5xl xl:text-6xl font-bold tracking-tight mb-4 leading-tight">
              Hi, I'm <span className="text-gradient">{data.name}</span>
            </h1>
            
            <h2 className="font-outfit text-2xl font-semibold text-secondary mb-6">
              {data.designation}
            </h2>

            <p className="font-sans text-base sm:text-lg opacity-85 leading-relaxed mb-8 max-w-2xl text-justify">
              {data.careerObjective}
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-4">
              <button
                onClick={navigateToResume}
                className="btn btn-primary font-outfit shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/35 transition-all duration-300 hover:scale-[1.03] gap-2 rounded-2xl"
              >
                <FileText className="w-5 h-5" /> View Resume
              </button>
              
              <a
                href="/Monzurul_Islam.pdf"
                download="Monzurul_Islam_Resume.pdf"
                className="btn btn-outline btn-secondary font-outfit gap-2 hover:scale-[1.03] transition-all rounded-2xl"
              >
                <Download className="w-5 h-5" /> Download PDF
              </a>

              <Link href="/#contact" className="btn btn-ghost font-outfit gap-2 hover:text-primary">
                Contact Me <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: Avatar Card */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="relative group w-80 h-80 xl:w-96 xl:h-96">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary to-secondary opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-500" />
              
              <div className="relative w-full h-full bg-base-200/90 border border-base-300/60 rounded-3xl p-6 flex flex-col justify-center items-center overflow-hidden transition-all duration-500 group-hover:border-primary/40 group-hover:shadow-2xl group-hover:shadow-primary/10">
                <div className="animate-float mb-12">
                  <div className="relative w-56 h-56 xl:w-64 xl:h-64 rounded-3xl overflow-hidden border-2 border-primary/30 shadow-2xl group-hover:border-primary/60 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={theme === "light" ? "/Monzurul Islam-Light.jpeg" : "/Monzurul Islam-Dark.jpeg"}
                      alt="Monzurul Islam"
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                  </div>
                </div>

                <div className="absolute bottom-6 left-6 right-6 text-center">
                  <span className="font-outfit font-bold text-lg tracking-wide block">{data.name}</span>
                  <span className="font-mono text-xs opacity-75 text-primary">{"<Full Stack Developer />"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================
          CUSTOM MODERN ANIMATED SCROLL INDICATOR
         ========================================================= */}
      <div className="flex justify-center items-center pt-4 z-20">
        <Link
          href="/#about"
          className="flex flex-col items-center gap-1.5 group opacity-80 hover:opacity-100 transition-all cursor-pointer select-none"
          aria-label="Scroll down to explore"
        >
          <span className="font-outfit text-[11px] font-semibold tracking-widest uppercase text-primary/90 group-hover:text-primary transition-colors">
            Scroll to explore
          </span>
          <div className="w-5 h-8 rounded-full border-2 border-primary/40 flex justify-center p-1 group-hover:border-primary transition-colors shadow-sm shadow-primary/20">
            <div className="w-1.5 h-2.5 rounded-full bg-primary animate-bounce" />
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-primary/70 -mt-1 animate-pulse" />
        </Link>
      </div>
    </section>
  );
}
