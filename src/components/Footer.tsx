import React from "react";
import Link from "next/link";
import { portfolioData } from "@/data/portfolio";
import { Github, Linkedin, Mail, MessageSquare } from "lucide-react";

export default function Footer() {
  const getSocialIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "github":
        return <Github className="w-5 h-5" />;
      case "linkedin":
        return <Linkedin className="w-5 h-5" />;
      case "whatsapp":
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.008 0C5.397 0 .06 5.348.06 12.008c0 2.116.546 4.188 1.587 5.946L0 24l6.19-1.62c1.726.944 3.69 1.458 5.724 1.458 6.612 0 11.953-5.34 11.953-11.953C23.867 5.348 18.61 0 12.008 0zm6.59 16.872c-.26-.13-1.538-.756-1.776-.842-.238-.087-.41-.13-.584.13-.174.26-.676.842-.828 1.011-.15.17-.304.19-.564.06-1.2-.6-2.072-1.04-2.885-2.44-.22-.38.22-.353.63-1.17.07-.13.03-.245-.02-.34-.05-.1-.41-1.01-.564-1.383-.15-.36-.316-.31-.43-.31-.11 0-.238-.01-.367-.01-.13 0-.34.05-.517.25-.18.2-1.01 1-1.01 2.44 0 1.44 1.05 2.84 1.196 3.03.145.2 2.06 3.16 5 4.38.7.3 1.242.48 1.67.61.7.22 1.343.19 1.85.115.56-.084 1.73-.706 1.97-1.353.243-.65.243-1.2.17-1.32-.07-.12-.26-.19-.52-.32z" />
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
          {portfolioData.socials.map((social) => {
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
          <p>© {new Date().getFullYear()} Monzurul Islam. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
