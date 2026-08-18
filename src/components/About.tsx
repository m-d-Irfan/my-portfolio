"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePortfolio } from "@/context/context";
import { Heart, Compass, Terminal, Award, Server, Layout } from "lucide-react";

export default function About() {
  const { data } = usePortfolio();
  const servicesRef = useRef<HTMLDivElement>(null);
  const [servicesInView, setServicesInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setServicesInView(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    if (servicesRef.current) {
      observer.observe(servicesRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getAboutIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Terminal className="w-5 h-5 text-primary" />;
      case 1:
        return <Award className="w-5 h-5 text-secondary" />;
      case 2:
        return <Compass className="w-5 h-5 text-accent" />;
      default:
        return <Heart className="w-5 h-5 text-success" />;
    }
  };

  const services = [
    {
      title: "API & Backend Dev",
      desc: "Designing and building clean, secure RESTful APIs using Python, Django, DRF, Node.js, and JWT auth.",
      icon: <Terminal className="w-6 h-6" />,
      colorClass: "primary",
    },
    {
      title: "Database Design",
      desc: "Relational database modeling, query tuning, indexing, and management in PostgreSQL and MySQL.",
      icon: <Server className="w-6 h-6" />,
      colorClass: "secondary",
    },
    {
      title: "Frontend Integration",
      desc: "Crafting fast, responsive interfaces with Next.js 15, React 19, TypeScript, and Tailwind CSS.",
      icon: <Layout className="w-6 h-6" />,
      colorClass: "accent",
    },
    {
      title: "DevOps & Automation",
      desc: "Docker setups, CI/CD pipelines (GitHub Actions), AWS storage, and workflow automation in n8n.",
      icon: <Award className="w-6 h-6" />,
      colorClass: "success",
    },
  ];

  return (
    <section id="about" className="section py-20 bg-base-200/30 border-y border-base-300/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            About <span className="text-gradient">Me</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full" />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Side: Journey Text */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="font-outfit text-2xl font-bold text-base-content/95">
              My Programming Journey
            </h3>
            <p className="font-sans text-base opacity-80 leading-relaxed">
              {data.about.journey}
            </p>

            <h3 className="font-outfit text-2xl font-bold text-base-content/95 pt-2">
              What Drives Me & The Work I Enjoy
            </h3>
            <p className="font-sans text-base opacity-80 leading-relaxed">
              {data.about.enjoyWork}
            </p>

            {/* Profile Brief Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-base-200/50 border border-base-300/50 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">Location</span>
                <span className="font-outfit text-base font-semibold">{data.location}</span>
              </div>
              <div className="p-4 rounded-2xl bg-base-200/50 border border-base-300/50 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary font-mono">Email Contact</span>
                <a href={`mailto:${data.email}`} className="font-outfit text-base font-semibold hover:text-primary transition-colors truncate">
                  {data.email}
                </a>
              </div>
            </div>
          </div>

          {/* Right Side: Hobbies and Personal Highlights */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-base-200/90 border border-base-300/50 shadow-xl">
              <h3 className="font-outfit text-2xl font-bold text-gradient mb-6">
                Personality & Hobbies
              </h3>
              
              <p className="font-sans text-sm opacity-75 mb-6 leading-relaxed">
                {data.about.bio}
              </p>

              <div className="space-y-4">
                {data.about.hobbies.map((hobby, index) => (
                  <div
                    key={index}
                    className="flex gap-4 p-3 rounded-2xl bg-base-100/60 border border-base-200 hover:border-primary/20 transition-all duration-300 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-base-200/80 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      {getAboutIcon(index)}
                    </div>
                    <div>
                      <p className="font-sans text-sm font-medium leading-relaxed opacity-90">
                        {hobby}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* =========================================================
            Services & Capabilities Section:
            - Windows/Desktop: Cards slide in clearly from the LEFT
            - Mobile: Cards slide in clearly from the UPSIDE / TOP
           ========================================================= */}
        <div ref={servicesRef} className="mt-20 pt-16 border-t border-base-300/40 overflow-hidden">
          <h3 className="font-outfit text-2xl sm:text-3xl font-bold text-center mb-12">
            Services & <span className="text-gradient">Capabilities</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {services.map((service, index) => (
              <div
                key={service.title}
                style={{
                  transitionDelay: `${index * 180}ms`,
                }}
                className={`p-6 rounded-3xl bg-base-200/50 border border-base-300/50 hover:border-primary/30 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group hover:shadow-xl hover:scale-[1.02] will-change-transform ${
                  servicesInView
                    ? "opacity-100 translate-x-0 translate-y-0 scale-100"
                    : "opacity-0 -translate-y-14 md:translate-y-0 md:-translate-x-20 scale-95"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 ${
                    service.colorClass === "primary"
                      ? "bg-primary/10 text-primary"
                      : service.colorClass === "secondary"
                      ? "bg-secondary/10 text-secondary"
                      : service.colorClass === "accent"
                      ? "bg-accent/10 text-accent"
                      : "bg-success/10 text-success"
                  }`}
                >
                  {service.icon}
                </div>
                <h4 className="font-outfit text-lg font-bold mb-2">{service.title}</h4>
                <p className="font-sans text-xs opacity-75 leading-relaxed">
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
