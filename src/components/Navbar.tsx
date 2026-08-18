"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio } from "@/context/context";
import { Sun, Moon, Menu, X, ArrowUpRight, Mail, Phone, Linkedin, Github } from "lucide-react";

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
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const pathname = usePathname();

  // Scroll listener to activate frosted glass styling on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      const targetId = href.replace("/#", "");
      if (pathname === "/") {
        e.preventDefault();
        const el = document.getElementById(targetId);
        if (el) {
          const navHeight = 68;
          const elementPosition = el.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - navHeight;
          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });
        }
      } else {
        e.preventDefault();
        navigateToHome(targetId);
      }
    }
  };

  return (
    <>
      {/* Dynamic Floating Navbar - Seamless at top, frosted glass on scroll */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 w-full no-print transition-all duration-500 ${
          isScrolled
            ? "bg-base-100/80 backdrop-blur-xl border-b border-base-300/60 shadow-lg shadow-base-content/5 py-0"
            : "bg-transparent border-b border-transparent shadow-none backdrop-blur-none py-1"
        }`}
      >
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

              {/* Theme Toggle Button with Smooth Transition */}
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
                className="btn btn-ghost btn-circle btn-sm text-base-content/85 hover:text-primary active:scale-90 transition-all"
                aria-label="Toggle Theme"
                title={`Switch to ${theme === "night" ? "Light (Aqua Bubble)" : "Dark (Liquid Cyan)"}`}
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
          <div className="md:hidden bg-base-100/98 backdrop-blur-2xl border-b border-base-300 shadow-2xl py-4 px-2 space-y-1 transition-all animate-fadeIn">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  setIsOpen(false);
                  handleNavClick(e, link.href);
                }}
                className="block font-outfit text-base font-medium px-4 py-2.5 hover:bg-primary/10 hover:text-primary rounded-xl transition-colors"
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
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
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
