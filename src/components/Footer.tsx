"use client";
import React from "react";
import Link from "next/link";
import { usePortfolio } from "@/context/context";
import { Github, Linkedin, Mail } from "lucide-react";

export default function Footer() {
  const { data } = usePortfolio();

  const getSocialIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "github":
        return <Github className="w-5 h-5" />;
      case "linkedin":
        return <Linkedin className="w-5 h-5" />;
      case "whatsapp":
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        );
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
            {data.name}
          </h2>
          <p className="font-outfit text-sm opacity-75 mt-1">
            Junior Software Engineer | Full Stack Developer
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
          {data.socials.map((social) => {
            let title = social.title;
            let link = social.link;

            // In footer, replace Codeforces with WhatsApp
            if (title.toLowerCase() === "codeforces") {
              title = "WhatsApp";
              link = "https://wa.me/8801611836864";
            }

            const icon = getSocialIcon(title);
            if (!icon) return null;

            return (
              <a
                key={social.id}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-circle btn-sm hover:bg-primary/20 hover:text-primary transition-all duration-300"
                aria-label={title}
              >
                {icon}
              </a>
            );
          })}
        </div>

        {/* Copyright */}
        <div className="text-xs opacity-60 font-sans mt-4">
          <p>© {new Date().getFullYear()} {data.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
