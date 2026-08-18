import React from "react";
import { usePortfolio } from "../context/context";
import { Github, Linkedin, Mail, ArrowUp } from "lucide-react";

export default function Footer() {
  const { data, navigateToHome, navigateToResume } = usePortfolio();

  return (
    <footer className="bg-base-200 border-t border-base-300 py-12 text-base-content no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-xs font-bold text-black shadow-md shadow-primary/20">
              MI
            </div>
            <span className="font-outfit text-xl font-bold text-gradient">
              {data.name}
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-wrap justify-center gap-6 font-outfit text-sm text-base-content/80">
            <button onClick={() => navigateToHome("home")} className="hover:text-primary transition-colors">Home</button>
            <button onClick={() => navigateToHome("about")} className="hover:text-primary transition-colors">About</button>
            <button onClick={() => navigateToHome("skills")} className="hover:text-primary transition-colors">Skills</button>
            <button onClick={() => navigateToHome("projects")} className="hover:text-primary transition-colors">Projects</button>
            <button onClick={() => navigateToHome("competitive")} className="hover:text-primary transition-colors">Problem Solving</button>
            <button onClick={() => navigateToHome("education")} className="hover:text-primary transition-colors">Education</button>
            <button onClick={() => navigateToHome("contact")} className="hover:text-primary transition-colors">Contact</button>
            <button onClick={navigateToResume} className="hover:text-primary transition-colors text-primary font-semibold">ATS Resume ↗</button>
          </nav>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/m-d-Irfan"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>

            <a
              href="https://linkedin.com/in/monzurul-islam-irfan/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>

            <a
              href="mailto:monsurulislamcse.0208@gmail.com"
              className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
              aria-label="Email"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>

          <div className="text-xs font-mono text-base-content/60">
            © {new Date().getFullYear()} Monzurul Islam (Irfan). Handcrafted with React & Vite.
          </div>
        </div>
      </div>
    </footer>
  );
}
