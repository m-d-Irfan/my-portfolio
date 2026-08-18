import React, { useState, useEffect } from "react";
import { usePortfolio } from "../context/context";
import { Search, Home, User, Code2, Folder, Terminal, Award, Mail, Download, FileText, Copy, Phone, Sun, Moon, ArrowRight } from "lucide-react";

export default function CommandPalette() {
  const {
    data,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    navigateToResume,
    navigateToHome,
    copyToClipboard,
    toggleTheme,
    theme,
  } = usePortfolio();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const staticActions = [
    { group: "Navigation", title: "Home / Hero", icon: <Home className="w-4 h-4" />, action: () => navigateToHome("home") },
    { group: "Navigation", title: "About & Background", icon: <User className="w-4 h-4" />, action: () => navigateToHome("about") },
    { group: "Navigation", title: "Technical Skills Matrix", icon: <Code2 className="w-4 h-4" />, action: () => navigateToHome("skills") },
    { group: "Navigation", title: "Featured Projects", icon: <Folder className="w-4 h-4" />, action: () => navigateToHome("projects") },
    { group: "Navigation", title: "Competitive Programming", icon: <Terminal className="w-4 h-4" />, action: () => navigateToHome("competitive") },
    { group: "Navigation", title: "Education & Bootcamps", icon: <Award className="w-4 h-4" />, action: () => navigateToHome("education") },
    { group: "Navigation", title: "Contact & Quick Connect", icon: <Mail className="w-4 h-4" />, action: () => navigateToHome("contact") },

    { group: "Quick Actions", title: "View ATS Resume", badge: "ATS", icon: <FileText className="w-4 h-4" />, action: () => navigateToResume() },
    { group: "Quick Actions", title: "Download Resume PDF", badge: "PDF", icon: <Download className="w-4 h-4" />, action: () => window.open("/assets/Monzurul_Islam.pdf", "_blank") },
    { group: "Quick Actions", title: "Copy Email Address", badge: data.email, icon: <Copy className="w-4 h-4" />, action: () => copyToClipboard(data.email, "Email copied") },
    { group: "Quick Actions", title: "Copy WhatsApp Number", badge: data.phone, icon: <Phone className="w-4 h-4" />, action: () => copyToClipboard(data.phone, "Phone copied") },
    { group: "Quick Actions", title: `Switch Theme to ${theme === "night" ? "Light" : "Dark"}`, badge: "Theme", icon: theme === "night" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />, action: () => toggleTheme() },
  ];

  const projectActions = data.projects.map((p) => ({
    group: "Projects",
    title: `${p.title} (${p.category})`,
    badge: p.techStack.slice(0, 3).join(", "),
    icon: <Folder className="w-4 h-4 text-primary" />,
    action: () => {
      navigateToHome("projects");
    },
  }));

  const allActions = [...staticActions, ...projectActions];

  const filteredActions = query.trim() === ""
    ? allActions
    : allActions.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.group.toLowerCase().includes(query.toLowerCase()) ||
          (a.badge && a.badge.toLowerCase().includes(query.toLowerCase()))
      );

  const executeAction = (action: () => void) => {
    setCommandPaletteOpen(false);
    action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        executeAction(filteredActions[selectedIndex].action);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-start justify-center p-4 pt-[12vh] bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-base-100 border border-base-300 rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-base-300">
          <Search className="w-5 h-5 text-base-content/50" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, project, or section..."
            autoFocus
            className="flex-1 bg-transparent text-sm sm:text-base font-sans text-base-content outline-none placeholder:text-base-content/40"
          />
          <kbd className="px-2 py-0.5 rounded bg-base-200 text-xs font-mono text-base-content/60 border border-base-300">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm text-base-content/60">
              No matching actions found.
            </div>
          ) : (
            filteredActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => executeAction(action.action)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left text-xs sm:text-sm font-sans transition-colors ${
                  idx === selectedIndex
                    ? "bg-primary text-black font-semibold"
                    : "text-base-content hover:bg-base-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={idx === selectedIndex ? "text-black" : "text-primary"}>
                    {action.icon}
                  </div>
                  <span>{action.title}</span>
                </div>

                {action.badge && (
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                      idx === selectedIndex
                        ? "bg-black/20 text-black"
                        : "bg-base-200 text-base-content/60 border border-base-300"
                    }`}
                  >
                    {action.badge}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-base-300 bg-base-200/50 flex justify-between items-center text-[11px] font-mono text-base-content/60">
          <span>Navigate: ↑ ↓</span>
          <span>Select: ↵ Enter</span>
        </div>
      </div>
    </div>
  );
}
