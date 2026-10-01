/**
 * themeToggle.js — Dark / Light mode theme management.
 *
 * Loaded synchronously in <head> to prevent Flash of Unstyled Content (FOUC).
 * Reads the user's saved preference from localStorage, falling back
 * to the OS-level prefers-color-scheme media query.
 *
 * Exposes a single global function: toggleTheme()
 */
(function () {
  var STORAGE_KEY = 'theme';

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function updateToggleIcons(theme) {
    var btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    var sunIcon = btn.querySelector('.icon-sun');
    var moonIcon = btn.querySelector('.icon-moon');
    if (sunIcon) sunIcon.classList.toggle('hidden', theme !== 'dark');
    if (moonIcon) moonIcon.classList.toggle('hidden', theme === 'dark');
    btn.setAttribute('aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  // Apply theme immediately — before first paint
  var initial = getPreferredTheme();
  applyTheme(initial);

  // Expose global toggle (called by the navbar button onclick)
  window.toggleTheme = function () {
    var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    updateToggleIcons(next);
  };

  // Update toggle icons once the DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    updateToggleIcons(getPreferredTheme());
  });

  // React to OS-level theme changes when no manual preference is saved
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      var theme = e.matches ? 'dark' : 'light';
      applyTheme(theme);
      updateToggleIcons(theme);
    }
  });
})();
