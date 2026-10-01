-- ============================================================
-- AI Health Triage Agent — PostgreSQL Schema
-- ============================================================

-- Patients table: stores registered user credentials and metadata
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Health assessments table: stores symptom input + AI triage output
CREATE TABLE IF NOT EXISTS health_assessments (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    symptoms_data JSONB NOT NULL,
    urgency_level VARCHAR(50) NOT NULL,
    expected_disease VARCHAR(255) NOT NULL,
    full_report TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup of a patient's assessment history
CREATE INDEX IF NOT EXISTS idx_health_assessments_patient_id ON health_assessments(patient_id);
