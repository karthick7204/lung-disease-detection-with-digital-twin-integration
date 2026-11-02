'use client';

import { useState, useEffect } from 'react';
import DigitalTwinVisualizer from './DigitalTwinVisualizer';
import { useAuth } from '../context/AuthContext';

export default function PatientSearch({ initialPatientName = '' }) {
  const { user, token, isDoctor, isPatient, login } = useAuth();

  const [searchTerm, setSearchTerm] = useState(initialPatientName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [selectedScanIndex, setSelectedScanIndex] = useState(0);
  const [zoomImage, setZoomImage] = useState(false);
  const [showGradcam, setShowGradcam] = useState(false);

  // If patient is logged in, automatically lock and search their own records
  useEffect(() => {
    if (isPatient && user?.name) {
      setSearchTerm(user.name);
      performSearch(user.name);
    } else if (initialPatientName) {
      setSearchTerm(initialPatientName);
      performSearch(initialPatientName);
    }
  }, [isPatient, user?.name, initialPatientName]);

  const performSearch = async (name) => {
    // If patient, always search user's name
    const query = isPatient && user?.name ? user.name : name.trim();
    if (!query) return;

    setLoading(true);
    setError(null);

    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `/api/patient-scans/digital-twin/search?name=${encodeURIComponent(query)}`,
        { headers }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to search patient digital twin.');
      }

      if (data.count === 0) {
        setPatientData(null);
        setError(`No Digital Twin records found for patient "${query}".`);
      } else {
        // Append token query param to image URLs so protected images render
        if (token && data.timeline) {
          data.timeline = data.timeline.map((item) => ({
            ...item,
            imageUrl: item.imageUrl ? `${item.imageUrl}?token=${token}` : item.imageUrl,
            gradcamUrl: item.gradcamUrl ? `${item.gradcamUrl}?token=${token}` : item.gradcamUrl,
          }));
        }
        setPatientData(data);
        setSelectedScanIndex(0); // Default to newest scan
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'An error occurred while retrieving patient records.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const activeScan = patientData?.timeline?.[selectedScanIndex];

  return (
    <div style={styles.container}>
      {/* Search Header Bar */}
      <div style={styles.searchBox} className="glass-panel">
        {isPatient ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ ...styles.searchIcon, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                🫁
              </div>
              <div>
                <h2 style={styles.searchTitle}>My Pulmonary Digital Twin</h2>
                <p style={styles.searchSubtitle}>
                  Logged in as <strong style={{ color: '#34d399' }}>{user.name}</strong> ({user.email}). Displaying your personal lung diagnostic records and digital twin.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              🔒 HIPAA / Privacy Guard: Only Your Lungs Visible
            </div>
          </div>
        ) : (
          <>
            <div style={styles.searchHeader}>
              <div style={styles.searchIcon}>🔍</div>
              <div>
                <h2 style={styles.searchTitle}>Doctor Patient Digital Twin Lookup</h2>
                <p style={styles.searchSubtitle}>
                  Search by patient name to explore any patient's pulmonary Digital Twin and historical progression.
                </p>
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
              <div style={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Enter patient name (e.g. Robert Fox, Emily Watson)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={styles.clearBtn}
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.searchBtn,
                  ...(loading ? styles.searchBtnLoading : {}),
                }}
              >
                {loading ? 'Searching...' : 'Explore Digital Twin'}
              </button>
            </form>

            {/* Quick Search Chips */}
            <div style={styles.chipRow}>
              <span style={styles.chipLabel}>Demo Patients:</span>
              {['Robert Fox', 'Emily Watson'].map((name) => (
                <button
                  key={name}
                  type="button"
                  style={styles.chip}
                  onClick={() => {
                    setSearchTerm(name);
                    performSearch(name);
                  }}
                >
                  👤 {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={styles.errorCard} className="glass-panel">
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚠️</div>
          <div style={styles.errorTitle}>{error}</div>
          <p style={styles.errorSub}>
            Please verify the spelling or return to the Doctor Portal to upload and create a scan record.
          </p>
        </div>
      )}

      {/* Patient Found View */}
      {patientData && activeScan && (
        <div style={styles.resultsWrapper}>
          {/* Patient Overview Card */}
          <div style={styles.overviewCard} className="glass-panel">
            <div style={styles.overviewLeft}>
              <div style={styles.avatar}>
                {patientData.summary?.patientName?.charAt(0) || 'P'}
              </div>
              <div>
                <div style={styles.patientNameHeader}>{patientData.summary?.patientName}</div>
                <div style={styles.patientMeta}>
                  {patientData.summary?.currentAge ? `${patientData.summary?.currentAge} Years Old` : 'Age N/A'} •{' '}
                  <span style={{ textTransform: 'capitalize' }}>{patientData.summary?.gender || 'Unknown'}</span> •{' '}
                  Total Scans on Record: <strong>{patientData.summary?.totalScans}</strong>
                </div>
              </div>
            </div>

            <div style={styles.overviewRight}>
              {/* Progression Badge */}
              <div style={{
                ...styles.trendBadge,
                ...(patientData.summary?.progressionTrend === 'improving' ? styles.trendImproving : {}),
                ...(patientData.summary?.progressionTrend === 'deteriorating' ? styles.trendDeteriorating : {}),
              }}>
                <span style={styles.trendIcon}>
                  {patientData.summary?.progressionTrend === 'improving' ? '↗' : '➔'}
                </span>
                <span>
                  Progression:{' '}
                  {patientData.summary?.progressionTrend === 'improving'
                    ? 'Infiltrate Clearing (Improving)'
                    : 'Stable Baseline'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Digital Twin Visualizer */}
          <DigitalTwinVisualizer
            digitalTwin={activeScan.digitalTwin}
            prediction={activeScan.prediction}
            patientName={patientData.summary?.patientName}
            scanDate={activeScan.formattedDate}
            imageUrl={activeScan.imageUrl}
          />

          {/* Longitudinal Timeline & Radiograph Inspector Grid */}
          <div style={styles.timelineAndImageGrid}>
            {/* Timeline Column */}
            <div style={styles.timelineCol} className="glass-panel">
              <div style={styles.sectionTitleRow}>
                <div style={styles.sectionTitle}>📅 Digital Twin Scan History</div>
                <div style={styles.scanCountBadge}>
                  {patientData.timeline?.length} {patientData.timeline?.length === 1 ? 'Scan' : 'Scans'}
                </div>
              </div>

              <div style={styles.timelineList}>
                {patientData.timeline?.map((scan, idx) => {
                  const isSelected = idx === selectedScanIndex;
                  const isPneumonia = scan.prediction?.isPneumonia || scan.prediction?.predictedClass === 'PNEUMONIA';

                  return (
                    <div
                      key={scan.id}
                      onClick={() => setSelectedScanIndex(idx)}
                      style={{
                        ...styles.timelineItem,
                        ...(isSelected ? styles.timelineItemSelected : {}),
                      }}
                    >
                      <div style={styles.timelineItemHeader}>
                        <div style={styles.scanOrderTag}>Scan #{scan.scanOrder}</div>
                        <div style={styles.scanDateTag}>{scan.formattedDate}</div>
                      </div>

                      <div style={styles.timelineBadgeRow}>
                        <span
                          style={{
                            ...styles.diagBadge,
                            backgroundColor: isPneumonia ? 'rgba(244, 63, 94, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                            color: isPneumonia ? '#fda4af' : '#6ee7b7',
                            borderColor: isPneumonia ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                          }}
                        >
                          {scan.prediction?.predictedClass}
                        </span>

                        <span style={styles.severityTag}>
                          Severity: <strong>{scan.digitalTwin?.severityIndex}/100</strong>
                        </span>
                      </div>

                      {scan.clinicalNote && (
                        <p style={styles.timelineNote}>"{scan.clinicalNote}"</p>
                      )}

                      {isSelected && (
                        <div style={styles.activePill}>Currently Active in Twin Model</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exact Radiograph Column */}
            <div style={styles.imageCol} className="glass-panel">
              <div style={styles.sectionTitleRow}>
                <div style={styles.sectionTitle}>
                  {showGradcam ? '🔥 Grad-CAM Explainability Heatmap' : '🩻 Stored Chest Radiograph'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    style={{
                      ...styles.zoomBtn,
                      background: showGradcam ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' : 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                    onClick={() => setShowGradcam(!showGradcam)}
                    title="Toggle between original radiograph and Grad-CAM AI attention heatmap"
                  >
                    {showGradcam ? '🩻 Show Original X-Ray' : '🔥 Show Grad-CAM Heatmap'}
                  </button>
                  <button
                    type="button"
                    style={styles.zoomBtn}
                    onClick={() => setZoomImage(!zoomImage)}
                  >
                    {zoomImage ? 'Fit View' : 'Zoom 100%'}
                  </button>
                </div>
              </div>

              <div style={styles.xrayFrame}>
                <img
                  src={showGradcam && activeScan.gradcamUrl ? activeScan.gradcamUrl : activeScan.imageUrl}
                  alt={`Radiograph for ${patientData.summary?.patientName}`}
                  style={{
                    ...styles.xrayImg,
                    transform: zoomImage ? 'scale(1.4)' : 'scale(1)',
                  }}
                />
              </div>

              {showGradcam && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  color: '#fde68a',
                  marginTop: '10px'
                }}>
                  🧠 <strong>Explainable AI Active:</strong> Warm colormap highlights the exact anatomical lobes triggering the model's pulmonary severity score.
                </div>
              )}

              <div style={styles.xrayDetails}>
                <div>
                  <span style={styles.xrayDetailLabel}>Filename:</span>{' '}
                  <span style={styles.xrayDetailVal}>{activeScan.originalImageName}</span>
                </div>
                <div>
                  <span style={styles.xrayDetailLabel}>AI Classification:</span>{' '}
                  <span style={{
                    fontWeight: '700',
                    color: activeScan.prediction?.isPneumonia ? '#f43f5e' : '#10b981',
                  }}>
                    {activeScan.prediction?.predictedClass} ({activeScan.prediction?.confidencePercentage})
                  </span>
                </div>
              </div>
            </div>
          </div>
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
  searchBox: {
    padding: '28px',
    marginBottom: '28px',
  },
  searchHeader: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  searchIcon: {
    fontSize: '1.8rem',
    background: 'rgba(59, 130, 246, 0.15)',
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  searchTitle: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: '-0.02em',
  },
  searchSubtitle: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '4px',
  },
  searchForm: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
    minWidth: '260px',
  },
  searchInput: {
    width: '100%',
    padding: '14px 18px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(15, 23, 42, 0.8)',
    color: '#f8fafc',
    fontSize: '1rem',
    outline: 'none',
  },
  clearBtn: {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '0.9rem',
    padding: '4px',
  },
  searchBtn: {
    padding: '14px 28px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    color: '#070b13',
    fontSize: '0.95rem',
    fontWeight: '700',
    letterSpacing: '0.01em',
    boxShadow: '0 4px 16px rgba(6, 182, 212, 0.25)',
  },
  searchBtnLoading: {
    opacity: 0.7,
    cursor: 'wait',
  },
  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '16px',
    flexWrap: 'wrap',
  },
  chipLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  chip: {
    padding: '5px 12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
  errorCard: {
    padding: '36px',
    textAlign: 'center',
    color: '#fda4af',
  },
  errorTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    marginBottom: '6px',
  },
  errorSub: {
    fontSize: '0.85rem',
    color: '#94a3b8',
  },
  resultsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  overviewCard: {
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  overviewLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  avatar: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    color: '#070b13',
    fontSize: '1.5rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientNameHeader: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: '-0.02em',
  },
  patientMeta: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '2px',
  },
  overviewRight: {
    display: 'flex',
    alignItems: 'center',
  },
  trendBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '9999px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  trendImproving: {
    background: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    color: '#6ee7b7',
  },
  trendDeteriorating: {
    background: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
    color: '#fda4af',
  },
  trendIcon: {
    fontSize: '1.1rem',
    fontWeight: '800',
  },
  timelineAndImageGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.2fr)',
    gap: '24px',
    alignItems: 'start',
  },
  timelineCol: {
    padding: '24px',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  scanCountBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '3px 9px',
    borderRadius: '9999px',
    background: 'rgba(6, 182, 212, 0.15)',
    color: '#06b6d4',
  },
  timelineList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  timelineItem: {
    padding: '16px',
    borderRadius: '12px',
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  timelineItemSelected: {
    background: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.5)',
    boxShadow: '0 4px 16px rgba(6, 182, 212, 0.15)',
  },
  timelineItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  scanOrderTag: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  scanDateTag: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  timelineBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  diagBadge: {
    fontSize: '0.75rem',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid',
  },
  severityTag: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  timelineNote: {
    fontSize: '0.8rem',
    color: '#cbd5e1',
    fontStyle: 'italic',
    lineHeight: '1.4',
    marginBottom: '8px',
  },
  activePill: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#06b6d4',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  imageCol: {
    padding: '24px',
  },
  zoomBtn: {
    padding: '5px 12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#cbd5e1',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  xrayFrame: {
    width: '100%',
    height: '420px',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  xrayImg: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    transition: 'transform 0.3s ease',
  },
  xrayDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
    fontSize: '0.8rem',
    color: '#cbd5e1',
    flexWrap: 'wrap',
    gap: '8px',
  },
  xrayDetailLabel: {
    color: '#94a3b8',
  },
  xrayDetailVal: {
    color: '#f8fafc',
    fontWeight: '600',
  },
};
