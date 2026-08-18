"use client";
import React from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/PortfolioContext";
import AuraBackground from "@/components/AuraBackground";
import { ArrowLeft, Printer, Download, Github, Linkedin, Mail, Phone, MapPin, Globe, ExternalLink } from "lucide-react";

export default function ResumePage() {
  const { data, navigateToHome } = usePortfolio();

  const handlePrint = () => {
    window.print();
  };

  return (
    <AuraBackground className="py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Action Header Bar (Excluded in Print) */}
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-6 no-print border-b border-base-300/60 pb-4">
        <button
          onClick={() => navigateToHome()}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors font-outfit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Portfolio
        </button>

        <div className="flex items-center gap-3">
          <a
            href="/Monzurul_Islam.pdf"
            download="Monzurul_Islam_Resume.pdf"
            className="btn btn-outline btn-secondary btn-sm rounded-xl font-outfit gap-1.5 shadow-sm hover:scale-[1.02] transition-all"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>

          <button
            onClick={handlePrint}
            className="btn btn-primary btn-sm rounded-xl font-outfit gap-1.5 shadow-md shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] transition-all"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* High-Fidelity Printable Resume Sheet */}
      <main className="max-w-4xl mx-auto bg-base-200/90 [data-theme='light']:bg-white border border-base-300/60 p-6 sm:p-10 rounded-3xl shadow-2xl print-card print:p-0 print:border-none print:bg-white print:text-black animate-fade-in">
        
        {/* Top Header Information */}
        <header className="border-b-2 border-base-300 print:border-black pb-4 mb-5">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight text-gradient print:text-black print:bg-none">
                {data.name}
              </h1>
              <p className="font-outfit text-lg font-semibold text-secondary print:text-gray-800 mt-0.5">
                {data.designation}
              </p>
            </div>

            {/* Quick Contact Info */}
            <div className="text-xs sm:text-sm font-sans opacity-90 space-y-1 text-left md:text-right print:text-black">
              <div className="flex flex-wrap items-center md:justify-end gap-x-2 gap-y-1">
                <a href={`mailto:${data.email}`} className="hover:underline flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 print:hidden text-primary" /> {data.email}
                </a>
                <span>|</span>
                <a href={`tel:${data.phone}`} className="hover:underline flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 print:hidden text-secondary" /> {data.phone}
                </a>
                <span>|</span>
                <span>{data.location}</span>
              </div>
              
              <div className="flex flex-wrap items-center md:justify-end gap-x-2 gap-y-1 pt-0.5 text-xs">
                <a href="https://github.com/m-d-Irfan" target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">
                  github.com/m-d-Irfan
                </a>
                <span>|</span>
                <a href="https://linkedin.com/in/monzurul-islam-irfan/" target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">
                  linkedin.com/in/monzurul-islam-irfan/
                </a>
              </div>

              <div className="flex flex-wrap items-center md:justify-end gap-x-2 gap-y-1 pt-0.5 text-xs opacity-85">
                <span>Portfolio: <a href="https://monzurul-islam.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">monzurul-islam</a></span>
                <span>|</span>
                <span>Codeforce: <a href="https://codeforces.com/profile/monzurul.islam2022" target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">monzurul.islam2022</a></span>
                <span>|</span>
                <span>Codechef: <a href="https://www.codechef.com/users/montikuna_2" target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">montikuna_2</a></span>
              </div>
            </div>
          </div>
        </header>

        {/* Section: CAREER OBJECTIVE */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Career Objective
          </h2>
          <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-95 text-justify">
            {data.careerObjective}
          </p>
        </section>

        {/* Section: SKILL */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Skill
          </h2>
          <div className="space-y-1 text-xs sm:text-sm font-sans">
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Languages:</span>
              <span className="opacity-90 sm:col-span-9">Python, JavaScript, TypeScript</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Backend:</span>
              <span className="opacity-90 sm:col-span-9">Django, Django REST Framework (DRF), REST APIs, JWT</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Databases:</span>
              <span className="opacity-90 sm:col-span-9">MySQL, PostgreSQL</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Frontend:</span>
              <span className="opacity-90 sm:col-span-9">React.js(v19), Next.js(v15), HTML5, Tailwind CSS, JavaScript</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Concepts:</span>
              <span className="opacity-90 sm:col-span-9">Object-Oriented Programming, DSA, CRUD, Axios</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Tools & DevOps:</span>
              <span className="opacity-90 sm:col-span-9">Git, GitHub, Render, Vercel, Postman, AWS, Prisma.</span>
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-2">
              <span className="font-bold opacity-90 sm:col-span-3">Hard Skill:</span>
              <span className="opacity-90 sm:col-span-9">MS Word, PowerPoint, Excel, Bangla type.</span>
            </div>
          </div>
        </section>

        {/* Section: PROJECTS */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2.5">
            Projects
          </h2>
          <div className="space-y-4">
            {/* EduCore AI */}
            <div className="text-xs sm:text-sm font-sans">
              <div className="flex flex-wrap justify-between items-baseline gap-2 mb-1">
                <h3 className="font-outfit text-sm sm:text-base font-bold opacity-95">
                  EduCore AI <span className="font-normal italic text-xs opacity-80">(Django, DRF, JWT, RestAPIs, React.js, Next.js, TypeScript)</span>
                </h3>
                <div className="flex gap-2 text-xs font-semibold text-primary print:text-black no-print">
                  <a href="https://educore-ai-tan.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:underline">Live</a>
                  <span>|</span>
                  <a href="https://github.com/m-d-Irfan/LLC_FrontEnd" target="_blank" rel="noopener noreferrer" className="hover:underline">Client</a>
                  <span>|</span>
                  <a href="https://github.com/m-d-Irfan/LLC_backend" target="_blank" rel="noopener noreferrer" className="hover:underline">Server</a>
                </div>
              </div>
              <ul className="list-disc list-outside pl-4 space-y-1 opacity-90 leading-relaxed text-justify">
                <li>
                  <strong>Role-based access & admin control</strong> — Users register as student or instructor; instructor accounts stay pending until an admin approves or rejects them (with an emailed reason). Enforced via JWT auth and role-based route middleware, with an admin dashboard for stats, user/course management, and enrollment cancellation.
                </li>
                <li>
                  <strong>Course authoring (instructor)</strong> — Instructors create courses with modules and ordered lessons (title, content, video URL, thumbnails, pricing, publish toggle), managed from an instructor dashboard.
                </li>
                <li>
                  <strong>Enrollment & lesson progress tracking (student)</strong> — Students browse/search published courses, enroll, work through lessons, and have completion progress tracked per lesson.
                </li>
                <li>
                  <strong>Automated certificate issuance</strong> — Once a student finishes every lesson in a course, the backend auto-generates a certificate (unique ID) and emails it; a certificates list is available on their dashboard.
                </li>
              </ul>
            </div>

            {/* Sports Blog CMS */}
            <div className="text-xs sm:text-sm font-sans">
              <div className="flex flex-wrap justify-between items-baseline gap-2 mb-1">
                <h3 className="font-outfit text-sm sm:text-base font-bold opacity-95">
                  Sports Blog CMS <span className="font-normal italic text-xs opacity-80">(Python · Django · MySQL)</span>
                </h3>
                <div className="flex gap-2 text-xs font-semibold text-primary print:text-black no-print">
                  <a href="https://sport-blogs.onrender.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">Live</a>
                  <span>|</span>
                  <a href="https://github.com/m-d-Irfan/Basic-Blog" target="_blank" rel="noopener noreferrer" className="hover:underline">Client</a>
                  <span>|</span>
                  <a href="https://github.com/m-d-Irfan/Basic-Blog" target="_blank" rel="noopener noreferrer" className="hover:underline">Server</a>
                </div>
              </div>
              <ul className="list-disc list-outside pl-4 space-y-1 opacity-90 leading-relaxed text-justify">
                <li>
                  <strong>User authentication</strong> — Visitors sign up and log in (Django's built-in auth) to get posting rights; logged-out users can still browse.
                </li>
                <li>
                  <strong>Post authoring & management</strong> — Logged-in users create, edit, and delete their own blog posts, each assigned to a category, with a personal "my posts" view filtered by author.
                </li>
                <li>
                  <strong>Category browsing</strong> — Posts are organized into categories that can be created/updated/deleted, and visitors can filter posts by category to read related content together.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section: EDUCATION */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Education
          </h2>
          <div className="text-xs sm:text-sm font-sans flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
            <div>
              <h3 className="font-bold opacity-95">B.Sc. in Computer Science & Engineering, <span className="font-normal italic">Port City International University, Chittagong</span></h3>
              <p className="text-xs font-semibold text-secondary print:text-black mt-0.5">• CGPA: 3.53 / 4.00</p>
            </div>
            <div className="text-left sm:text-right text-xs opacity-85 shrink-0">
              <p className="font-semibold">01/2022 – 02/2026</p>
              <p>Chittagong, Bangladesh</p>
            </div>
          </div>
        </section>

        {/* Section: TRAINING */}
        <section className="mb-5">
          <h2 className="font-outfit text-sm sm:text-base font-bold uppercase tracking-wider text-primary print:text-black border-b border-base-300 print:border-black pb-0.5 mb-2">
            Training
          </h2>
          <div className="space-y-3 text-xs sm:text-sm font-sans">
            <div>
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold opacity-95">Computer Science Fundamentals − with Phitron</h3>
                <span className="text-xs font-semibold opacity-85">2023 – 2024</span>
              </div>
              <p className="opacity-85 text-xs leading-relaxed mt-0.5">
                Industry oriented training around 210 hours covering C++, Python, Data Structure and Algorithm, Object Oriented Programming, Competitive Programming, Database Management on SQL and PostgreSQL, Django, Django REST framework, RestAPIs, Server Deploy with AWS
              </p>
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold opacity-95">
                  Master Git and GitHub - Beginner to Expert{" "}
                  <a
                    href="https://udemy-certificate.s3.amazonaws.com/image/UC-491ed3e9-c16c-491d-8e8c-d331cf6cac92.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary print:text-black underline font-normal text-xs"
                  >
                    link
                  </a>
                </h3>
                <span className="text-xs font-semibold opacity-85">Feb 2025</span>
              </div>
              <p className="opacity-85 text-xs leading-relaxed mt-0.5">
                Covering basic setup, branching, project fork & clone, workflow (staging, upstaging, commit), 2way merge, 3way merge, resolve merge conflict, collaborations.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold opacity-95">Next Level Web Development – Programming Hero (Running)</h3>
                <span className="text-xs font-semibold opacity-85">April ⎯ Sep 2026</span>
              </div>
              <p className="opacity-85 text-xs leading-relaxed mt-0.5">
                AI driven Software Engineering Oriented bootcamp covers Advance Typescript with OOP, Node.js, CRUD with Express.js, Advance PostgreSQL and Database modeling, Prisma ORM, Advance Querying, filtering, Advance Next.js, WT custom Authentication, Docker container and Data Management, AI chat integration with Node.js and automation with n8n.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Language */}
        <section className="mb-4">
          <p className="text-xs sm:text-sm font-sans">
            <strong>Language:</strong> English (Conversational), Bangla (Native)
          </p>
        </section>

        {/* Bottom Email watermark */}
        <footer className="text-center pt-2 border-t border-base-300/40 print:border-gray-300 text-[11px] opacity-70">
          monsurulislamcse.0208@gmail.com
        </footer>
      </main>

      <p className="text-center text-xs opacity-50 no-print mt-6">
        Print-ready A4 single-page format. Click 'Print / Save as PDF' or 'Download PDF' for direct file access.
      </p>
    </AuraBackground>
  );
}
