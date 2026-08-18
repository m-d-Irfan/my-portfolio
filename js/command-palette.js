/**
 * Interactive Command Palette (⌘K / Ctrl+K)
 */

import { portfolioData } from './data.js';
import { toggleTheme } from './theme.js';
import { copyText } from './toast.js';

let commandBackdrop = null;
let commandInput = null;
let commandResults = null;
let selectedIndex = 0;
let currentItems = [];

const staticCommands = [
  // Navigation
  { group: 'Navigation', title: 'Home / Hero', icon: 'home', action: () => scrollToSection('home') },
  { group: 'Navigation', title: 'About & Journey', icon: 'user', action: () => scrollToSection('about') },
  { group: 'Navigation', title: 'Technical Skills Matrix', icon: 'code', action: () => scrollToSection('skills') },
  { group: 'Navigation', title: 'Featured Projects', icon: 'folder', action: () => scrollToSection('projects') },
  { group: 'Navigation', title: 'Competitive Programming', icon: 'terminal', action: () => scrollToSection('competitive') },
  { group: 'Navigation', title: 'Education & Training', icon: 'award', action: () => scrollToSection('education') },
  { group: 'Navigation', title: 'Contact & Quick Connect', icon: 'mail', action: () => scrollToSection('contact') },

  // Quick Actions
  { group: 'Quick Actions', title: 'Download Resume (PDF)', icon: 'download', badge: 'PDF', action: () => window.open(portfolioData.resumePdfUrl, '_blank') },
  { group: 'Quick Actions', title: 'View ATS Resume (Print View)', icon: 'file', badge: 'ATS', action: () => window.location.href = 'resume.html' },
  { group: 'Quick Actions', title: 'Copy Email Address', icon: 'copy', badge: 'monsurulislamcse.0208@gmail.com', action: () => copyText(portfolioData.email, 'Email copied') },
  { group: 'Quick Actions', title: 'Copy Phone Number', icon: 'phone', badge: '+8801611836864', action: () => copyText(portfolioData.phone, 'Phone copied') },
  { group: 'Quick Actions', title: 'Open WhatsApp Chat', icon: 'message', badge: 'Direct', action: () => window.open(portfolioData.whatsappUrl, '_blank') },
  { group: 'Quick Actions', title: 'Toggle Dark / Light Theme', icon: 'sun', badge: 'Theme', action: (e) => toggleTheme(e) },
  
  // External Profiles
  { group: 'Social & Code', title: 'GitHub Profile (m-d-Irfan)', icon: 'github', action: () => window.open(portfolioData.githubUrl, '_blank') },
  { group: 'Social & Code', title: 'LinkedIn Profile (monzurul-islam-irfan)', icon: 'linkedin', action: () => window.open(portfolioData.linkedinUrl, '_blank') },
  { group: 'Social & Code', title: 'Codeforces Profile', icon: 'code', action: () => window.open(portfolioData.codeforcesUrl, '_blank') },
  { group: 'Social & Code', title: 'Codechef Profile', icon: 'code', action: () => window.open(portfolioData.codechefUrl, '_blank') },
];

export function initCommandPalette() {
  createPaletteDom();

  // Keyboard shortcut listener (Cmd+K, Ctrl+K, Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePalette();
    } else if (e.key === 'Escape' && isPaletteOpen()) {
      closePalette();
    }
  });

  const cmdTriggerBtns = document.querySelectorAll('.cmd-trigger-btn');
  cmdTriggerBtns.forEach((btn) => {
    btn.addEventListener('click', () => openPalette());
  });
}

