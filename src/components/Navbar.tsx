"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Menu, X, ArrowUpRight, Mail, Phone, Linkedin, Github, MessageSquare } from "lucide-react";

export default function Navbar() {
  const [theme, setTheme] = useState<string>("night");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const pathname = usePathname();

  // Load the initial theme on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "night";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "night" ? "light" : "night";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: newTheme }));
  };

  // Listen for global custom events to open the contact modal
  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener("open-connect-modal", handleOpenModal);
    return () => window.removeEventListener("open-connect-modal", handleOpenModal);
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

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-base-100/95 border-b border-base-300/40 no-print transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link
                href="/"
                onClick={(e) => {
                  if (window.location.pathname === "/") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="font-outfit text-2xl font-bold tracking-tight text-gradient flex items-center gap-1"
              >
                Monzurul Islam <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20 animate-pulse">Junior Dev</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="font-outfit text-sm font-medium hover:text-primary transition-colors py-2 px-1 relative group"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
                </Link>
              ))}

              <Link
                href="/resume"
                className="btn btn-sm btn-outline btn-secondary rounded-lg font-outfit"
              >
                Resume <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-sm btn-primary rounded-lg font-outfit shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30"
              >
                Let's talk
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
                aria-label="Toggle Theme"
              >
                {!mounted ? (
                  <span className="w-5 h-5 block"></span>
                ) : theme === "night" ? (
                  <Sun className="w-5 h-5 text-warning" />
                ) : (
                  <Moon className="w-5 h-5 text-secondary" />
                )}
              </button>
            </div>

            {/* Mobile menu button and Theme switch */}
            <div className="md:hidden flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
                aria-label="Toggle Theme"
              >
                {!mounted ? (
                  <span className="w-5 h-5 block"></span>
                ) : theme === "night" ? (
                  <Sun className="w-5 h-5 text-warning" />
                ) : (
                  <Moon className="w-5 h-5 text-secondary" />
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
          <div className="md:hidden bg-base-100/95 border-b border-base-300 shadow-lg py-4 px-2 space-y-1 transition-all">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block font-outfit text-base font-medium px-4 py-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
              >
                {link.name}
              </Link>
            ))}
            <div className="px-4 pt-2 flex flex-col gap-2">
              <Link
                href="/resume"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary btn-outline btn-block btn-sm rounded-lg font-outfit"
              >
                View Resume <ArrowUpRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="btn btn-primary btn-block btn-sm rounded-lg font-outfit animate-pulse"
              >
                Let's talk
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Contact modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-base-100 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="font-outfit text-2xl font-bold text-gradient">Let's Connect</h3>
              <p className="font-sans text-sm opacity-70 mt-2">
                Feel free to reach out through any of these channels. I will get back to you as soon as possible!
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
