import React from "react";
import Link from "next/link";
import { portfolioData } from "@/data/portfolio";
import { Github, Linkedin, Mail, Code } from "lucide-react";

export default function Footer() {
  const getSocialIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "github":
        return <Github className="w-5 h-5" />;
      case "linkedin":
        return <Linkedin className="w-5 h-5" />;
      case "codeforces":
        return <Code className="w-5 h-5" />;
      case "email":
        return <Mail className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <footer className="footer footer-center p-10 bg-base-200/50 text-base-content rounded-t-3xl border-t border-base-300/50 no-print">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
        {/* Brand Logo and Subtitle */}
        <div>
          <h2 className="font-outfit text-2xl font-bold tracking-tight text-gradient">
            Monzurul Islam
          </h2>
          <p className="font-outfit text-sm opacity-75 mt-1">
            Junior Software Engineer | Backend & DRF Specialist
          </p>
        </div>

        {/* Navigation Quick Links */}
        <div className="flex flex-wrap justify-center gap-6 font-outfit text-sm font-medium">
          <Link href="/#home" className="hover:text-primary transition-colors">Home</Link>
          <Link href="/#about" className="hover:text-primary transition-colors">About</Link>
          <Link href="/#skills" className="hover:text-primary transition-colors">Skills</Link>
          <Link href="/#projects" className="hover:text-primary transition-colors">Projects</Link>
          <Link href="/#education" className="hover:text-primary transition-colors">Education</Link>
          <Link href="/#training" className="hover:text-primary transition-colors">Training</Link>
          <Link href="/#contact" className="hover:text-primary transition-colors">Contact</Link>
        </div>

        {/* Social Buttons */}
        <div className="flex gap-4">
          {portfolioData.socials.map((social) => (
            <a
              key={social.id}
              href={social.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-circle btn-sm hover:bg-primary/20 hover:text-primary transition-all duration-300"
              aria-label={social.title}
            >
              {getSocialIcon(social.title)}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div className="text-xs opacity-60 font-sans mt-4">
          <p>© {new Date().getFullYear()} Monzurul Islam. All rights reserved.</p>
          <p className="mt-1">Built with Next.js 15, TypeScript, Tailwind CSS, & DaisyUI.</p>
        </div>
      </div>
    </footer>
  );
}
