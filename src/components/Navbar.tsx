import React, { useState, useEffect } from "react";
import { usePortfolio } from "../context/context";
import { Sun, Moon, Menu, X, ArrowUpRight, Mail, Phone, Linkedin, Github, Search } from "lucide-react";

export default function Navbar() {
  const {
    theme,
    toggleTheme,
    navigateToResume,
    navigateToHome,
    isMounted,
    isConnectModalOpen,
    setConnectModalOpen,
    toggleCommandPalette,
    activeSection,
    setActiveSection,
  } = usePortfolio();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

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
    { name: "Home", href: "home" },
    { name: "About", href: "about" },
    { name: "Skills", href: "skills" },
    { name: "Projects", href: "projects" },
    { name: "Problem Solving", href: "competitive" },
    { name: "Education", href: "education" },
    { name: "Contact", href: "contact" },
  ];

  const handleNavClick = (sectionId: string) => {
    setActiveSection(sectionId);
    navigateToHome(sectionId);
    setIsOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 w-full no-print transition-all duration-300 ${
          isScrolled
            ? "bg-base-100/80 backdrop-blur-xl border-b border-base-300/60 shadow-lg shadow-base-content/5 py-0"
            : "bg-transparent border-b border-transparent shadow-none backdrop-blur-none py-1"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Monogram */}
            <div className="flex-shrink-0">
              <button
                onClick={() => navigateToHome()}
                className="font-outfit text-xl sm:text-2xl font-bold tracking-tight text-gradient flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-xs font-bold text-black shadow-md shadow-primary/20">
                  MI
                </div>
                <span>Monzurul Islam</span>
              </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleNavClick(link.href)}
                  className={`font-outfit text-sm font-medium transition-colors py-2 px-1 relative group ${
                    activeSection === link.href ? "text-primary font-semibold" : "text-base-content/80 hover:text-primary"
                  }`}
                >
                  {link.name}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ${
                      activeSection === link.href ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </button>
              ))}

              {/* Command Palette Trigger */}
              <button
                onClick={toggleCommandPalette}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-base-200 border border-base-300 text-xs font-mono text-base-content/70 hover:text-primary hover:border-primary/40 transition-all"
                title="Open Command Menu (⌘K / Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-base-300 text-[10px] font-bold">⌘K</kbd>
              </button>

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

              {/* Theme Toggle Button */}
              <button
                onClick={(e) => toggleTheme(e)}
                className="btn btn-ghost btn-circle btn-sm text-base-content/85 hover:text-primary hover:bg-base-200/80 transition-all active:scale-90"
                aria-label="Toggle Theme"
                title={`Switch to ${theme === "night" ? "Light Mode" : "Dark Mode"}`}
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
            <div className="lg:hidden flex items-center gap-2">
              <button
                onClick={toggleCommandPalette}
                className="btn btn-ghost btn-circle btn-sm text-base-content/80 hover:text-primary"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={(e) => toggleTheme(e)}
                className="btn btn-ghost btn-circle btn-sm text-base-content/85 hover:text-primary active:scale-90 transition-all"
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
          <div className="lg:hidden bg-base-100/98 backdrop-blur-2xl border-b border-base-300 shadow-2xl py-4 px-3 space-y-1 animate-slide-up">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className="w-full text-left font-outfit text-base font-medium px-4 py-2.5 hover:bg-primary/10 hover:text-primary rounded-xl transition-colors"
              >
                {link.name}
              </button>
            ))}
            <div className="px-4 pt-3 flex flex-col gap-2">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-base-100 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setConnectModalOpen(false)}
              className="absolute top-4 right-4 btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <h3 className="font-outfit text-2xl font-bold text-gradient">Let's Connect</h3>
              <p className="font-sans text-sm opacity-70 mt-2">
                Feel free to reach out through any of these channels. I will get back to you promptly!
              </p>
            </div>

            <div className="space-y-3 font-outfit">
              <a
                href="https://wa.me/8801611836864"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-success/10 border border-success/20 hover:bg-success/20 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center text-success">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-base-content">WhatsApp Chat</h4>
                  <p className="text-xs opacity-75 text-base-content/80">+8801611836864</p>
                </div>
              </a>

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
