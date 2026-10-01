const { query } = require('../config/db');
const { analyzeSymptoms } = require('../services/geminiService');

/**
 * POST /api/assessments/analyze
 * Accept patient symptoms, send to Gemini, persist results, and return triage report.
 */
const analyzeAndSave = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const symptomsData = req.body;

    // ── Validate required symptom fields ────────────────────
    const { age, gender, primary_symptom } = symptomsData;

    if (!age || !gender || !primary_symptom) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: age, gender, and primary_symptom.',
      });
    }

    if (typeof age !== 'number' || age < 0 || age > 150) {
      return res.status(400).json({
        success: false,
        message: 'Age must be a number between 0 and 150.',
      });
    }

    if (typeof primary_symptom !== 'string' || primary_symptom.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Primary symptom must be at least 3 characters.',
      });
    }

    // ── Call Gemini AI ──────────────────────────────────────
    const triageResult = await analyzeSymptoms(symptomsData);

    // ── Persist to database ─────────────────────────────────
    const insertResult = await query(
      `INSERT INTO health_assessments
         (patient_id, symptoms_data, urgency_level, expected_disease, full_report)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        patientId,
        JSON.stringify(symptomsData),
        triageResult.urgency_level,
        triageResult.expected_disease,
        triageResult.detailed_report,
      ]
    );

    const savedRecord = insertResult.rows[0];

    // ── Return response ─────────────────────────────────────
    res.status(200).json({
      success: true,
      message: 'Triage assessment completed.',
      data: {
        assessment_id: savedRecord.id,
        urgency_level: triageResult.urgency_level,
        expected_disease: triageResult.expected_disease,
        current_condition_summary: triageResult.current_condition_summary,
        detailed_report: triageResult.detailed_report,
        symptoms_submitted: symptomsData,
        assessed_at: savedRecord.created_at,
        disclaimer:
          'This assessment is AI-generated for informational and educational purposes only. It is NOT a substitute for professional medical advice, clinical diagnosis, or emergency treatment. If you are experiencing a life-threatening emergency, contact emergency services (e.g., 911/112) immediately.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/assessments/history
 * Retrieve all past assessments for the authenticated patient.
 */
const getHistory = async (req, res, next) => {
  try {
    const patientId = req.user.id;

    const result = await query(
      `SELECT id, symptoms_data, urgency_level, expected_disease, full_report, created_at
       FROM health_assessments
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );

    res.status(200).json({
      success: true,
      data: {
        total: result.rows.length,
        assessments: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { analyzeAndSave, getHistory };
