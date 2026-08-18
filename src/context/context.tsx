"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { portfolioData, PortfolioData } from "@/data/portfolio";

export interface ThemeTransitionPoint {
  x: number;
  y: number;
  toTheme: "light" | "night";
}

export interface PortfolioContextType {
  data: PortfolioData;
  setData: React.Dispatch<React.SetStateAction<PortfolioData>>;
  theme: string;
  isMounted: boolean;
  introFinished: boolean;
  finishIntro: () => void;
  toggleTheme: (event?: React.MouseEvent) => void;
  themeTransitionPoint: ThemeTransitionPoint | null;
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
  // Session data loaded at the start
  const [data, setData] = useState<PortfolioData>(portfolioData);
  const [theme, setTheme] = useState<string>("night");
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [introFinished, setIntroFinished] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isConnectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("home");
  const [themeTransitionPoint, setThemeTransitionPoint] = useState<ThemeTransitionPoint | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Load session state & intro status on first mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme") || "night";
      setTheme(savedTheme);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", savedTheme);
        document.body.style.backgroundColor = savedTheme === "light" ? "#faf8f2" : "#100e0b";
      }

      const hasSeenIntro = sessionStorage.getItem("has_seen_intro");
      if (hasSeenIntro) {
        setIntroFinished(true);
      }
    } catch (e) {
      setTheme("night");
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", "night");
        document.body.style.backgroundColor = "#100e0b";
      }
    }
    setIsMounted(true);
  }, []);

  // Update body background color smoothly when theme changes
  useEffect(() => {
    if (!isMounted || typeof document === "undefined") return;
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
  const toggleTheme = useCallback((event?: React.MouseEvent) => {
    const nextTheme = theme === "night" ? "light" : "night";

    // Default origin coordinates
    let x = typeof window !== "undefined" ? window.innerWidth - 60 : 100;
    let y = 32;

    if (event) {
      const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect?.();
      if (rect) {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else if (event.clientX && event.clientY) {
        x = event.clientX;
        y = event.clientY;
      }
    }

    setThemeTransitionPoint({ x, y, toTheme: nextTheme as "light" | "night" });

    if (typeof document !== "undefined") {
      const doc = document;
      const startTransition = (doc as any).startViewTransition;

      if (typeof startTransition === "function") {
        const transition = startTransition.call(doc, () => {
          setTheme(nextTheme);
          localStorage.setItem("theme", nextTheme);
          doc.documentElement.setAttribute("data-theme", nextTheme);
        });

        if (transition && typeof transition.ready?.then === "function") {
          transition.ready.then(() => {
            const maxRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            );

            doc.documentElement.animate(
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
        // Fallback smooth transition without View Transitions API
        setTheme(nextTheme);
        localStorage.setItem("theme", nextTheme);
        doc.documentElement.setAttribute("data-theme", nextTheme);
      }
    } else {
      setTheme(nextTheme);
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

  const navigateToHome = useCallback((hash: string = "") => {
    if (pathname === "/" && !hash) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    if (pathname === "/" && hash) {
      if (typeof document !== "undefined") {
        const el = document.getElementById(hash.replace("#", ""));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
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
            ["--origin-x" as any]: `${themeTransitionPoint.x}px`,
            ["--origin-y" as any]: `${themeTransitionPoint.y}px`,
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