function createPaletteDom() {
  commandBackdrop = document.createElement('div');
  commandBackdrop.className = 'cmd-backdrop no-print';
  commandBackdrop.innerHTML = `
    <div class="cmd-panel" role="dialog" aria-modal="true">
      <div class="cmd-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="cmd-input" placeholder="Type a command, section, or search projects..." aria-label="Search command palette" />
        <span class="cmd-shortcut-tag">ESC to close</span>
      </div>
      <div class="cmd-results" role="listbox"></div>
      <div class="cmd-footer">
        <span>Navigation: <kbd class="kbd-badge">↑</kbd> <kbd class="kbd-badge">↓</kbd></span>
        <span>Select: <kbd class="kbd-badge">↵ Enter</kbd></span>
      </div>
    </div>
  `;

  document.body.appendChild(commandBackdrop);

  commandInput = commandBackdrop.querySelector('.cmd-input');
  commandResults = commandBackdrop.querySelector('.cmd-results');

  commandBackdrop.addEventListener('click', (e) => {
    if (e.target === commandBackdrop) {
      closePalette();
    }
  });

  commandInput.addEventListener('input', (e) => {
    filterCommands(e.target.value);
  });

  commandInput.addEventListener('keydown', handleKeyNavigation);
}

export function openPalette() {
  if (!commandBackdrop) return;
  commandBackdrop.classList.add('open');
  commandInput.value = '';
  filterCommands('');
  setTimeout(() => commandInput.focus(), 50);
}

export function closePalette() {
  if (!commandBackdrop) return;
  commandBackdrop.classList.remove('open');
}

export function togglePalette() {
  if (isPaletteOpen()) {
    closePalette();
  } else {
    openPalette();
  }
}

export function isPaletteOpen() {
  return commandBackdrop && commandBackdrop.classList.contains('open');
}

function filterCommands(query) {
  const q = query.trim().toLowerCase();
  
  // Combine static commands and projects
  const projectCommands = portfolioData.projects.map((p) => ({
    group: 'Projects',
    title: `${p.title} (${p.category})`,
    icon: 'folder',
    badge: p.techStack.slice(0, 3).join(', '),
    action: () => {
      scrollToSection('projects');
      // Trigger modal after smooth scroll
      setTimeout(() => {
        window.openProjectModal?.(p.id);
      }, 350);
    }
  }));

  const all = [...staticCommands, ...projectCommands];

  if (!q) {
    currentItems = all;
  } else {
    currentItems = all.filter((item) => 
      item.title.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q))
    );
  }

  selectedIndex = 0;
  renderResults();
}

function renderResults() {
  if (!commandResults) return;

  if (currentItems.length === 0) {
    commandResults.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--text-sm);">
        No matching commands found.
      </div>
    `;
    return;
  }

  let html = '';
  let currentGroup = '';

  currentItems.forEach((item, index) => {
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      html += `<div class="cmd-group-title">${currentGroup}</div>`;
    }

    const isSelected = index === selectedIndex;
    html += `
      <button class="cmd-item ${isSelected ? 'selected' : ''}" data-index="${index}">
        <div class="cmd-item-left">
          ${getCommandIconSvg(item.icon)}
          <span>${item.title}</span>
        </div>
        ${item.badge ? `<span class="cmd-shortcut-tag">${item.badge}</span>` : ''}
      </button>
    `;
  });

  commandResults.innerHTML = html;

  // Add click listeners to items
  commandResults.querySelectorAll('.cmd-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      executeCommand(idx);
    });
  });
}

function handleKeyNavigation(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentItems.length > 0) {
      selectedIndex = (selectedIndex + 1) % currentItems.length;
      renderResults();
      scrollSelectedIntoView();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentItems.length > 0) {
      selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
      renderResults();
      scrollSelectedIntoView();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentItems[selectedIndex]) {
      executeCommand(selectedIndex);
    }
  }
}

function scrollSelectedIntoView() {
  const selectedEl = commandResults.querySelector('.cmd-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function executeCommand(index) {
  const item = currentItems[index];
  if (item && item.action) {
    closePalette();
    item.action();
  }
}

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

function getCommandIconSvg(iconName) {
  switch (iconName) {
    case 'home':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
    case 'user':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    case 'code':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    case 'folder':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>`;
    case 'download':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    case 'copy':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    case 'phone':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    case 'message':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    case 'sun':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line></svg>`;
    case 'file':
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
    default:
      return `<svg class="cmd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  }
}
