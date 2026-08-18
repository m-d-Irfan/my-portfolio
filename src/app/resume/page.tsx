"use client";
import React from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/context";
import AuraBackground from "@/components/AuraBackground";
import { ArrowLeft, Printer, Download, Github, Linkedin, Mail, Phone, MapPin } from "lucide-react";

export default function ResumePage() {
  const { data, navigateToHome } = usePortfolio();

  const handlePrint = () => {
    window.print();
  };

  return (
    <AuraBackground className="py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Action Header Bar (Excluded in Print) */}
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 mb-6 no-print border-b border-base-300/60 pb-4">
        {/* Back to Portfolio (Always visible on all screens) */}
        <button
          onClick={() => navigateToHome()}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors font-outfit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Portfolio
        </button>

        {/* Action Buttons: Download visible to everyone; Print visible on desktop only */}
        <div className="inline-flex items-center gap-3">
          {/* Download PDF Button (Visible to everyone on mobile & desktop) */}
          <a
            href="/Monzurul_Islam.pdf"
            download="Monzurul_Islam_Resume.pdf"
            className="btn btn-outline btn-secondary btn-sm rounded-2xl font-outfit gap-1.5 shadow-sm hover:scale-[1.02] transition-all px-3.5"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>

          {/* Print Button (Desktop / Window View Only, Hidden on Mobile) */}
          <button
            onClick={handlePrint}
            className="hidden sm:inline-flex btn btn-primary btn-sm rounded-2xl font-outfit gap-2 shadow-md shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] transition-all px-4"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* High-Fidelity Printable Resume Sheet */}
      <main className="max-w-4xl mx-auto bg-base-200/90 [data-theme='light']:bg-white border border-base-300/60 p-6 sm:p-10 rounded-3xl shadow-2xl print-card print:p-0 print:border-none print:bg-white print:text-black animate-fade-in">
        
        {/* Top Header Information */}
        <header className="border-b-2 border-base-300 print:border-black pb-5 mb-5">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            {/* Left Side: Name and Professional Designation */}
            <div>
              <h1 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight text-gradient print:text-black print:bg-none">
                {data.name}
              </h1>
              <p className="font-outfit text-lg sm:text-xl font-semibold text-secondary print:text-gray-800 mt-1">
                {data.designation}
              </p>
            </div>

            {/* Right Side: Stacked Contact and Social Channels */}
            <div className="text-xs sm:text-sm font-sans space-y-1.5 text-left md:text-right print:text-black">
              {/* Email */}
              <div className="flex items-center md:justify-end gap-2">
                <Mail className="w-4 h-4 text-primary shrink-0 print:text-black" />
                <a href={`mailto:${data.email}`} className="hover:underline opacity-90">
                  {data.email}
                </a>
              </div>

              {/* Phone */}
              <div className="flex items-center md:justify-end gap-2">
                <Phone className="w-4 h-4 text-secondary shrink-0 print:text-black" />
                <a href={`tel:${data.phone}`} className="hover:underline opacity-90">
                  {data.phone}
                </a>
              </div>

              {/* Location */}
              <div className="flex items-center md:justify-end gap-2">
                <MapPin className="w-4 h-4 text-accent shrink-0 print:text-black" />
                <span className="opacity-90">{data.location}</span>
              </div>

              {/* Social Channels Row: GitHub, LinkedIn, Codeforces, Codechef */}
              <div className="flex flex-wrap items-center md:justify-end gap-3.5 pt-1 text-xs opacity-90">
                {/* GitHub */}
                <a
                  href="https://github.com/m-d-Irfan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline hover:text-primary transition-colors"
                >
                  <Github className="w-3.5 h-3.5 shrink-0" />
                  <span>GitHub</span>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com/in/monzurul-islam-irfan/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline hover:text-primary transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5 shrink-0" />
                  <span>LinkedIn</span>
                </a>

                {/* Codeforces */}
                <a
                  href="https://codeforces.com/profile/monzurul.islam2022"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline hover:text-primary transition-colors"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="4" height="11" fill="#AEAEAE" rx="0.5"/>
                    <rect x="10" y="3" width="4" height="19" fill="#3182CE" rx="0.5"/>
                    <rect x="17" y="7" width="4" height="15" fill="#E53E3E" rx="0.5"/>
                  </svg>
                  <span>Codeforces</span>
                </a>

                {/* Codechef */}
                <a
                  href="https://www.codechef.com/users/montikuna_2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline hover:text-primary transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C10.3 2 9 3.3 9 5c0 .3 0 .7.1 1C7.3 6.6 6 8.1 6 10c0 2.2 1.8 4 4 4v1H8.5c-.8 0-1.5.7-1.5 1.5V22h10v-5.5c0-.8-.7-1.5-1.5-1.5H14v-1c2.2 0 4-1.8 4-4 0-1.9-1.3-3.4-3.1-4 .1-.3.1-.7.1-1 0-1.7-1.3-3-3-3zm-2 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                  </svg>
                  <span>Codechef</span>
                </a>
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
        Print-ready A4 single-page format. Click 'Print' or 'Download PDF' for direct export.
      </p>
    </AuraBackground>
  );
}
