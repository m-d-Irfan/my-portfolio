"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { portfolioData } from "@/data/portfolio";

const PortfolioContext = createContext(undefined);

export function PortfolioProvider({ children }) {
  // Session data loaded at the start
  const [data, setData] = useState(portfolioData);
  const [theme, setTheme] = useState("night");
  const [isMounted, setIsMounted] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [themeTransitionPoint, setThemeTransitionPoint] = useState(null);

  const router = useRouter();
  const pathname = usePathname();

  // Load session state & intro status on first mount
  useEffect(() => {
    try {
      // Check theme
      const savedTheme = localStorage.getItem("theme") || "night";
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.body.style.backgroundColor = savedTheme === "light" ? "#faf8f2" : "#100e0b";

      // Check if intro has already been shown in this session
      const hasSeenIntro = sessionStorage.getItem("has_seen_intro");
      if (hasSeenIntro) {
        setIntroFinished(true);
      }
    } catch (e) {
      setTheme("night");
      document.documentElement.setAttribute("data-theme", "night");
      document.body.style.backgroundColor = "#100e0b";
    }
    setIsMounted(true);
  }, []);

  // Update body background color smoothly when theme changes
  useEffect(() => {
    if (!isMounted) return;
    if (theme === "light") {
      document.body.style.backgroundColor = "#faf8f2";
    } else {
      document.body.style.backgroundColor = "#100e0b";
    }
  }, [theme, isMounted]);

  // Complete intro loader and remember for session
  const finishIntro = useCallback(() => {
    setIntroFinished(true);
    try {
      sessionStorage.setItem("has_seen_intro", "true");
    } catch (e) {}
  }, []);

  // Federico Pian inspired smooth circular theme transition
  const toggleTheme = useCallback((event) => {
    const nextTheme = theme === "night" ? "light" : "night";

    // Capture button coordinate origin
    let x = window.innerWidth - 60;
    let y = 32;

    if (event) {
      const rect = event.currentTarget?.getBoundingClientRect?.();
      if (rect) {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else if (event.clientX && event.clientY) {
        x = event.clientX;
        y = event.clientY;
      }
    }

    setThemeTransitionPoint({ x, y, toTheme: nextTheme });

    // If browser supports View Transitions API
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      const transition = document.startViewTransition(() => {
        setTheme(nextTheme);
        localStorage.setItem("theme", nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
      });

      // Inject dynamic circular clip-path transition
      if (transition?.ready) {
        transition.ready.then(() => {
          const maxRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
          );

          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${maxRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 700,
              easing: "cubic-bezier(0.65, 0, 0.35, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        });
      }
    } else {
      // Fallback smooth transition
      setTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }

    setTimeout(() => {
      setThemeTransitionPoint(null);
    }, 750);
  }, [theme]);

  // Smooth page navigation with transition curtain
  const navigateToResume = useCallback(() => {
    if (pathname === "/resume") return;
    setIsNavigating(true);
    setTimeout(() => {
      router.push("/resume");
      setTimeout(() => {
        setIsNavigating(false);
      }, 350);
    }, 280);
  }, [pathname, router]);

  const navigateToHome = useCallback((hash = "") => {
    if (pathname === "/" && !hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (pathname === "/" && hash) {
      const el = document.getElementById(hash.replace("#", ""));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    setIsNavigating(true);
    setTimeout(() => {
      router.push(`/${hash}`);
      setTimeout(() => {
        setIsNavigating(false);
      }, 350);
    }, 250);
  }, [pathname, router]);

  return (
    <PortfolioContext.Provider
      value={{
        data,
        setData,
        theme,
        isMounted,
        introFinished,
        finishIntro,
        toggleTheme,
        themeTransitionPoint,
        isNavigating,
        navigateToResume,
        navigateToHome,
        isConnectModalOpen,
        setConnectModalOpen,
        activeSection,
        setActiveSection,
      }}
    >
      {children}

      {/* Fallback theme ripple overlay for browsers without View Transitions */}
      {themeTransitionPoint && (
        <div
          className="theme-wave-overlay pointer-events-none fixed inset-0 z-[99999]"
          style={{
            "--origin-x": `${themeTransitionPoint.x}px`,
            "--origin-y": `${themeTransitionPoint.y}px`,
          }}
          aria-hidden="true"
        >
          <div
            className={`theme-wave-circle ${
              themeTransitionPoint.toTheme === "light"
                ? "theme-wave-to-light"
                : "theme-wave-to-dark"
            }`}
          />
        </div>
      )}

      {/* Global Page Transition Curtain */}
      {isNavigating && (
        <div className="fixed inset-0 z-[99998] pointer-events-none flex items-center justify-center bg-base-100/80 backdrop-blur-md animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
}

export default PortfolioContext;
