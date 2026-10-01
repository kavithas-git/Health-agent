/**
 * history.js — Fetch and render past health assessments.
 * Displays a timeline of previous triage reports with collapsible cards.
 */

import { apiFetch, showToast, getPatient } from './api.js';
import { requireAuth, logout } from './auth.js';

/**
 * Initialize the history page.
 */
export function initHistory() {
  if (!requireAuth()) return;

  // Greet the patient
  const patient = getPatient();
  const greeting = document.getElementById('patient-greeting');
  if (greeting && patient) {
    greeting.textContent = `Welcome, ${patient.name}`;
  }

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Fetch and render history
  loadHistory();
}

/**
 * Fetch assessments from the API and render them.
 */
async function loadHistory() {
  const container = document.getElementById('history-list');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('assessment-count');

  if (!container) return;

  // Show skeleton loaders while fetching
  container.innerHTML = generateSkeletons(3);

  try {
    const result = await apiFetch('/assessments/history');
    const assessments = result.data.assessments;

    if (countBadge) {
      countBadge.textContent = `${result.data.total} assessment${result.data.total !== 1 ? 's' : ''}`;
    }

    if (!assessments || assessments.length === 0) {
      container.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');
    container.innerHTML = assessments.map((a, idx) => renderAssessmentCard(a, idx)).join('');

    // Attach toggle listeners for collapsible detail sections
    container.querySelectorAll('[data-toggle-detail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.toggleDetail);
        const chevron = btn.querySelector('.chevron');
        if (target) {
          target.classList.toggle('hidden');
          chevron?.classList.toggle('rotate-180');
        }
      });
    });
  } catch (error) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-500 dark:text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <p class="font-medium">Failed to load assessment history.</p>
        <p class="text-sm mt-1">${escapeHtml(error.message)}</p>
        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
          Try Again
        </button>
      </div>
    `;
    showToast(error.message, 'error');
  }
}

/**
 * Render a single assessment card.
 */
function renderAssessmentCard(assessment, index) {
  const urgencyConfig = {
    Emergency: { badge: 'badge-emergency', icon: '🚨', color: 'border-l-red-500' },
    High:      { badge: 'badge-high',      icon: '⚠️', color: 'border-l-amber-500' },
    Moderate:  { badge: 'badge-moderate',   icon: '🔶', color: 'border-l-yellow-500' },
    Low:       { badge: 'badge-low',        icon: '✅', color: 'border-l-emerald-500' },
  };

  const config = urgencyConfig[assessment.urgency_level] || urgencyConfig.Moderate;
  const detailId = `detail-${assessment.id}`;
  const date = new Date(assessment.created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  // Parse symptoms data
  let symptoms = assessment.symptoms_data;
  if (typeof symptoms === 'string') {
    try { symptoms = JSON.parse(symptoms); } catch { symptoms = {}; }
  }

  return `
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden border-l-4 ${config.color} animate-fade-in" style="animation-delay: ${index * 0.08}s; opacity: 0;">
      <!-- Card Header -->
      <div class="p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" data-toggle-detail="${detailId}" role="button" tabindex="0" aria-expanded="false" aria-controls="${detailId}">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="text-lg">${config.icon}</span>
              <span class="px-3 py-1 rounded-full text-xs font-bold tracking-wide ${config.badge}">
                ${assessment.urgency_level.toUpperCase()}
              </span>
              <span class="text-xs text-slate-400 dark:text-slate-500 font-medium">#${assessment.id}</span>
            </div>
            <h3 class="text-base font-bold text-slate-800 dark:text-white truncate">${escapeHtml(assessment.expected_disease)}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(symptoms.primary_symptom || 'N/A')} · Pain: ${symptoms.pain_level_1_to_10 || 'N/A'}/10</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">${formattedDate}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500">${formattedTime}</p>
            <svg class="chevron w-5 h-5 text-slate-400 dark:text-slate-500 mt-2 ml-auto transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Collapsible Detail -->
      <div id="${detailId}" class="hidden border-t border-slate-100 dark:border-slate-700">
        <div class="p-5 space-y-4 bg-slate-50/50 dark:bg-slate-800/50">
          <!-- Symptoms Submitted -->
          <div>
            <h4 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Symptoms Submitted</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div><span class="text-slate-400 dark:text-slate-500">Age:</span> <span class="font-medium text-slate-700 dark:text-slate-300">${symptoms.age || 'N/A'}</span></div>
              <div><span class="text-slate-400 dark:text-slate-500">Gender:</span> <span class="font-medium text-slate-700 dark:text-slate-300">${symptoms.gender || 'N/A'}</span></div>
              <div><span class="text-slate-400 dark:text-slate-500">Duration:</span> <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(symptoms.duration || 'N/A')}</span></div>
            </div>
            ${
              symptoms.other_symptoms && symptoms.other_symptoms.length > 0
                ? `<div class="flex flex-wrap gap-1.5 mt-2">${symptoms.other_symptoms.map((s) => `<span class="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs font-medium">${escapeHtml(s)}</span>`).join('')}</div>`
                : ''
            }
          </div>

          <!-- Full Report -->
          <div>
            <h4 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Detailed Report</h4>
            <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">${escapeHtml(assessment.full_report)}</p>
          </div>

          <!-- Disclaimer -->
          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            <strong>Disclaimer:</strong> This assessment is AI-generated for educational and informational purposes only. It is NOT a substitute for professional medical advice, clinical diagnosis, or emergency treatment. If you are experiencing a life-threatening medical emergency, immediately contact your local emergency services (e.g., 911/112).
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate skeleton loaders.
 */
function generateSkeletons(count) {
  return Array.from({ length: count })
    .map(
      () => `
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div class="flex items-center gap-3 mb-3">
        <div class="skeleton w-8 h-8 rounded-full"></div>
        <div class="skeleton w-24 h-6"></div>
      </div>
      <div class="skeleton w-3/4 h-5 mb-2"></div>
      <div class="skeleton w-1/2 h-4"></div>
    </div>
  `
    )
    .join('');
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
