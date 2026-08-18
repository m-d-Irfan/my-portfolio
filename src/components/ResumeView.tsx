import React from "react";
import { usePortfolio } from "../context/context";
import { ArrowLeft, Printer, Download, Mail, Phone, MapPin, Github, Linkedin, Sun, Moon } from "lucide-react";

export default function ResumeView() {
  const { data, navigateToHome, theme, toggleTheme } = usePortfolio();

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      {/* Top Action Control Bar */}
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 mb-6 no-print border-b border-base-300 pb-4">
        <button
          onClick={() => navigateToHome()}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors font-outfit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Portfolio
        </button>

        <div className="inline-flex items-center gap-2 sm:gap-3">
          <a
            href="/assets/Monzurul_Islam.pdf"
            download="Monzurul_Islam_Resume.pdf"
            className="btn btn-outline btn-secondary btn-sm rounded-xl font-outfit gap-1.5 px-3"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>

          <button
            onClick={() => window.print()}
            className="hidden sm:inline-flex btn btn-primary btn-sm rounded-xl font-outfit gap-2 px-4 shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print / Export
          </button>

          <button
            onClick={(e) => toggleTheme(e)}
            className="btn btn-ghost btn-circle btn-sm text-base-content"
            aria-label="Toggle Theme"
          >
            {theme === "night" ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <main className="max-w-4xl mx-auto bg-base-100 border border-base-300 p-6 sm:p-10 rounded-3xl shadow-2xl print:p-0 print:border-none print:bg-white print:text-black print:shadow-none">
        {/* Header */}
        <header className="border-b-2 border-base-300 print:border-black pb-5 mb-5">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight text-gradient print:text-black print:bg-none">
                {data.name}
              </h1>
              <p className="font-outfit text-lg sm:text-xl font-semibold text-secondary print:text-gray-800 mt-1">
                {data.designation} · Backend & Full-Stack
              </p>
            </div>

            <div className="text-xs sm:text-sm font-sans space-y-1 text-left md:text-right print:text-black">
              <div className="flex items-center md:justify-end gap-2">
                <Mail className="w-4 h-4 text-primary shrink-0 print:text-black" />
                <a href={`mailto:${data.email}`} className="no-underline hover:underline hover:text-primary transition-colors">{data.email}</a>
              </div>
              <div className="flex items-center md:justify-end gap-2">
                <Phone className="w-4 h-4 text-secondary shrink-0 print:text-black" />
                <a href={`tel:${data.phone}`} className="no-underline hover:underline hover:text-secondary transition-colors">{data.phone}</a>
              </div>
              <div className="flex items-center md:justify-end gap-2">
                <MapPin className="w-4 h-4 text-accent shrink-0 print:text-black" />
                <span>{data.location}</span>
              </div>
              <div className="flex flex-wrap items-center md:justify-end gap-3 pt-1 text-xs opacity-90">
                <a href={data.socials.find((s) => s.title === "GitHub")?.link || "https://github.com/m-d-Irfan"} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline text-primary transition-colors">
                  GitHub: m-d-Irfan
                </a>
                <span>·</span>
                <a href={data.socials.find((s) => s.title === "LinkedIn")?.link || "https://linkedin.com/in/monzurul-islam-irfan/"} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline text-secondary transition-colors">
                  LinkedIn: monzurul-islam-irfan
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Career Objective */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Career Objective
          </h2>
          <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-95 text-justify">
            {data.careerObjective}
          </p>
        </section>

        {/* Technical Skills */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Technical Skills
          </h2>
          <div className="space-y-1.5 text-xs sm:text-sm font-sans">
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold sm:col-span-3">Backend & DBs:</span>
              <span className="sm:col-span-9">Python, Django, Django REST Framework (DRF), PostgreSQL, MySQL, Prisma ORM, REST APIs, JWT Auth</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold sm:col-span-3">Frontend:</span>
              <span className="sm:col-span-9">React.js (v19), Next.js (v15 App Router), TypeScript, JavaScript (ES6+), Tailwind CSS, HTML5, CSS3</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold sm:col-span-3">DevOps & Tools:</span>
              <span className="sm:col-span-9">Git, GitHub Actions CI/CD, Docker, AWS (S3, EC2), Render, Vercel, Postman, Swagger</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold sm:col-span-3">CS Fundamentals:</span>
              <span className="sm:col-span-9">Data Structures & Algorithms, Relational Schema Design, OOP, Competitive Programming</span>
            </div>
          </div>
        </section>

        {/* Featured Projects */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2.5">
            Projects & System Architecture
          </h2>
          <div className="space-y-4">
            {data.projects.map((proj) => (
              <div key={proj.id} className="text-xs sm:text-sm font-sans">
                <div className="flex flex-wrap justify-between items-baseline gap-2 mb-1">
                  <h3 className="font-outfit text-sm sm:text-base font-bold">
                    {proj.title} <span className="font-normal italic text-xs opacity-75">({proj.techStack.slice(0, 6).join(", ")})</span>
                  </h3>
                  <div className="flex gap-2 text-xs font-semibold text-primary print:text-black no-print">
                    <a href={proj.liveUrl} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline transition-colors">Live Demo</a>
                    <span>|</span>
                    <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline transition-colors">Client Repo</a>
                    {proj.githubBackendUrl && (
                      <>
                        <span>|</span>
                        <a href={proj.githubBackendUrl} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline transition-colors">Server API</a>
                      </>
                    )}
                  </div>
                </div>
                <ul className="list-disc list-outside pl-4 space-y-1 opacity-90 leading-relaxed text-justify">
                  {(proj.bullets || [proj.description]).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Education
          </h2>
          {data.education.map((edu) => (
            <div key={edu.id} className="text-xs sm:text-sm font-sans flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
              <div>
                <h3 className="font-bold">{edu.degree}, <span className="font-normal italic">{edu.institution}</span></h3>
                <p className="text-xs font-semibold text-secondary print:text-black mt-0.5">• {edu.grade}</p>
              </div>
              <div className="text-left sm:text-right text-xs opacity-85 shrink-0">
                <p className="font-semibold">{edu.dates}</p>
                <p>{edu.location}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Training */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Specialized Bootcamps & Certifications
          </h2>
          <div className="space-y-3 text-xs sm:text-sm font-sans">
            {data.training.map((t) => (
              <div key={t.id}>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold">{t.title}</h3>
                  <span className="text-xs font-semibold opacity-85">{t.dates}</span>
                </div>
                <p className="opacity-85 text-xs leading-relaxed mt-0.5 text-justify">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Competitive Programming */}
        <section className="mb-4">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Problem Solving & Competitive Profiles
          </h2>
          <div className="flex flex-wrap gap-6 text-xs sm:text-sm font-sans">
            <div>
              <strong>Codeforces:</strong> <a href={data.codeforcesUsername ? `https://codeforces.com/profile/${data.codeforcesUsername}` : "#"} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline text-primary transition-colors">{data.codeforcesUsername}</a>
            </div>
            <div>
              <strong>Codechef:</strong> <a href={data.codechefUsername ? `https://www.codechef.com/users/${data.codechefUsername}` : "#"} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline text-secondary transition-colors">{data.codechefUsername}</a>
            </div>
            <div>
              <strong>Portfolio:</strong> <a href={data.portfolioUrl} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline transition-colors">{data.portfolioUrl}</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
