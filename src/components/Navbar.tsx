"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio } from "@/context/PortfolioContext";
import { Sun, Moon, Menu, X, ArrowUpRight, Mail, Phone, Linkedin, Github, MessageSquare } from "lucide-react";

export default function Navbar() {
  const {
    theme,
    toggleTheme,
    navigateToResume,
    navigateToHome,
    isMounted,
    isConnectModalOpen,
    setConnectModalOpen,
  } = usePortfolio();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", href: "/#home" },
    { name: "About", href: "/#about" },
    { name: "Skills", href: "/#skills" },
    { name: "Projects", href: "/#projects" },
    { name: "Education", href: "/#education" },
    { name: "Training", href: "/#training" },
    { name: "Contact", href: "/#contact" },
  ];

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (href.startsWith("/#")) {
      const hash = href.replace("/", "");
      if (pathname === "/") {
        e.preventDefault();
        const targetId = hash.replace("#", "");
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-base-100/80 backdrop-blur-md border-b border-base-300/40 no-print transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <button
                onClick={() => navigateToHome()}
                className="font-outfit text-2xl font-bold tracking-tight text-gradient flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                Monzurul Islam
                <span className="text-xs font-semibold px-2 py-0.5 bg-primary/15 text-primary rounded-full border border-primary/25 animate-pulse">
                  Junior Dev
                </span>
              </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="font-outfit text-sm font-medium hover:text-primary transition-colors py-2 px-1 relative group"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}

              <button
                onClick={navigateToResume}
                className="btn btn-sm btn-outline btn-secondary rounded-xl font-outfit gap-1 shadow-sm hover:scale-[1.03] transition-all"
              >
                Resume <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setConnectModalOpen(true)}
                className="btn btn-sm btn-primary rounded-xl font-outfit shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 transition-all hover:scale-[1.03]"
              >
                Let's talk
              </button>

              {/* Theme Toggle Button with Sunlight Burst effect */}
              <button
                onClick={(e) => toggleTheme(e)}
                className="btn btn-ghost btn-circle btn-sm text-base-content/85 hover:text-primary hover:bg-base-200/80 transition-all active:scale-90"
                aria-label="Toggle Theme"
                title={`Switch to ${theme === "night" ? "Light (Aqua Bubble)" : "Dark (Liquid Cyan)"}`}
              >
                {!isMounted ? (
                  <span className="w-5 h-5 block" />
                ) : theme === "night" ? (
                  <Sun className="w-5 h-5 text-warning animate-spin-slow hover:text-amber-300" />
                ) : (
                  <Moon className="w-5 h-5 text-primary" />
                )}
              </button>
            </div>

            {/* Mobile menu button and Theme switch */}
            <div className="md:hidden flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={(e) => toggleTheme(e)}
                className="btn btn-ghost btn-circle btn-sm text-base-content/85 hover:text-primary"
                aria-label="Toggle Theme"
              >
                {!isMounted ? (
                  <span className="w-5 h-5 block" />
                ) : theme === "night" ? (
                  <Sun className="w-5 h-5 text-warning" />
                ) : (
                  <Moon className="w-5 h-5 text-primary" />
                )}
              </button>

              {/* Mobile Hamburger menu */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
                aria-label="Toggle Menu"
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {isOpen && (
          <div className="md:hidden bg-base-100/95 border-b border-base-300 shadow-xl py-4 px-2 space-y-1 transition-all animate-fadeIn">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  setIsOpen(false);
                  handleNavClick(e, link.href);
                }}
                className="block font-outfit text-base font-medium px-4 py-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-colors"
              >
                {link.name}
              </Link>
            ))}
            <div className="px-4 pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigateToResume();
                }}
                className="btn btn-secondary btn-outline btn-block btn-sm rounded-xl font-outfit justify-center gap-1.5"
              >
                View Resume <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setConnectModalOpen(true);
                }}
                className="btn btn-primary btn-block btn-sm rounded-xl font-outfit shadow-sm"
              >
                Let's talk
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Connect Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-base-100 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setConnectModalOpen(false)}
              className="absolute top-4 right-4 btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="font-outfit text-2xl font-bold text-gradient">Let's Connect</h3>
              <p className="font-sans text-sm opacity-70 mt-2">
                Feel free to reach out through any of these channels. I will get back to you promptly!
              </p>
            </div>

            {/* Links Stack */}
            <div className="space-y-3 font-outfit">
              {/* WhatsApp */}
              <a
                href="https://wa.me/8801611836864"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-success/10 border border-success/20 hover:bg-success/20 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center text-success">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.008 0C5.397 0 .06 5.348.06 12.008c0 2.116.546 4.188 1.587 5.946L0 24l6.19-1.62c1.726.944 3.69 1.458 5.724 1.458 6.612 0 11.953-5.34 11.953-11.953C23.867 5.348 18.61 0 12.008 0zm6.59 16.872c-.26-.13-1.538-.756-1.776-.842-.238-.087-.41-.13-.584.13-.174.26-.676.842-.828 1.011-.15.17-.304.19-.564.06-1.2-.6-2.072-1.04-2.885-2.44-.22-.38.22-.353.63-1.17.07-.13.03-.245-.02-.34-.05-.1-.41-1.01-.564-1.383-.15-.36-.316-.31-.43-.31-.11 0-.238-.01-.367-.01-.13 0-.34.05-.517.25-.18.2-1.01 1-1.01 2.44 0 1.44 1.05 2.84 1.196 3.03.145.2 2.06 3.16 5 4.38.7.3 1.242.48 1.67.61.7.22 1.343.19 1.85.115.56-.084 1.73-.706 1.97-1.353.243-.65.243-1.2.17-1.32-.07-.12-.26-.19-.52-.32z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-base-content">WhatsApp Chat</h4>
                  <p className="text-xs opacity-75 text-base-content/80">+8801611836864</p>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:monsurulislamcse.0208@gmail.com"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-base-content">Email Address</h4>
                  <p className="text-xs opacity-75 text-base-content/80">monsurulislamcse.0208@gmail.com</p>
                </div>
              </a>

              {/* Phone */}
              <a
                href="tel:+8801611836864"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-base-content">Call Phone</h4>
                  <p className="text-xs opacity-75 text-base-content/80">+8801611836864</p>
                </div>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com/in/monzurul-islam-irfan/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-info/10 border border-info/20 hover:bg-info/20 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center text-info">
                  <Linkedin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-base-content">LinkedIn Profile</h4>
                  <p className="text-xs opacity-75 text-base-content/80">monzurul-islam-irfan</p>
                </div>
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/m-d-Irfan"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-base-200 border border-base-300 hover:bg-base-300 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-base-300 flex items-center justify-center text-base-content">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-base-content">GitHub Profile</h4>
                  <p className="text-xs opacity-75 text-base-content/80">m-d-Irfan</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
