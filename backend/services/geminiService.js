const { GoogleGenAI } = require('@google/genai');

// Lazily initialized client — created on first call so dotenv has loaded.
let ai = null;

const getClient = () => {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
};

/**
 * Maximum time (ms) to wait for a single Gemini API call.
 * Set below the Vercel function maxDuration (30s) to leave
 * room for response serialization and DB writes.
 */
const GEMINI_TIMEOUT_MS = 25000;

/**
 * System instruction that tells Gemini to behave as a triage assistant
 * and return structured JSON matching our schema.
 */
const SYSTEM_PROMPT = `You are an expert emergency medicine triage assistant.

Analyze the provided patient JSON data with extreme care.
Evaluate red flags (e.g., crushing chest pain, acute dyspnea, sudden neurological deficits).

Respond strictly in JSON matching the exact schema below — do NOT wrap the JSON in markdown fences:
{
  "urgency_level": "Emergency | High | Moderate | Low",
  "expected_disease": "Primary suspected condition or brief differential diagnosis",
  "current_condition_summary": "Concise summary of the clinical presentation",
  "detailed_report": "Compassionate, structured clinical breakdown explaining the urgency rating, potential mechanisms, and explicit next steps (e.g., immediate ER visit, urgent care within 24h, or primary physician follow-up)."
}

Classification Tiers:
- Emergency: Immediate life-threatening conditions requiring emergency services (e.g., MI, stroke, anaphylaxis, severe trauma).
- High: Serious conditions requiring urgent medical attention within hours (e.g., suspected fractures, high fever with confusion, severe abdominal pain).
- Moderate: Conditions requiring medical attention within 24-48 hours (e.g., persistent moderate pain, worsening rash, recurring symptoms).
- Low: Non-urgent conditions suitable for primary care follow-up (e.g., mild cold symptoms, minor aches, routine health queries).

Important rules:
- Always err on the side of caution — if unsure, classify higher.
- Be compassionate and avoid alarming language while remaining clinically accurate.
- Include explicit, actionable next-step recommendations.
- ALWAYS include a reminder that this is AI-generated guidance and not a substitute for professional medical evaluation.`;

/**
 * Generate a graceful fallback response when the AI service is
 * unreachable or times out. Classifies as Moderate to err on
 * the side of caution and directs the patient to seek care.
 */
function buildFallbackResponse(symptomsData) {
  return {
    urgency_level: 'Moderate',
    expected_disease: 'Unable to determine — AI analysis timed out',
    current_condition_summary:
      `The AI triage service was unable to complete the analysis for the reported symptom: "${symptomsData.primary_symptom || 'unspecified'}". ` +
      'This does not reflect the severity of your condition.',
    detailed_report:
      'The AI-powered triage analysis could not be completed within the allowed time. ' +
      'This may be due to high demand on the AI service.\n\n' +
      'Recommended next steps:\n' +
      '1. Please try submitting your assessment again in a few minutes.\n' +
      '2. If your symptoms are severe, worsening, or you feel this is an emergency, ' +
      'do not wait — contact your local emergency services (e.g., 911/112) or visit the nearest emergency room immediately.\n' +
      '3. For non-urgent concerns, schedule an appointment with your primary care physician.\n\n' +
      '⚠️ This is an AI-generated fallback message. It is NOT a medical assessment and is NOT a substitute for professional medical evaluation.',
  };
}

/**
 * Call the Gemini API with a timeout using AbortController.
 * Returns the raw response text.
 */
async function callGeminiWithTimeout(client, model, userPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.3, // Low temperature for clinical accuracy
      },
    });

    clearTimeout(timeoutId);
    return response.text;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Gemini API call timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * Analyze patient symptoms using the Gemini model.
 * Includes automatic retry with exponential backoff for transient errors,
 * model fallback if the primary model is unavailable, and a graceful
 * timeout-based fallback response for serverless execution limits.
 *
 * @param {Object} symptomsData — structured patient symptom payload
 * @returns {Object} parsed JSON triage result from Gemini
 */
const analyzeSymptoms = async (symptomsData) => {
  const client = getClient();

  const userPrompt = `Patient data for triage analysis:\n${JSON.stringify(symptomsData, null, 2)}`;

  // Models to try in order of preference
  const models = ['gemini-3.5-flash', 'gemini-3.8-flash'];
  const maxRetries = 3;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini] Attempt ${attempt}/${maxRetries} with model ${model}`);

        const text = await callGeminiWithTimeout(client, model, userPrompt);

        // Parse the JSON response
        let triageResult;
        try {
          // Strip markdown fences if the model wraps JSON in them
          const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          triageResult = JSON.parse(cleaned);
        } catch (parseError) {
          console.error('[Gemini] Failed to parse JSON response:', text);
          throw new Error('AI returned an invalid response format. Please try again.');
        }

        // Validate required fields
        const requiredFields = ['urgency_level', 'expected_disease', 'current_condition_summary', 'detailed_report'];
        for (const field of requiredFields) {
          if (!triageResult[field]) {
            throw new Error(`AI response missing required field: ${field}`);
          }
        }

        // Validate urgency level
        const validLevels = ['Emergency', 'High', 'Moderate', 'Low'];
        if (!validLevels.includes(triageResult.urgency_level)) {
          const normalized = validLevels.find(
            (l) => l.toLowerCase() === triageResult.urgency_level.toLowerCase()
          );
          if (normalized) {
            triageResult.urgency_level = normalized;
          } else {
            triageResult.urgency_level = 'Moderate'; // Safe fallback
          }
        }

        console.log(`[Gemini] Success with model ${model} on attempt ${attempt}`);
        return triageResult;
      } catch (error) {
        // Check if this was a timeout — return fallback immediately
        if (error.message?.includes('timed out')) {
          console.warn(`[Gemini] Timeout reached on model ${model}, attempt ${attempt}.`);

          // If this is our last chance, return a graceful fallback
          if (attempt === maxRetries || model === models[models.length - 1]) {
            console.warn('[Gemini] All attempts exhausted after timeout. Returning fallback response.');
            return buildFallbackResponse(symptomsData);
          }
          // Otherwise try next model immediately (don't retry same model on timeout)
          break;
        }

        const isRetryable =
          error.message?.includes('503') ||
          error.message?.includes('UNAVAILABLE') ||
          error.message?.includes('high demand') ||
          error.message?.includes('overloaded') ||
          error.message?.includes('rate');

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s backoff
          console.log(`[Gemini] Retryable error on ${model}, waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isRetryable && attempt === maxRetries) {
          console.log(`[Gemini] Model ${model} exhausted retries, trying next model...`);
          break; // Try next model
        }

        // Non-retryable errors
        if (error.message?.includes('API key')) {
          throw new Error('Invalid Gemini API key. Please check your configuration.');
        }
        if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
          console.log(`[Gemini] Model ${model} not found, trying next model...`);
          break; // Try next model
        }

        throw error;
      }
    }
  }

  // All models exhausted — return fallback instead of crashing
  console.warn('[Gemini] All models exhausted. Returning fallback response.');
  return buildFallbackResponse(symptomsData);
};

module.exports = { analyzeSymptoms };
