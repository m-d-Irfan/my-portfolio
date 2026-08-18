import React, { useState, useEffect } from "react";
import { usePortfolio } from "../context/context";
import { FileText, Download, Copy, Phone, ChevronDown } from "lucide-react";

const ROLES = [
  "Junior Software Engineer",
  "Backend Developer",
  "Full Stack Developer"
];

function RoleDiceRotator() {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % ROLES.length);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center h-7 sm:h-9 relative overflow-hidden align-middle">
      <div className="relative w-full h-full">
        {ROLES.map((role, idx) => (
          <span
            key={role}
            className={`transition-all duration-500 ease-out absolute top-0 left-0 whitespace-nowrap h-full flex items-center font-bold text-gradient ${
              idx === currentIdx
                ? "opacity-100 transform translate-y-0"
                : idx === (currentIdx - 1 + ROLES.length) % ROLES.length
                ? "opacity-0 transform translate-y-full"
                : "opacity-0 transform -translate-y-full"
            }`}
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  const { theme, data, navigateToResume, copyToClipboard } = usePortfolio();

  return (
    <section
      id="home"
      className="relative min-h-[90vh] sm:min-h-[92vh] flex flex-col justify-center items-center py-8 sm:py-16 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 my-auto">
        {/* =========================================================
            MOBILE LAYOUT (< lg screens)
           ========================================================= */}
        <div className="flex lg:hidden flex-col justify-center gap-5 py-2">
          {/* Top Row: Left (Name & Designation) + Right (Avatar) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-mono text-[11px] font-semibold mb-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>Available for Hire</span>
              </div>
              <h1 className="font-outfit text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                Hi, I'm{" "}
                <span className="text-gradient block font-bold text-3xl xs:text-4xl sm:text-5xl mt-0.5">
                  {data.name}
                </span>
              </h1>
              <div className="font-outfit text-sm xs:text-base sm:text-xl font-semibold text-secondary mt-1 min-h-[28px]">
                <RoleDiceRotator />
              </div>
            </div>

            {/* Avatar Card */}
            <div className="relative group shrink-0">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary to-secondary opacity-40 blur-md group-hover:opacity-70 transition-opacity" />
              <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-2 border-primary/40 shadow-xl bg-base-200">
                <img
                  src={theme === "light" ? "/assets/Monzurul Islam-Light.jpeg" : "/assets/Monzurul Islam-Dark.jpeg"}
                  alt={data.name}
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>

          {/* Career Objective */}
          <p className="font-sans text-xs xs:text-sm sm:text-base opacity-85 leading-relaxed text-justify my-1">
            {data.careerObjective}
          </p>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-2.5 mt-2">
            <a
              href="/assets/Monzurul_Islam.pdf"
              download="Monzurul_Islam_Resume.pdf"
              className="btn btn-primary btn-sm font-outfit shadow-md shadow-primary/20 hover:shadow-xl transition-all gap-1.5 text-xs rounded-xl"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </a>

            <button
              onClick={navigateToResume}
              className="btn btn-outline btn-secondary btn-sm font-outfit gap-1.5 text-xs rounded-xl"
            >
              <FileText className="w-3.5 h-3.5" /> View Resume
            </button>

            <button
              onClick={() => copyToClipboard(data.email, "Email address copied")}
              className="btn btn-outline btn-sm font-outfit gap-1.5 text-xs rounded-xl"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Email
            </button>

            <a
              href="https://wa.me/8801611836864"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm font-outfit text-primary gap-1.5 text-xs rounded-xl"
            >
              <Phone className="w-3.5 h-3.5" /> WhatsApp
            </a>
          </div>
        </div>

        {/* =========================================================
            DESKTOP LAYOUT (>= lg screens)
           ========================================================= */}
        <div className="hidden lg:grid grid-cols-12 gap-12 items-center py-6">
          {/* Left: Text Contents */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Available for Full-Time Roles</span>
            </div>

            <h1 className="font-outfit text-5xl xl:text-6xl font-bold tracking-tight mb-3 leading-tight">
              Hi, I'm <span className="text-gradient">{data.name}</span>
            </h1>

            <div className="font-outfit text-2xl font-semibold text-secondary mb-5 min-h-[36px]">
              <RoleDiceRotator />
            </div>

            <p className="font-sans text-base sm:text-lg opacity-85 leading-relaxed mb-8 max-w-2xl text-justify">
              {data.careerObjective}
            </p>

            {/* Recruiter Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 mb-8">
              <a
                href="/assets/Monzurul_Islam.pdf"
                download="Monzurul_Islam_Resume.pdf"
                className="btn btn-primary font-outfit shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/35 transition-all duration-300 hover:scale-[1.03] gap-2 rounded-2xl"
              >
                <Download className="w-4 h-4" /> Download Resume (PDF)
              </a>

              <button
                onClick={navigateToResume}
                className="btn btn-outline btn-secondary font-outfit gap-2 hover:scale-[1.03] transition-all rounded-2xl"
              >
                <FileText className="w-4 h-4" /> View Resume
              </button>

              <button
                onClick={() => copyToClipboard(data.email, "Email address copied")}
                className="btn btn-outline font-outfit gap-2 hover:scale-[1.03] transition-all rounded-2xl"
                title="Click to copy email"
              >
                <Copy className="w-4 h-4" /> Copy Email
              </button>

              <a
                href="https://wa.me/8801611836864"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost font-outfit text-primary gap-2 hover:scale-[1.03] transition-all rounded-2xl"
              >
                <Phone className="w-4 h-4" /> WhatsApp Chat
              </a>
            </div>

            {/* Core Competencies Tech Chips */}
            <div className="w-full">
              <div className="font-mono text-xs text-base-content/60 uppercase tracking-widest mb-3">
                Core Competencies & Stack
              </div>
              <div className="flex flex-wrap gap-2">
                {["Python", "Django", "DRF", "PostgreSQL", "REST APIs", "React 19", "Next.js 15", "TypeScript", "Docker"].map(
                  (tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 text-xs font-mono font-semibold rounded-lg bg-base-200 border border-base-300 text-base-content hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      {tech}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right: High-Fidelity Avatar Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group max-w-sm w-full">
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-primary via-secondary to-accent opacity-30 blur-xl group-hover:opacity-60 transition duration-500" />
              <div className="relative rounded-3xl overflow-hidden border-2 border-primary/40 bg-base-200 shadow-2xl">
                <img
                  src={theme === "light" ? "/assets/Monzurul Islam-Light.jpeg" : "/assets/Monzurul Islam-Dark.jpeg"}
                  alt={data.name}
                  className="w-full h-auto aspect-square object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-base-300/95 via-base-300/80 to-transparent flex justify-between items-end backdrop-blur-xs">
                  <div>
                    <div className="font-outfit font-bold text-base text-base-content">{data.name}</div>
                    <div className="font-sans text-xs text-primary font-semibold">{data.designation}</div>
                  </div>
                  <div className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    Chattogram, BD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Scroll Explorer Indicator (Windows / Desktop View) */}
        <div className="hidden lg:flex justify-center items-center mt-6">
          <a
            href="#projects"
            className="group flex flex-col items-center gap-1.5 text-xs font-mono text-base-content/60 hover:text-primary transition-colors cursor-pointer"
          >
            <span className="tracking-widest uppercase text-[10px]">Scroll to Explore</span>
            <div className="w-5 h-8 rounded-full border-2 border-base-content/30 group-hover:border-primary flex justify-center pt-1.5 transition-colors">
              <div className="w-1 h-2 rounded-full bg-primary animate-bounce" />
            </div>
            <ChevronDown className="w-3.5 h-3.5 animate-pulse" />
          </a>
        </div>
      </div>
    </section>
  );
}
