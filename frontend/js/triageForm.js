/**
 * triageForm.js — Multi-step questionnaire logic for the dashboard.
 * Handles step navigation, validation, symptom tag selection,
 * pain slider, form submission, and AI response rendering.
 */

import { apiFetch, showToast, getPatient } from './api.js';
import { requireAuth, logout } from './auth.js';

// Common symptom tags users can select
const SYMPTOM_TAGS = [
  'Fever', 'Headache', 'Nausea', 'Dizziness', 'Fatigue',
  'Cough', 'Shortness of breath', 'Vomiting', 'Diarrhea',
  'Chest pain', 'Sweating', 'Chills', 'Body aches',
  'Sore throat', 'Runny nose', 'Loss of appetite',
  'Blurred vision', 'Numbness', 'Swelling', 'Rash',
];

let currentStep = 1;
const totalSteps = 4;
const selectedSymptoms = new Set();

/**
 * Initialize the triage form on dashboard.html.
 */
export function initTriageForm() {
  if (!requireAuth()) return;

  // Greet the patient
  const patient = getPatient();
  const greeting = document.getElementById('patient-greeting');
  if (greeting && patient) {
    greeting.textContent = `Welcome, ${patient.name}`;
  }

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Build symptom tags
  buildSymptomTags();

  // Pain slider
  initPainSlider();

  // Step navigation
  document.querySelectorAll('[data-next-step]').forEach((btn) => {
    btn.addEventListener('click', () => goToStep(currentStep + 1));
  });
  document.querySelectorAll('[data-prev-step]').forEach((btn) => {
    btn.addEventListener('click', () => goToStep(currentStep - 1));
  });

  // Form submission
  document.getElementById('triage-form')?.addEventListener('submit', handleSubmit);

  // Start new assessment button (shown after result)
  document.getElementById('new-assessment-btn')?.addEventListener('click', resetForm);

  // Initialize step display
  updateStepUI();
}

/**
 * Build interactive symptom tag chips.
 */
function buildSymptomTags() {
  const container = document.getElementById('symptom-tags');
  if (!container) return;

  container.innerHTML = SYMPTOM_TAGS.map(
    (tag) =>
      `<button type="button" class="symptom-tag" data-symptom="${tag}" aria-pressed="false">
        <span>${tag}</span>
      </button>`
  ).join('');

  container.querySelectorAll('.symptom-tag').forEach((btn) => {
    btn.addEventListener('click', () => {
      const symptom = btn.dataset.symptom;
      const isActive = btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', isActive);
      if (isActive) {
        selectedSymptoms.add(symptom);
      } else {
        selectedSymptoms.delete(symptom);
      }
    });
  });
}

/**
 * Initialize the 1–10 pain slider with real-time indicator.
 */
function initPainSlider() {
  const slider = document.getElementById('pain-slider');
  const display = document.getElementById('pain-value');
  const track = document.getElementById('pain-track');

  if (!slider || !display) return;

  const updateSlider = () => {
    const val = parseInt(slider.value);
    display.textContent = val;

    // Color the indicator based on pain level (with dark mode variants)
    if (val <= 3) {
      display.className = 'text-3xl font-bold text-emerald-600 dark:text-emerald-400';
    } else if (val <= 6) {
      display.className = 'text-3xl font-bold text-amber-500 dark:text-amber-400';
    } else {
      display.className = 'text-3xl font-bold text-red-600 dark:text-red-400';
    }

    // Update track gradient — adapt unfilled track color for dark mode
    const percentage = ((val - 1) / 9) * 100;
    const isDark = document.documentElement.classList.contains('dark');
    const trackBg = isDark ? '#334155' : '#e2e8f0';
    if (track) {
      track.style.background = `linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)`;
    }
    slider.style.background = `linear-gradient(90deg, #0d9488 ${percentage}%, ${trackBg} ${percentage}%)`;
  };

  slider.addEventListener('input', updateSlider);
  updateSlider();
}

/**
 * Navigate to a specific step.
 */
function goToStep(step) {
  if (step < 1 || step > totalSteps) return;

  // Validate current step before advancing
  if (step > currentStep && !validateStep(currentStep)) return;

  currentStep = step;
  updateStepUI();

  // Populate the review summary when entering the final step
  if (step === totalSteps) {
    populateReview(buildPayload());
  }
}

/**
 * Validate form fields for the current step.
 */
