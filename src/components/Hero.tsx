"use client";
import React from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/context";
import { FileText, ArrowRight, Download } from "lucide-react";

export default function Hero() {
  const { theme, data, navigateToResume } = usePortfolio();

  return (
    <section
      id="home"
      className="relative min-h-[92vh] flex flex-col justify-between items-center pt-2 sm:pt-16 pb-4 sm:pb-8 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 my-auto">
        
        {/* =========================================================
            MOBILE LAYOUT (< lg screens): Split top header + paragraph + buttons
            All fits in ~95% of mobile viewport with zero scrolling required!
           ========================================================= */}
        <div className="flex lg:hidden flex-col justify-between gap-3 pt-2">
          {/* Top Row: Left (Name & Designation) + Right (Compact Avatar) */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Heading & Designation */}
            <div className="flex-1">
              <h1 className="font-outfit text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
                Hi, I'm{" "}
                <span className="text-gradient block font-bold text-3xl sm:text-5xl">
                  {data.name}
                </span>
              </h1>
              <h2 className="font-outfit text-sm sm:text-xl font-semibold text-secondary mt-1">
                {data.designation}
              </h2>
            </div>

            {/* Right: Compact Avatar */}
            <div className="relative group shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary to-secondary opacity-40 blur-md group-hover:opacity-70 transition-opacity" />
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-xl bg-base-200">
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
          <p className="font-sans text-xs sm:text-base opacity-85 leading-relaxed text-justify my-1">
            {data.careerObjective}
          </p>

          {/* Bottom Actions: View Resume & Download PDF */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-1">
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
        <div className="hidden lg:grid grid-cols-12 gap-12 items-center py-8">
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
          BOTTOM 5%: Scroll Indicator GIF (Scroll.gif)
         ========================================================= */}
      <div className="flex justify-center items-center pt-2 z-20">
        <Link
          href="/#about"
          className="flex flex-col items-center gap-1 group opacity-85 hover:opacity-100 transition-opacity"
          aria-label="Scroll down to explore sections"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Scroll.gif"
            alt="Scroll down indicator"
            className="w-7 h-10 sm:w-8 sm:h-12 object-contain drop-shadow-md group-hover:scale-110 transition-transform"
          />
        </Link>
      </div>
    </section>
  );
}
