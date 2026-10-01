/**
 * api.js — Centralized fetch wrapper with JWT Bearer token handling.
 * All API calls flow through this module for consistent auth, error
 * handling, and base URL management.
 */

const API_BASE = '/api';

/**
 * Retrieve the stored JWT token from localStorage.
 */
export function getToken() {
  return localStorage.getItem('triage_token');
}

/**
 * Store the JWT token in localStorage.
 */
export function setToken(token) {
  localStorage.setItem('triage_token', token);
}

/**
 * Remove the JWT token (logout).
 */
export function removeToken() {
  localStorage.removeItem('triage_token');
  localStorage.removeItem('triage_patient');
}

/**
 * Store patient profile data in localStorage.
 */
export function setPatient(patient) {
  localStorage.setItem('triage_patient', JSON.stringify(patient));
}

/**
 * Retrieve stored patient profile from localStorage.
 */
export function getPatient() {
  try {
    const raw = localStorage.getItem('triage_patient');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check if the user is currently authenticated (has a token).
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Centralized fetch wrapper.
 * Automatically injects Authorization header when a token exists.
 *
 * @param {string} endpoint — relative to API_BASE (e.g., '/auth/login')
 * @param {Object} options — fetch options (method, body, etc.)
 * @returns {Promise<Object>} parsed JSON response
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle auth expiry globally
      if (response.status === 401) {
        removeToken();
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
          showToast('Session expired. Please log in again.', 'error');
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 1500);
        }
      }
      throw new ApiError(data.message || 'An error occurred.', response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Network or unexpected errors
    throw new ApiError(
      'Unable to connect to the server. Please check your connection.',
      0,
      null
    );
  }
}

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration — ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
