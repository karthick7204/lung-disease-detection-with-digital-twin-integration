'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose, initialRole = 'doctor' }) {
  const { login, registerDoctor, registerPatient } = useAuth();

  const [activeRole, setActiveRole] = useState(initialRole); // 'doctor' | 'patient'
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hospital, setHospital] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [mrn, setMrn] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password, activeRole);
      } else {
        if (activeRole === 'doctor') {
          await registerDoctor({
            name,
            email,
            password,
            hospital,
            licenseNumber,
          });
        } else {
          await registerPatient({
            name,
            email,
            password,
            age: age ? Number(age) : null,
            gender,
            medicalRecordNumber: mrn,
          });
        }
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail, demoPassword, role) => {
    setError(null);
    setLoading(true);
    try {
      await login(demoEmail, demoPassword, role);
      onClose();
    } catch (err) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>
              {mode === 'login' ? 'Sign In to LungTwin AI' : 'Create Account'}
            </h2>
            <p style={styles.subtitle}>
              {activeRole === 'doctor'
                ? '🩺 Clinical Doctor Portal • Full Patient Registry & Upload'
                : '🫁 Patient Portal • View Your Own Pulmonary Digital Twin'}
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div style={styles.roleTabs}>
          <button
            type="button"
            style={{
              ...styles.roleTab,
              ...(activeRole === 'doctor' ? styles.roleTabActiveDoctor : {}),
            }}
            onClick={() => {
              setActiveRole('doctor');
              setError(null);
            }}
          >
            <span style={styles.tabEmoji}>🩺</span> Doctor Access
          </button>
          <button
            type="button"
            style={{
              ...styles.roleTab,
              ...(activeRole === 'patient' ? styles.roleTabActivePatient : {}),
            }}
            onClick={() => {
              setActiveRole('patient');
              setError(null);
            }}
          >
            <span style={styles.tabEmoji}>🫁</span> Patient Access
          </button>
        </div>

        {/* Quick Demo Logins */}
        <div style={styles.demoBox}>
          <div style={styles.demoLabel}>⚡ ONE-CLICK DEMO LOGIN:</div>
          <div style={styles.demoBtnRow}>
            {activeRole === 'doctor' ? (
              <button
                type="button"
                style={styles.demoBtnDoctor}
                onClick={() =>
                  handleQuickLogin(
                    'dr.priya.sharma@lungtwin.ai',
                    'LungTwinDoctor2026!',
                    'doctor'
                  )
                }
                disabled={loading}
              >
                🩺 Dr. Priya Sharma (Doctor)
              </button>
            ) : (
              <>
                <button
                  type="button"
                  style={styles.demoBtnPatient}
                  onClick={() =>
                    handleQuickLogin(
                      'rahul.verma@example.com',
                      'PatientPass2026!',
                      'patient'
                    )
                  }
                  disabled={loading}
                >
                  🫁 Rahul Verma (Patient)
                </button>
                <button
                  type="button"
                  style={styles.demoBtnPatient}
                  onClick={() =>
                    handleQuickLogin(
                      'ananya.iyer@example.com',
                      'PatientPass2026!',
                      'patient'
                    )
                  }
                  disabled={loading}
                >
                  🫁 Ananya Iyer (Patient)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                required
                style={styles.input}
                placeholder={activeRole === 'doctor' ? 'Dr. Rajesh Sharma, MD' : 'Arjun Kumar'}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              required
              style={styles.input}
              placeholder={activeRole === 'doctor' ? 'doctor@hospital.org' : 'patient@email.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Doctor-specific registration fields */}
          {mode === 'register' && activeRole === 'doctor' && (
            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Hospital / Clinic</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="Metropolitan Hospital"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                />
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Medical License #</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="MD-88219"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Patient-specific registration fields */}
          {mode === 'register' && activeRole === 'patient' && (
            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Age</label>
                <input
                  type="number"
                  min="0"
                  max="130"
                  style={styles.input}
                  placeholder="45"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Gender</label>
                <select
                  style={styles.input}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>MRN / Patient ID</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="MRN-10293"
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              background:
                activeRole === 'doctor'
                  ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'
                  : 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
            }}
            disabled={loading}
          >
            {loading
              ? 'Processing...'
              : mode === 'login'
              ? `Sign In as ${activeRole === 'doctor' ? 'Doctor' : 'Patient'}`
              : `Create ${activeRole === 'doctor' ? 'Doctor' : 'Patient'} Account`}
          </button>
        </form>

        {/* Footer switch between login and register */}
        <div style={styles.switchRow}>
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                style={styles.linkBtn}
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                Register here
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                style={styles.linkBtn}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '16px',
    maxWidth: '520px',
    width: '100%',
    padding: '28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    color: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: '#f1f5f9',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '4px',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  roleTabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '16px',
    background: 'rgba(255, 255, 255, 0.04)',
    padding: '4px',
    borderRadius: '10px',
  },
  roleTab: {
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  roleTabActiveDoctor: {
    background: 'rgba(2, 132, 199, 0.2)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.4)',
  },
  roleTabActivePatient: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    border: '1px solid rgba(52, 211, 153, 0.4)',
  },
  tabEmoji: {
    fontSize: '1.1rem',
  },
  demoBox: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px dashed rgba(255, 255, 255, 0.15)',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '18px',
  },
  demoLabel: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  demoBtnRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  demoBtnDoctor: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.4)',
    color: '#7dd3fc',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
  demoBtnPatient: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'rgba(52, 211, 153, 0.15)',
    border: '1px solid rgba(52, 211, 153, 0.4)',
    color: '#a7f3d0',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
  errorBox: {
    background: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid rgba(244, 63, 94, 0.4)',
    color: '#fda4af',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  input: {
    padding: '10px 14px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
  },
  submitBtn: {
    marginTop: '6px',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  switchRow: {
    marginTop: '16px',
    textAlign: 'center',
    fontSize: '0.85rem',
    color: '#94a3b8',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
};

