'use client';

import { useState, useRef } from 'react';
import DigitalTwinVisualizer from './DigitalTwinVisualizer';
import { useAuth } from '../context/AuthContext';

export default function DoctorUpload({ onScanCreated, onSwitchToPatient }) {
  const { token, user, isDoctor, login } = useAuth();

  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [clinicalNote, setClinicalNote] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Submit scan to backend API
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!patientName.trim()) {
      setError('Please enter the patient name.');
      return;
    }

    if (!selectedFile) {
      setError('Please select or drop a chest X-ray image.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('patientName', patientName.trim());
      if (patientEmail) formData.append('patientEmail', patientEmail.trim());
      if (age) formData.append('age', age);
      formData.append('gender', gender);
      if (clinicalNote) formData.append('clinicalNote', clinicalNote.trim());
      formData.append('image', selectedFile);

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/patient-scans', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload and analyze scan.');
      }

      setResult(data.data);
      if (onScanCreated) {
        onScanCreated(data.data);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during scan upload and inference.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {/* Left Column: Form & Upload Dropzone */}
        <div style={styles.formCard} className="glass-panel">
          <div style={styles.cardHeader}>
            <div style={styles.sectionIcon}>🩺</div>
            <div>
              <h2 style={styles.cardTitle}>Doctor Patient Ingestion & Scan Upload</h2>
              <p style={styles.cardSubtitle}>
                Upload chest radiograph to trigger deep learning prediction and generate a Digital Twin.
              </p>
            </div>
          </div>

          {!isDoctor && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              color: '#fef08a'
            }}>
              <div>
                <strong>🩺 Doctor Login Required:</strong> You are currently not signed in as a Doctor.
              </div>
              <button
                type="button"
                onClick={() => login('dr.priya.sharma@lungtwin.ai', 'LungTwinDoctor2026!', 'doctor')}
                style={{
                  background: 'rgba(234, 179, 8, 0.25)',
                  border: '1px solid rgba(234, 179, 8, 0.6)',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Sign In as Dr. Sharma
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Patient Name & Email & Age Row */}
            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  Patient Full Name <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Verma, Ananya Iyer"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Patient Account Email</label>
                <input
                  type="email"
                  placeholder="e.g. rahul.verma@example.com"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={{ ...styles.inputGroup, maxWidth: '110px' }}>
                <label style={styles.label}>Age</label>
                <input
                  type="number"
                  placeholder="e.g. 48"
                  min="0"
                  max="125"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={{ ...styles.inputGroup, maxWidth: '140px' }}>
                <label style={styles.label}>Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={styles.select}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            {/* Clinical Note */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Clinical Observation / Doctor Notes</label>
              <textarea
                placeholder="e.g. Patient presents with dyspnea, persistent productive cough, SpO2 93% on room air..."
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                rows={3}
                style={styles.textarea}
              />
            </div>

            {/* X-Ray Image Upload Dropzone */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                Chest Radiograph (X-Ray Scan) <span style={styles.required}>*</span>
              </label>

              <div
                style={{
                  ...styles.dropzone,
                  ...(previewUrl ? styles.dropzoneWithPreview : {}),
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/jpg"
                  style={{ display: 'none' }}
                />

                {previewUrl ? (
                  <div style={styles.previewContainer}>
                    <img src={previewUrl} alt="Chest X-Ray Preview" style={styles.previewImage} />
                    <div style={styles.previewOverlay}>
                      <span style={styles.previewTag}>
                        {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)} KB)
                      </span>
                      <span style={styles.changePrompt}>Click or drag to replace image</span>
                    </div>
                  </div>
                ) : (
                  <div style={styles.emptyDropzone}>
                    <div style={styles.uploadIcon}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div style={styles.dropzoneTitle}>Drop Chest X-Ray radiograph here</div>
                    <div style={styles.dropzoneSubtitle}>Supports high-resolution JPEG and PNG files</div>
                    <button type="button" style={styles.browseBtn}>
                      Browse Local Files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error banner */}
            {error && <div style={styles.errorBanner}>{error}</div>}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                ...(loading ? styles.submitBtnLoading : {}),
              }}
            >
              {loading ? (
                <>
                  <span style={styles.spinner}></span>
                  Analyzing Scan with ResNet-18...
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.2rem' }}>⚡</span>
                  Run AI Prediction & Generate Digital Twin
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: AI Analysis & Live Result Panel */}
        <div style={styles.resultCol}>
          {result ? (
            <div style={styles.resultCard} className="glass-panel">
              <div style={styles.resultHeader}>
                <div style={styles.analysisTag}>ANALYSIS COMPLETE</div>
                <h3 style={styles.resultTitle}>{result.patientName}</h3>
                <div style={styles.resultMeta}>
                  {result.age ? `Age: ${result.age} yrs` : ''} • {result.gender} • Scan ID: {result.id?.slice(-6)}
                </div>
              </div>

              {/* AI Prediction Badge */}
              <div
                style={{
                  ...styles.predictionBox,
                  borderColor: result.prediction?.isPneumonia ? 'rgba(244, 63, 94, 0.5)' : 'rgba(16, 185, 129, 0.5)',
                  background: result.prediction?.isPneumonia
                    ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(15, 23, 42, 0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 23, 42, 0.7) 100%)',
                }}
              >
                <div style={styles.predTop}>
                  <div style={styles.predClass}>
                    {result.prediction?.predictedClass === 'PNEUMONIA' ? 'PNEUMONIA DETECTED' : 'NORMAL (CLEAR)'}
                  </div>
                  <div style={styles.predConf}>{result.prediction?.confidencePercentage} Confidence</div>
                </div>

                {/* Probability Bars */}
                <div style={styles.probSection}>
                  <div style={styles.probRow}>
                    <span style={styles.probName}>PNEUMONIA</span>
                    <span style={styles.probVal}>
                      {((result.prediction?.probabilities?.pneumonia || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={styles.probBarBg}>
                    <div
                      style={{
                        ...styles.probBarFill,
                        width: `${(result.prediction?.probabilities?.pneumonia || 0) * 100}%`,
                        backgroundColor: '#f43f5e',
                      }}
                    ></div>
                  </div>

                  <div style={{ ...styles.probRow, marginTop: '8px' }}>
                    <span style={styles.probName}>NORMAL</span>
                    <span style={styles.probVal}>
                      {((result.prediction?.probabilities?.normal || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={styles.probBarBg}>
                    <div
                      style={{
                        ...styles.probBarFill,
                        width: `${(result.prediction?.probabilities?.normal || 0) * 100}%`,
                        backgroundColor: '#10b981',
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Digital Twin Snapshot */}
              <div style={styles.twinSummary}>
                <div style={styles.summaryLabel}>DIGITAL TWIN STATUS</div>
                <div style={styles.summaryTitle}>{result.digitalTwin?.twinStatus}</div>
                <div style={styles.summaryGrid}>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryItemLabel}>Severity Index</span>
                    <span style={styles.summaryItemValue}>{result.digitalTwin?.severityIndex}/100</span>
                  </div>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryItemLabel}>Aeration</span>
                    <span style={styles.summaryItemValue}>{result.digitalTwin?.aerationScores?.overall}%</span>
                  </div>
                </div>
                <p style={styles.summaryCondition}>{result.digitalTwin?.lungCondition}</p>
              </div>

              {/* Quick Action to view timeline */}
              <button
                type="button"
                style={styles.viewTimelineBtn}
                onClick={() => onSwitchToPatient && onSwitchToPatient(result.patientName)}
              >
                <span>🔍 View Patient Digital Twin History</span>
                <span style={{ fontSize: '1.1rem' }}>→</span>
              </button>
            </div>
          ) : (
            <div style={styles.placeholderCard} className="glass-panel">
              <div style={styles.placeholderIcon}>🔬</div>
              <h3 style={styles.placeholderTitle}>AI Diagnostics & Digital Twin Ready</h3>
              <p style={styles.placeholderText}>
                Fill in the patient metadata, upload a chest radiograph, and click <strong>Run AI Prediction</strong>.
              </p>
              <div style={styles.featureList}>
                <div style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  <span>Attentive-LungNet: ResNet-18 + CBAM Dual Attention Module</span>
                </div>
                <div style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  <span>Multi-Task Dual Head: Classification + Continuous Severity Regressor</span>
                </div>
                <div style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  <span>Grad-CAM Explainable AI: Automated Lobe Aeration Mapping</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Generated Digital Twin Visualization */}
      {result && (
        <div style={{ marginTop: '28px' }}>
          <DigitalTwinVisualizer
            digitalTwin={result.digitalTwin}
            prediction={result.prediction}
            patientName={result.patientName}
            scanDate={new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            imageUrl={result.imageUrl || previewUrl}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '30px 24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(340px, 1.4fr) minmax(300px, 1fr)',
    gap: '28px',
    alignItems: 'start',
  },
  formCard: {
    padding: '28px',
  },
  cardHeader: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  sectionIcon: {
    fontSize: '1.8rem',
    background: 'rgba(6, 182, 212, 0.15)',
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid rgba(6, 182, 212, 0.3)',
  },
  cardTitle: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: '-0.02em',
  },
  cardSubtitle: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  row: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  inputGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '160px',
  },
  label: {
    fontSize: '0.825rem',
    fontWeight: '600',
    color: '#cbd5e1',
    letterSpacing: '0.01em',
  },
  required: {
    color: '#f43f5e',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(15, 23, 42, 0.7)',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
  },
  textarea: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(15, 23, 42, 0.7)',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  dropzone: {
    border: '2px dashed rgba(6, 182, 212, 0.35)',
    borderRadius: '14px',
    background: 'rgba(6, 182, 212, 0.03)',
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  dropzoneWithPreview: {
    padding: '10px',
    borderStyle: 'solid',
    borderColor: 'rgba(6, 182, 212, 0.5)',
  },
  emptyDropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  uploadIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(6, 182, 212, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#06b6d4',
  },
  dropzoneTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#f8fafc',
  },
  dropzoneSubtitle: {
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  browseBtn: {
    marginTop: '6px',
    padding: '8px 18px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#f8fafc',
    fontSize: '0.825rem',
    fontWeight: '600',
  },
  previewContainer: {
    position: 'relative',
    borderRadius: '10px',
    overflow: 'hidden',
    maxHeight: '260px',
  },
  previewImage: {
    width: '100%',
    maxHeight: '260px',
    objectFit: 'contain',
    display: 'block',
    background: '#000',
  },
  previewOverlay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(15, 23, 42, 0.85)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  previewTag: {
    fontSize: '0.75rem',
    color: '#cbd5e1',
    fontWeight: '600',
  },
  changePrompt: {
    fontSize: '0.75rem',
    color: '#06b6d4',
  },
  errorBanner: {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid rgba(244, 63, 94, 0.3)',
    color: '#fda4af',
    fontSize: '0.85rem',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px 24px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    color: '#070b13',
    fontSize: '1rem',
    fontWeight: '700',
    letterSpacing: '0.01em',
    boxShadow: '0 8px 24px rgba(6, 182, 212, 0.3)',
  },
  submitBtnLoading: {
    opacity: 0.8,
    cursor: 'wait',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '3px solid rgba(7, 11, 19, 0.3)',
    borderTopColor: '#070b13',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  resultCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  resultCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  resultHeader: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '14px',
  },
  analysisTag: {
    fontSize: '0.7rem',
    fontWeight: '800',
    letterSpacing: '0.08em',
    color: '#10b981',
    marginBottom: '4px',
  },
  resultTitle: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#f8fafc',
  },
  resultMeta: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    marginTop: '2px',
  },
  predictionBox: {
    padding: '18px',
    borderRadius: '14px',
    border: '1px solid',
  },
  predTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '14px',
  },
  predClass: {
    fontSize: '1.15rem',
    fontWeight: '800',
    letterSpacing: '-0.01em',
    color: '#f8fafc',
  },
  predConf: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  probSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  probRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#94a3b8',
  },
  probName: {},
  probVal: {
    color: '#f8fafc',
  },
  probBarBg: {
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  probBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.8s ease',
  },
  twinSummary: {
    padding: '16px',
    borderRadius: '12px',
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  summaryLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#06b6d4',
    marginBottom: '4px',
  },
  summaryTitle: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '10px',
  },
  summaryGrid: {
    display: 'flex',
    gap: '16px',
    marginBottom: '10px',
  },
  summaryItem: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(7, 11, 19, 0.4)',
  },
  summaryItemLabel: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    display: 'block',
  },
  summaryItemValue: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: '#f8fafc',
  },
  summaryCondition: {
    fontSize: '0.8rem',
    color: '#cbd5e1',
    lineHeight: '1.4',
  },
  viewTimelineBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderRadius: '10px',
    background: 'rgba(6, 182, 212, 0.15)',
    border: '1px solid rgba(6, 182, 212, 0.35)',
    color: '#06b6d4',
    fontSize: '0.9rem',
    fontWeight: '700',
    transition: 'all 0.2s',
  },
  placeholderCard: {
    padding: '40px 28px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '380px',
  },
  placeholderIcon: {
    fontSize: '3rem',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.4))',
  },
  placeholderTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '8px',
  },
  placeholderText: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    lineHeight: '1.5',
    maxWidth: '280px',
    marginBottom: '20px',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textAlign: 'left',
  },
  featureItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.8rem',
    color: '#cbd5e1',
  },
  featureCheck: {
    color: '#10b981',
    fontWeight: '700',
  },
};