function validateStep(step) {
  switch (step) {
    case 1: {
      const age = document.getElementById('patient-age')?.value;
      const gender = document.getElementById('patient-gender')?.value;
      if (!age || parseInt(age) < 0 || parseInt(age) > 150) {
        showToast('Please enter a valid age (0–150).', 'error');
        return false;
      }
      if (!gender) {
        showToast('Please select a gender.', 'error');
        return false;
      }
      return true;
    }
    case 2: {
      const symptom = document.getElementById('primary-symptom')?.value?.trim();
      const duration = document.getElementById('symptom-duration')?.value?.trim();
      if (!symptom || symptom.length < 3) {
        showToast('Please describe your primary symptom (at least 3 characters).', 'error');
        return false;
      }
      if (!duration) {
        showToast('Please specify how long you\'ve had this symptom.', 'error');
        return false;
      }
      return true;
    }
    case 3:
      return true; // Pain level always has a default; symptom tags are optional
    default:
      return true;
  }
}

/**
 * Update the step indicator and show/hide step panels.
 */
function updateStepUI() {
  // Step panels
  for (let i = 1; i <= totalSteps; i++) {
    const panel = document.getElementById(`step-${i}`);
    if (panel) {
      panel.classList.toggle('hidden', i !== currentStep);
      if (i === currentStep) {
        panel.classList.add('animate-fade-in');
      }
    }
  }

  // Step dots
  for (let i = 1; i <= totalSteps; i++) {
    const dot = document.getElementById(`dot-${i}`);
    const line = document.getElementById(`line-${i}`);
    if (dot) {
      dot.classList.remove('active', 'completed');
      if (i === currentStep) dot.classList.add('active');
      else if (i < currentStep) dot.classList.add('completed');
    }
    if (line) {
      line.classList.toggle('completed', i < currentStep);
    }
  }

  // Update step labels
  const label = document.getElementById('step-label');
  const labels = ['Patient Info', 'Chief Complaint', 'Symptoms & Pain', 'Review & Submit'];
  if (label) label.textContent = labels[currentStep - 1] || '';
}

/**
 * Build the symptom payload from current form inputs.
 * Extracted so it can be called both for the review step and on submission.
 */
function buildPayload() {
  const age = parseInt(document.getElementById('patient-age').value);
  const gender = document.getElementById('patient-gender').value;
  const primarySymptom = document.getElementById('primary-symptom').value.trim();
  const duration = document.getElementById('symptom-duration').value.trim();
  const painLevel = parseInt(document.getElementById('pain-slider').value);
  const additionalNotes = document.getElementById('additional-notes')?.value?.trim() || '';
  const otherSymptoms = [...selectedSymptoms];

  return {
    age,
    gender,
    primary_symptom: primarySymptom,
    duration,
    pain_level_1_to_10: painLevel,
    other_symptoms: otherSymptoms,
    additional_notes: additionalNotes,
  };
}

/**
 * Handle triage form submission.
 */
async function handleSubmit(e) {
  e.preventDefault();

  if (!validateStep(currentStep)) return;

  const payload = buildPayload();

  // Show loading state
  const formContainer = document.getElementById('form-container');
  const resultContainer = document.getElementById('result-container');
  const loadingContainer = document.getElementById('loading-container');

  formContainer.classList.add('hidden');
  loadingContainer.classList.remove('hidden');

  try {
    const result = await apiFetch('/assessments/analyze', {
      method: 'POST',
      body: payload,
    });

    loadingContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    renderTriageResult(result.data);
    showToast('Triage assessment complete!', 'success');
  } catch (error) {
    loadingContainer.classList.add('hidden');
    formContainer.classList.remove('hidden');
    showToast(error.message || 'Failed to analyze symptoms.', 'error');
  }
}

/**
 * Populate the review step (step 4) with a summary of inputs.
 */
