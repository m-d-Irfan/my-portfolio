import React from "react";
import { usePortfolio } from "../context/context";
import { Server, Database, Layout, Cloud, CheckCircle2 } from "lucide-react";

export default function About() {
  const { data } = usePortfolio();

  const capabilities = [
    {
      title: "REST API & Backend Architecture",
      desc: "Building clean, scalable RESTful APIs using Python, Django, DRF, JWT authentication, and automated Swagger documentation.",
      icon: <Server className="w-5 h-5 text-primary" />,
    },
    {
      title: "Relational Database Modeling",
      desc: "Relational schema design, query optimization, indexing, and management with PostgreSQL and MySQL.",
      icon: <Database className="w-5 h-5 text-secondary" />,
    },
    {
      title: "Reactive Web Frontends",
      desc: "Developing fast, responsive interfaces using React 19, Next.js 15 App Router, TypeScript, and Tailwind CSS.",
      icon: <Layout className="w-5 h-5 text-accent" />,
    },
    {
      title: "DevOps & Cloud Infrastructure",
      desc: "Containerizing services with Docker, GitHub Actions CI/CD pipelines, AWS S3 storage, and Render/Vercel deployments.",
      icon: <Cloud className="w-5 h-5 text-info" />,
    },
  ];

  return (
    <section id="about" className="py-16 sm:py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-3">
            About Me
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Engineering Philosophy & Background
          </h2>
          <p className="font-sans text-base text-base-content/75">
            A deep dive into how I build systems, my background, and the technical challenges I enjoy solving.
          </p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Story & Capabilities */}
          <div className="lg:col-span-7 bg-base-200/60 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl">
            <h3 className="font-outfit text-xl font-bold mb-4 text-primary">
              Designing robust backend APIs that execute with speed, precision, and clean data modeling.
            </h3>
            
            <p className="font-sans text-sm sm:text-base text-base-content/85 leading-relaxed mb-4 text-justify">
              {data.about.bio}
            </p>

            <p className="font-sans text-sm sm:text-base text-base-content/85 leading-relaxed mb-6 text-justify">
              {data.about.journey}
            </p>

            {/* Capabilities */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {capabilities.map((cap, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-base-100/80 border border-base-300 hover:border-primary/40 transition-all duration-300"
                >
                  <div className="w-9 h-9 rounded-xl bg-base-200 flex items-center justify-center mb-3">
                    {cap.icon}
                  </div>
                  <h4 className="font-outfit font-bold text-sm text-base-content mb-1">
                    {cap.title}
                  </h4>
                  <p className="font-sans text-xs text-base-content/70 leading-relaxed">
                    {cap.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Quick Profile & Hobbies */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-base-200/60 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h3 className="font-outfit text-xl font-bold mb-4">Quick Overview</h3>
              <div className="space-y-3 font-sans text-sm">
                <div className="flex justify-between border-b border-base-300 pb-2">
                  <span className="font-mono text-xs text-base-content/60">Degree</span>
                  <span className="font-semibold">B.Sc. in CSE (CGPA 3.53)</span>
                </div>
                <div className="flex justify-between border-b border-base-300 pb-2">
                  <span className="font-mono text-xs text-base-content/60">Location</span>
                  <span className="font-semibold">Chattogram, Bangladesh</span>
                </div>
                <div className="flex justify-between border-b border-base-300 pb-2">
                  <span className="font-mono text-xs text-base-content/60">Languages</span>
                  <span className="font-semibold">English (Conversational), Bangla (Native)</span>
                </div>
                <div className="flex justify-between border-b border-base-300 pb-2">
                  <span className="font-mono text-xs text-base-content/60">Specialization</span>
                  <span className="font-semibold text-primary">Django, DRF & React/Next.js</span>
                </div>
              </div>
            </div>

            <div className="bg-base-200/60 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h3 className="font-outfit text-xl font-bold mb-4">Problem Solving & Passions</h3>
              <ul className="space-y-2.5 font-sans text-xs sm:text-sm text-base-content/80">
                {data.about.hobbies.map((hobby, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{hobby}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
