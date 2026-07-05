"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Menu, X, ArrowUpRight } from "lucide-react";

export default function Navbar() {
  const [theme, setTheme] = useState<string>("night");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  // Load the initial theme on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "night";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "night" ? "light" : "night";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

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
    <nav className="sticky top-0 z-50 w-full bg-base-100/80 backdrop-blur-md border-b border-base-300/40 no-print transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="font-outfit text-2xl font-bold tracking-tight text-gradient flex items-center gap-1">
              Monzurul Islam <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">Junior Dev</span>
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
              className="btn btn-sm btn-outline btn-primary rounded-lg font-outfit"
            >
              Resume <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
              aria-label="Toggle Theme"
            >
              {theme === "night" ? (
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
              {theme === "night" ? (
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
          <div className="px-4 pt-2">
            <Link
              href="/resume"
              onClick={() => setIsOpen(false)}
              className="btn btn-primary btn-outline btn-block btn-sm rounded-lg font-outfit"
            >
              View Resume <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
