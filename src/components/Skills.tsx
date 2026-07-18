import React from "react";
import { portfolioData } from "@/data/portfolio";
import { Code, Server, Layout, Settings } from "lucide-react";

export default function Skills() {
  const getCategoryIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "languages":
        return <Code className="w-5 h-5 text-primary" />;
      case "backend & dbs":
        return <Server className="w-5 h-5 text-secondary" />;
      case "frontend development":
        return <Layout className="w-5 h-5 text-accent" />;
      default:
        return <Settings className="w-5 h-5 text-neutral-content" />;
    }
  };

  const getSkillIcon = (name: string) => {
    const n = name.toLowerCase();
    
    // SVG icons with official brand colors
    if (n.includes("python")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.93 2C8.36 2 8.65 3.54 8.65 3.54L8.67 5.17H12.06V5.65H7.28C5.24 5.65 3.5 7.15 3.5 9.4C3.5 11.66 4.97 12.92 6.55 12.92H7.95V11.23C7.95 9.21 9.53 7.82 11.55 7.82H16.63V4.44C16.63 4.44 16.92 2 11.93 2Z" fill="#3776AB"/>
          <path d="M12.06 22C15.63 22 15.34 20.46 15.34 20.46L15.32 18.83H11.93V18.35H16.71C18.75 18.35 20.5 16.85 20.5 14.6C20.5 12.34 19.02 11.08 17.44 11.08H16.04V12.77C16.04 14.79 14.46 16.18 12.44 16.18H7.36V19.56C7.36 19.56 7.07 22 12.06 22Z" fill="#FFD343"/>
          <circle cx="10.22" cy="4.35" r="0.75" fill="#F9FAFB"/>
          <circle cx="13.78" cy="19.65" r="0.75" fill="#111827"/>
        </svg>
      );
    }
    if (n.includes("typescript")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#3178C6"/>
          <path d="M15.56 12.87V14.16C15.56 16.53 14.28 17.5 12 17.5C10 17.5 8.71 16.48 8.71 14.7H10.15C10.15 15.82 10.87 16.32 11.94 16.32C13.25 16.32 14.07 15.65 14.07 14.16V12.87H15.56Z" fill="white"/>
          <path d="M20.24 9.17H16.07V10.45H17.4V17.38H18.91V10.45H20.24V9.17Z" fill="white"/>
        </svg>
      );
    }
    if (n.includes("javascript")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#F7DF1E"/>
          <path d="M16 16.5C16.3 16.7 16.8 17 17.5 17C18.2 17 18.5 16.6 18.5 16C18.5 15.3 18.1 15 17.1 14.6L16.2 14.2C15.1 13.8 14.3 12.8 14.3 11.5C14.3 9.8 15.8 8.8 17.8 8.8C19.1 8.8 20.1 9.3 20.7 9.8L19.8 11.2C19.3 10.8 18.7 10.4 17.8 10.4C17 10.4 16.1 10.8 16.1 11.6C16.1 12.2 16.5 12.5 17.3 12.8L18.2 13.2C19.6 13.7 20.4 14.6 20.4 16.1C20.4 18.1 18.8 19.2 16.8 19.2C15.3 19.2 14 18.5 13.3 17.8L14.4 16.2C14.9 16.6 15.6 16.9 16.3 16.9V16.5Z" fill="black"/>
          <path d="M10.8 8.8H12.3V16.3C12.3 18 11.2 19 9.3 19C8 19 7 18.4 6.3 17.8L7.4 16.2C7.9 16.6 8.5 16.9 9.2 16.9C10.2 16.9 10.7 16.4 10.7 15.3V8.8H10.8Z" fill="black"/>
        </svg>
      );
    }
    if (n.includes("c++")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 6.5V17.5L12 22L22 17.5V6.5L12 2Z" fill="#00599C"/>
          <path d="M12 4.1L4 7.7V16.3L12 19.9L20 16.3V7.7L12 4.1Z" fill="#004482"/>
          <path d="M13.5 9.5H15.5V11H13.5V13H12V11H10V9.5H12V7.5H13.5V9.5Z" fill="#659AD2"/>
          <path d="M19.5 9.5H21.5V11H19.5V13H18V11H16V9.5H18V7.5H19.5V9.5Z" fill="#659AD2"/>
          <path d="M9.5 14C8.8 14 8 13.5 8 12.5C8 11.5 8.8 11 9.5 11C10.2 11 10.7 11.3 11 11.7L12.3 10.7C11.8 10 10.8 9.5 9.5 9.5C7.5 9.5 6 10.8 6 12.5C6 14.2 7.5 15.5 9.5 15.5C10.8 15.5 11.8 15 12.3 14.3L11 13.3C10.7 13.7 10.2 14 9.5 14Z" fill="white"/>
        </svg>
      );
    }
    if (n.includes("django")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#092E20"/>
          <path d="M7 6.5C7 5.1 8 4 9.5 4H10.5V9.5H9.5C8 9.5 7 8.4 7 7V6.5ZM8.5 7C8.5 7.6 8.9 8 9.5 8V5.5C8.9 5.5 8.5 5.9 8.5 6.5V7Z" fill="#0DF6B6"/>
          <path d="M12.5 10C12.5 10.6 12.9 11 13.5 11C14.1 11 14.5 10.6 14.5 10V6H16V10C16 11.7 14.8 12.5 13.5 12.5C12.2 12.5 11 11.7 11 10H12.5Z" fill="#0DF6B6"/>
          <path d="M17 12V4H18.5V12H17Z" fill="#0DF6B6"/>
        </svg>
      );
    }
    if (n.includes("rest") || n.includes("api") || n.includes("jwt")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#8B5CF6"/>
          <path d="M12 6V10M12 14V18M6 12H10M14 12H18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
        </svg>
      );
    }
    if (n.includes("postgres")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.39 12.63C16.89 14.12 15.34 15 13.5 15H11.5V17H9.5V15H7.5V13H9.5V11H7.5V9H9.5V7H11.5V9H13.5C15.34 9 16.89 9.88 17.39 11.37C17.58 11.95 17.58 12.05 17.39 12.63ZM13.5 13C14.33 13 15 12.33 15 11.5C15 10.67 14.33 10 13.5 10H11.5V13H13.5Z" fill="#336791"/>
        </svg>
      );
    }
    if (n.includes("mysql")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12C4 7.58 7.58 4 12 4C14.53 4 16.8 5.18 18.3 7.03L19.82 5.51C17.91 3.32 15.11 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C15.22 22 18.09 20.61 20 18.37L18.42 16.87C16.91 18.8 14.6 20 12 20C7.58 20 4 16.42 4 12Z" fill="#00758F"/>
          <path d="M12 8V12L15 15" stroke="#F29111" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    }
    if (n.includes("node")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4 6.5V15.5L12 20L20 15.5V6.5L12 2Z" fill="#339933"/>
          <path d="M12 4.1L6.1 7.4V14.6L12 17.9L17.9 14.6V7.4L12 4.1Z" fill="#215732"/>
          <path d="M12 6.5L8.5 8.5V12.5L12 14.5L15.5 12.5V8.5L12 6.5Z" fill="#339933"/>
        </svg>
      );
    }
    if (n.includes("react")) {
      return (
        <svg className="w-8 h-8 animate-spin-slow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 2 12 22Z" stroke="#61DAFB" strokeWidth="1" strokeDasharray="3 3"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(30 12 12)"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(90 12 12)"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(150 12 12)"/>
          <circle cx="12" cy="12" r="1.5" fill="#61DAFB"/>
        </svg>
      );
    }
    if (n.includes("next.js")) {
      return (
        <svg className="w-8 h-8 bg-black rounded-full p-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.5 17.5L12 10.5V17H10.5V7H12L17.5 14V7H19V17.5H17.5Z" fill="white"/>
        </svg>
      );
    }
    if (n.includes("tailwind") || n.includes("daisy")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 6C8.5 6 6 8.5 6 12C6 15.5 8.5 18 12 18C15.5 18 18 15.5 18 12C18 8.5 15.5 6 12 6ZM11.5 14.5C10.12 14.5 9 13.38 9 12C9 10.62 10.12 9.5 11.5 9.5C12.88 9.5 14 10.62 14 12C14 13.38 12.88 14.5 11.5 14.5Z" fill="#38BDF8"/>
          <path d="M18.5 12C18.5 8.41 15.59 5.5 12 5.5C8.41 5.5 5.5 8.41 5.5 12C5.5 15.59 8.41 18.5 12 18.5C15.59 18.5 18.5 15.59 18.5 12Z" stroke="#38BDF8" strokeWidth="1"/>
        </svg>
      );
    }
    if (n.includes("html5")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 2L4.82 20.18L12 22L19.18 20.18L21 2V2H3ZM17.18 8.18H10.18L10.36 10H16.82L16.27 15.45L12 16.64L7.73 15.45L7.45 12.73H9.27L9.41 14.09L12 14.82L14.59 14.09L14.86 11.45H7.32L6.77 6H17.41L17.18 8.18Z" fill="#E34F26"/>
        </svg>
      );
    }
    if (n.includes("css3")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 2L4.82 20.18L12 22L19.18 20.18L21 2H3ZM17.18 8.18H9.36L9.55 10H16.82L16.27 15.45L12 16.64L7.73 15.45L7.45 12.73H9.27L9.41 14.09L12 14.82L14.59 14.09L14.86 11.45H7.32L6.77 6H17.41L17.18 8.18Z" fill="#1572B6"/>
        </svg>
      );
    }
    if (n.includes("git")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.5 11.23L12.77 2.5C12.38 2.11 11.75 2.11 11.36 2.5L2.5 11.36C2.11 11.75 2.11 12.38 2.5 12.77L11.23 21.5C11.62 21.89 12.25 21.89 12.64 21.5L21.5 12.64C21.89 12.25 21.89 11.62 21.5 11.23ZM13.84 15.5V13.84C12.44 13.84 11.4 14.28 10.7 15.22C10.98 13.82 11.82 12.42 13.84 12.14V10.5L16.5 13L13.84 15.5Z" fill="#F05032"/>
        </svg>
      );
    }
    if (n.includes("docker")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 11.56V13.89C2 15.86 3.6 17.46 5.56 17.46H18.44C20.4 17.46 22 15.86 22 13.89V11.56H2ZM19.2 16.14H4.8C4.36 16.14 4 15.78 4 15.34C4 14.9 4.36 14.54 4.8 14.54H19.2C19.64 14.54 20 14.9 20 15.34C20 15.78 19.64 16.14 19.2 16.14Z" fill="#2496ED"/>
          <rect x="5.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="8.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="11.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="14.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="8.5" y="5" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="11.5" y="5" width="2" height="2" rx="0.5" fill="#2496ED"/>
        </svg>
      );
    }
    if (n.includes("render") || n.includes("vercel")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 20H22L12 2Z" fill="black"/>
        </svg>
      );
    }
    if (n.includes("aws") || n.includes("s3") || n.includes("ec2")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#232F3E"/>
          <path d="M6 14.5C6 12 8.5 11 11 11V14.5H6ZM11 16H12.5V9.5H11V16ZM14 16H15.5V11.5H14V16ZM17 16H18.5V9.5H17V16Z" fill="white"/>
          <path d="M6 17.5C10 19.5 14 19.5 18 17.5" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    }
    if (n.includes("prisma")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="#0C344B"/>
          <path d="M12 4.5L5.5 8.2V15.8L12 19.5L18.5 15.8V8.2L12 4.5Z" fill="#5A67D8"/>
        </svg>
      );
    }
    if (n.includes("postman")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#FF6C37"/>
          <path d="M7.5 14.5L11 8.5L14.5 14.5H7.5Z" fill="white"/>
          <path d="M12.5 15.5H11.5V12.5H12.5V15.5Z" fill="white"/>
        </svg>
      );
    }

    // Default general code/settings icon
    return <Code className="w-8 h-8 text-neutral-content/60" />;
  };

  return (
    <section id="skills" className="section py-24 bg-base-100 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Technical <span className="text-gradient">Skills</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            A comprehensive overview of my programming languages, frameworks, databases, and DevOps tools.
          </p>
        </div>

        {/* Skill Category Grid - Collapses on Mobile, Side by Side on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {portfolioData.skills.map((category) => (
            <div
              key={category.title}
              // Category Card Design - High-opacity base color without backdrop-blur to prevent tearing visual glitches
              className="p-6 sm:p-8 rounded-[1.75rem] bg-base-200/90 border border-base-300/50 hover:border-primary/25 shadow-md shadow-base-300/10 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 group"
            >
              {/* Category Header */}
              <div className="flex items-center gap-3.5 mb-8 border-b border-base-300/40 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-base-100 border border-base-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-350 shadow-sm">
                  {getCategoryIcon(category.title)}
                </div>
                <h3 className="font-outfit text-xl font-bold text-base-content/90 tracking-tight">
                  {category.title}
                </h3>
              </div>

              {/* Skills List Sub-Grid - 3 columns on Laptop, 2 columns on Mobile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {category.skills.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-base-100/60 border border-base-300/40 hover:border-primary/30 hover:bg-base-100 hover:scale-[1.03] transition-all duration-300 hover:shadow-sm group/badge"
                  >
                    {/* SVG Brand Icon */}
                    <div className="w-12 h-12 flex items-center justify-center mb-3 group-hover/badge:scale-110 transition-transform duration-300">
                      {getSkillIcon(skill.name)}
                    </div>
                    {/* Name Label */}
                    <span className="font-outfit text-[11px] font-bold text-center text-base-content/75 group-hover/badge:text-primary uppercase tracking-wider transition-colors duration-300 select-none">
                      {skill.name}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
