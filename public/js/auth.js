/**
 * auth.js — Login / Register state management and session logic.
 * Handles the auth modals on index.html and global session checks.
 */

import { apiFetch, setToken, setPatient, removeToken, isAuthenticated, showToast } from './api.js';

/**
 * Initialize auth UI on the landing page (index.html).
 * Sets up modal toggles, form submissions, and session redirect.
 */
export function initAuth() {
  // If already authenticated, redirect to dashboard
  if (isAuthenticated()) {
    window.location.href = '/dashboard.html';
    return;
  }

  // DOM References
  const loginModal = document.getElementById('login-modal');
  const registerModal = document.getElementById('register-modal');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showLoginBtns = document.querySelectorAll('[data-show-login]');
  const showRegisterBtns = document.querySelectorAll('[data-show-register]');
  const closeModalBtns = document.querySelectorAll('[data-close-modal]');
  const heroLoginBtn = document.getElementById('hero-login-btn');
  const heroRegisterBtn = document.getElementById('hero-register-btn');

  // ── Modal toggles ────────────────────────────────────────
  const openModal = (modal) => {
    modal.classList.remove('hidden');
    modal.querySelector('input')?.focus();
  };

  const closeModal = (modal) => {
    modal.classList.add('hidden');
  };

  heroLoginBtn?.addEventListener('click', () => openModal(loginModal));
  heroRegisterBtn?.addEventListener('click', () => openModal(registerModal));

  showLoginBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      closeModal(registerModal);
      openModal(loginModal);
    })
  );

  showRegisterBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      closeModal(loginModal);
      openModal(registerModal);
    })
  );

  closeModalBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      closeModal(loginModal);
      closeModal(registerModal);
    })
  );

  // Close on overlay click
  [loginModal, registerModal].forEach((modal) => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(loginModal);
      closeModal(registerModal);
    }
  });

  // ── Login Form Submission ─────────────────────────────────
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const email = loginForm.querySelector('#login-email').value.trim();
    const password = loginForm.querySelector('#login-password').value;

    if (!email || !password) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin inline-block mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15"/></svg> Signing in…`;

    try {
      const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setToken(result.data.token);
      setPatient(result.data.patient);
      showToast('Welcome back! Redirecting…', 'success');
      setTimeout(() => (window.location.href = '/dashboard.html'), 800);
    } catch (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // ── Register Form Submission ──────────────────────────────
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const name = registerForm.querySelector('#register-name').value.trim();
    const email = registerForm.querySelector('#register-email').value.trim();
    const password = registerForm.querySelector('#register-password').value;
    const confirmPassword = registerForm.querySelector('#register-confirm-password').value;

    if (!name || !email || !password || !confirmPassword) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin inline-block mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15"/></svg> Creating account…`;

    try {
      const result = await apiFetch('/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });

      setToken(result.data.token);
      setPatient(result.data.patient);
      showToast('Account created! Redirecting…', 'success');
      setTimeout(() => (window.location.href = '/dashboard.html'), 800);
    } catch (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

/**
 * Guard a protected page — redirect to index if not authenticated.
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/**
 * Logout the current user and redirect to landing page.
 */
export function logout() {
  removeToken();
  showToast('Logged out successfully.', 'info');
  setTimeout(() => (window.location.href = '/index.html'), 600);
}
