"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { portfolioData, PortfolioData } from "@/data/portfolio";

export interface SunlightRipple {
  x: number;
  y: number;
  active: boolean;
  toTheme: "light" | "night";
}

interface PortfolioContextType {
  data: PortfolioData;
  theme: string;
  isMounted: boolean;
  toggleTheme: (event?: React.MouseEvent) => void;
  sunlightRipple: SunlightRipple | null;
  isNavigating: boolean;
  navigateToResume: () => void;
  navigateToHome: (hash?: string) => void;
  isConnectModalOpen: boolean;
  setConnectModalOpen: (open: boolean) => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string>("night");
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [sunlightRipple, setSunlightRipple] = useState<SunlightRipple | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isConnectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("home");

  const router = useRouter();
  const pathname = usePathname();

  // Preload initial session data and theme
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme") || "night";
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      if (savedTheme === "light") {
        document.body.style.backgroundColor = "#faf8f2";
      } else {
        document.body.style.backgroundColor = "#100e0b";
      }
    } catch (e) {
      // Fallback if localStorage is inaccessible
      setTheme("night");
      document.documentElement.setAttribute("data-theme", "night");
      document.body.style.backgroundColor = "#100e0b";
    }
    setIsMounted(true);
  }, []);

  // Sync body background whenever theme changes
  useEffect(() => {
    if (!isMounted) return;
    if (theme === "light") {
      document.body.style.backgroundColor = "#faf8f2";
    } else {
      document.body.style.backgroundColor = "#100e0b";
    }
  }, [theme, isMounted]);

  // Sunlight bloom theme toggle animation
  const toggleTheme = useCallback((event?: React.MouseEvent) => {
    const nextTheme = theme === "night" ? "light" : "night";
    
    // Get click or button origin coordinates for sunlight expansion
    let x = window.innerWidth - 60;
    let y = 32;

    if (event) {
      const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
      if (rect) {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else {
        x = event.clientX;
        y = event.clientY;
      }
    }

    // Trigger sunlight ripple bloom
    setSunlightRipple({
      x,
      y,
      active: true,
      toTheme: nextTheme as "light" | "night",
    });

    // Check if View Transitions API is available
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        setTheme(nextTheme);
        localStorage.setItem("theme", nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
      });
    } else {
      setTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }

    // Reset ripple after animation finishes (750ms)
    setTimeout(() => {
      setSunlightRipple(null);
    }, 850);
  }, [theme]);

  // Smooth animated navigation to Resume
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

  // Smooth animated navigation to Home
  const navigateToHome = useCallback((hash: string = "") => {
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
        data: portfolioData,
        theme,
        isMounted,
        toggleTheme,
        sunlightRipple,
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
      
      {/* Sunlight Ray / Solar Flare Burst Overlay */}
      {sunlightRipple && (
        <div
          className="sunlight-burst-overlay pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
          style={{
            ["--sun-x" as any]: `${sunlightRipple.x}px`,
            ["--sun-y" as any]: `${sunlightRipple.y}px`,
          }}
          aria-hidden="true"
        >
          <div
            className={`sunlight-flare ${
              sunlightRipple.toTheme === "light" ? "sunlight-flare-day" : "sunlight-flare-night"
            }`}
          />
        </div>
      )}

      {/* Global Page Transition Curtain */}
      {isNavigating && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center bg-base-100/80 backdrop-blur-md animate-fade-in">
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
