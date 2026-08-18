import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { portfolioData, PortfolioData } from "../data/portfolio";
import { CheckCircle2, Info } from "lucide-react";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "info";
}

export interface PortfolioContextType {
  data: PortfolioData;
  setData: React.Dispatch<React.SetStateAction<PortfolioData>>;
  theme: string;
  isMounted: boolean;
  introFinished: boolean;
  finishIntro: () => void;
  toggleTheme: (event?: React.MouseEvent | any) => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
  isConnectModalOpen: boolean;
  setConnectModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  isResumeOpen: boolean;
  setResumeOpen: (open: boolean) => void;
  navigateToResume: () => void;
  navigateToHome: (hash?: string) => void;
  showToast: (message: string, type?: "success" | "info") => void;
  copyToClipboard: (text: string, label?: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortfolioData>(portfolioData);
  const [theme, setTheme] = useState<string>("night");
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [introFinished, setIntroFinished] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("home");
  const [isConnectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [isResumeOpen, setResumeOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initialize theme and intro status on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("portfolio_theme") || "night";
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);

      const hasSeenIntro = sessionStorage.getItem("has_seen_intro");
      if (hasSeenIntro) {
        setIntroFinished(true);
      }
    } catch (e) {
      setTheme("night");
      document.documentElement.setAttribute("data-theme", "night");
    }
    setIsMounted(true);
  }, []);

  // Update theme on HTML tag smoothly
  useEffect(() => {
    if (!isMounted) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, isMounted]);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setConnectModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mark intro loader as complete
  const finishIntro = useCallback(() => {
    setIntroFinished(true);
    try {
      sessionStorage.setItem("has_seen_intro", "true");
    } catch (e) {}
  }, []);

  // Smooth View Transitions circular theme toggle
  const toggleTheme = useCallback((event?: any) => {
    const nextTheme = theme === "night" ? "light" : "night";

    let x = window.innerWidth - 60;
    let y = 32;

    if (event) {
      const btn = (event.currentTarget as HTMLElement) || (event.target as HTMLElement)?.closest("button");
      if (btn && typeof btn.getBoundingClientRect === "function") {
        const rect = btn.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else if (event.clientX && event.clientY) {
        x = event.clientX;
        y = event.clientY;
      }
    }

    if (typeof document !== "undefined") {
      const doc = document as any;
      if (typeof doc.startViewTransition === "function") {
        const transition = doc.startViewTransition(() => {
          setTheme(nextTheme);
          localStorage.setItem("portfolio_theme", nextTheme);
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
                duration: 650,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                pseudoElement: "::view-transition-new(root)",
              }
            );
          });
        }
      } else {
        setTheme(nextTheme);
        localStorage.setItem("portfolio_theme", nextTheme);
        doc.documentElement.setAttribute("data-theme", nextTheme);
      }
    } else {
      setTheme(nextTheme);
    }
  }, [theme]);

  // Toast feedback helper
  const showToast = useCallback((message: string, type: "success" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  // 1-Click Clipboard copier
  const copyToClipboard = useCallback((text: string, label: string = "Copied to clipboard") => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`${label}!`, "success");
      }).catch(() => {
        showToast("Failed to copy", "info");
      });
    } else {
      showToast(`${label}!`, "success");
    }
  }, [showToast]);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev);
  }, []);

  const navigateToResume = useCallback(() => {
    setResumeOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navigateToHome = useCallback((hash: string = "") => {
    setResumeOpen(false);
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setTimeout(() => {
      const el = document.getElementById(hash.replace("#", ""));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  }, []);

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
        activeSection,
        setActiveSection,
        isConnectModalOpen,
        setConnectModalOpen,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        toggleCommandPalette,
        isResumeOpen,
        setResumeOpen,
        navigateToResume,
        navigateToHome,
        showToast,
        copyToClipboard,
      }}
    >
      {children}

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-2 pointer-events-none no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-base-200/95 border border-primary/40 shadow-xl shadow-black/20 text-sm font-outfit text-base-content backdrop-blur-md animate-slide-up pointer-events-auto"
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-info shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
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