function populateReview(payload) {
  const reviewEl = document.getElementById('review-summary');
  if (!reviewEl) return;

  reviewEl.innerHTML = `
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p class="text-slate-500 dark:text-slate-400 font-medium">Age</p>
        <p class="text-slate-800 dark:text-slate-100 font-semibold">${payload.age} years</p>
      </div>
      <div>
        <p class="text-slate-500 dark:text-slate-400 font-medium">Gender</p>
        <p class="text-slate-800 dark:text-slate-100 font-semibold">${payload.gender}</p>
      </div>
      <div class="col-span-2">
        <p class="text-slate-500 dark:text-slate-400 font-medium">Primary Symptom</p>
        <p class="text-slate-800 dark:text-slate-100 font-semibold">${escapeHtml(payload.primary_symptom)}</p>
      </div>
      <div>
        <p class="text-slate-500 dark:text-slate-400 font-medium">Duration</p>
        <p class="text-slate-800 dark:text-slate-100 font-semibold">${escapeHtml(payload.duration)}</p>
      </div>
      <div>
        <p class="text-slate-500 dark:text-slate-400 font-medium">Pain Level</p>
        <p class="text-slate-800 dark:text-slate-100 font-semibold">${payload.pain_level_1_to_10} / 10</p>
      </div>
      ${
        payload.other_symptoms.length > 0
          ? `<div class="col-span-2">
               <p class="text-slate-500 dark:text-slate-400 font-medium">Other Symptoms</p>
               <div class="flex flex-wrap gap-1.5 mt-1">${payload.other_symptoms.map((s) => `<span class="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs font-medium">${s}</span>`).join('')}</div>
             </div>`
          : ''
      }
      ${
        payload.additional_notes
          ? `<div class="col-span-2">
               <p class="text-slate-500 dark:text-slate-400 font-medium">Additional Notes</p>
               <p class="text-slate-800 dark:text-slate-200">${escapeHtml(payload.additional_notes)}</p>
             </div>`
          : ''
      }
    </div>
  `;
}

/**
 * Render the AI triage result card.
 */
function renderTriageResult(data) {
  const container = document.getElementById('triage-result');
  if (!container) return;

  const urgencyConfig = {
    Emergency: { badge: 'badge-emergency', icon: '🚨', label: 'EMERGENCY' },
    High:      { badge: 'badge-high',      icon: '⚠️', label: 'HIGH URGENCY' },
    Moderate:  { badge: 'badge-moderate',   icon: '🔶', label: 'MODERATE' },
    Low:       { badge: 'badge-low',        icon: '✅', label: 'LOW URGENCY' },
  };

  const config = urgencyConfig[data.urgency_level] || urgencyConfig.Moderate;

  container.innerHTML = `
    <div class="animate-fade-in-up">
      <!-- Urgency Header -->
      <div class="text-center mb-8">
        <span class="text-5xl mb-3 block">${config.icon}</span>
        <span class="inline-block px-5 py-2 rounded-full text-sm font-bold tracking-wider ${config.badge}">
          ${config.label}
        </span>
      </div>

      <!-- Expected Condition -->
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-5">
        <h3 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Suspected Condition</h3>
        <p class="text-xl font-bold text-slate-800 dark:text-white">${escapeHtml(data.expected_disease)}</p>
      </div>

      <!-- Clinical Summary -->
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-5">
        <h3 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Clinical Summary</h3>
        <p class="text-slate-700 dark:text-slate-300 leading-relaxed">${escapeHtml(data.current_condition_summary)}</p>
      </div>

      <!-- Detailed Report -->
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-5">
        <h3 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Detailed Report & Next Steps</h3>
        <div class="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">${escapeHtml(data.detailed_report)}</div>
      </div>

      <!-- Assessment Metadata -->
      <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-5 text-sm text-slate-500 dark:text-slate-400">
        <p>Assessment ID: <span class="font-mono font-medium">#${data.assessment_id}</span></p>
        <p>Assessed at: ${new Date(data.assessed_at).toLocaleString()}</p>
      </div>

      <!-- Medical Disclaimer -->
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-5 mb-6">
        <div class="flex items-start gap-3">
          <svg class="w-6 h-6 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p class="text-amber-800 dark:text-amber-200 text-sm leading-relaxed">
            <strong>Medical Disclaimer:</strong> This assessment is AI-generated for educational and informational triage assistance only. 
            It is <strong>NOT</strong> a substitute for professional medical advice, clinical diagnosis, or emergency treatment. 
            If you are experiencing a life-threatening medical emergency, immediately contact your local emergency services (e.g., 911/112).
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Reset form to start a new assessment.
 */
function resetForm() {
  currentStep = 1;
  selectedSymptoms.clear();

  // Reset form fields
  document.getElementById('triage-form')?.reset();
  document.querySelectorAll('.symptom-tag').forEach((tag) => {
    tag.classList.remove('active');
    tag.setAttribute('aria-pressed', 'false');
  });

  // Reset visibility
  document.getElementById('form-container')?.classList.remove('hidden');
  document.getElementById('result-container')?.classList.add('hidden');
  document.getElementById('loading-container')?.classList.add('hidden');

  // Reinitialize slider
  initPainSlider();
  updateStepUI();

  showToast('Ready for a new assessment.', 'info');
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
