import React from "react";
import { portfolioData } from "@/data/portfolio";
import { Heart, Compass, Terminal, Award } from "lucide-react";

export default function About() {
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

  return (
    <section id="about" className="section py-20 bg-base-200/30 border-y border-base-300/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            About <span className="text-gradient">Me</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Side: Journey Text */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="font-outfit text-2xl font-bold text-base-content/95">
              My Programming Journey
            </h3>
            <p className="font-sans text-base opacity-80 leading-relaxed">
              {portfolioData.about.journey}
            </p>

            <h3 className="font-outfit text-2xl font-bold text-base-content/95 pt-2">
              What Drives Me & The Work I Enjoy
            </h3>
            <p className="font-sans text-base opacity-80 leading-relaxed">
              {portfolioData.about.enjoyWork}
            </p>

            {/* Profile Brief Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-base-200/50 border border-base-300/50 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">Location</span>
                <span className="font-outfit text-base font-semibold">{portfolioData.location}</span>
              </div>
              <div className="p-4 rounded-2xl bg-base-200/50 border border-base-300/50 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary font-mono">Email Contact</span>
                <a href={`mailto:${portfolioData.email}`} className="font-outfit text-base font-semibold hover:text-primary transition-colors truncate">
                  {portfolioData.email}
                </a>
              </div>
            </div>
          </div>

          {/* Right Side: Hobbies and Personal Highlights */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-base-200/40 backdrop-blur-md border border-base-300/50 shadow-xl">
              <h3 className="font-outfit text-2xl font-bold text-gradient mb-6">
                Personality & Hobbies
              </h3>
              
              <p className="font-sans text-sm opacity-75 mb-6 leading-relaxed">
                {portfolioData.about.bio}
              </p>

              <div className="space-y-4">
                {portfolioData.about.hobbies.map((hobby, index) => (
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

      </div>
    </section>
  );
}
