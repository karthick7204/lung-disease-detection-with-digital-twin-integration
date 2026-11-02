'use client';

import { useAuth } from '../context/AuthContext';

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, isDoctor, isPatient, logout } = useAuth();

  const handleTabClick = (tab) => {
    if (tab === 'doctor' && isPatient) {
      alert('🔒 Access Restricted: The Doctor Upload & Clinical Registry is only accessible to verified medical doctors.');
      return;
    }
    setActiveTab(tab);
  };

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        {/* Brand */}
        <div style={styles.brand} onClick={() => setActiveTab(isPatient ? 'patient' : 'doctor')}>
          <div style={styles.logoIcon}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18" />
              <path d="M8 8c-3 0-5 2-5 5s2 6 5 6c2 0 4-1 4-3" />
              <path d="M16 8c3 0 5 2 5 5s-2 6-5 6c-2 0-4-1-4-3" />
              <path d="M12 9c-1.5-2-3-2.5-4-2.5" />
              <path d="M12 9c1.5-2 3-2.5 4-2.5" />
            </svg>
          </div>
          <div>
            <div style={styles.brandTitle}>
              LungTwin <span style={styles.brandBadge}>AI</span>
            </div>
            <div style={styles.brandSubtitle}>Pulmonary Digital Twin Platform</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <nav style={styles.nav}>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'doctor' ? styles.tabBtnActive : {}),
              ...(isPatient ? styles.tabBtnDisabled : {}),
            }}
            onClick={() => handleTabClick('doctor')}
            title={isPatient ? 'Restricted to Doctors' : 'Doctor Portal & Upload'}
          >
            <span style={styles.tabIcon}>{isPatient ? '🔒' : '🩺'}</span>
            Doctor Portal & Upload
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'patient' ? styles.tabBtnActive : {}),
            }}
            onClick={() => handleTabClick('patient')}
          >
            <span style={styles.tabIcon}>🫁</span>
            {isPatient ? 'My Lung Digital Twin' : 'Patient Digital Twin'}
          </button>
        </nav>

        {/* User Auth & System Status */}
        <div style={styles.rightGroup}>
          {user ? (
            <div style={styles.userCard}>
              <div style={styles.userInfo}>
                <span style={isDoctor ? styles.doctorBadge : styles.patientBadge}>
                  {isDoctor ? '🩺 DOCTOR' : '🫁 PATIENT'}
                </span>
                <span style={styles.userName}>{user.name}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                style={styles.logoutBtn}
                title="Log out of account"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={styles.authActions}>
              <button
                type="button"
                onClick={() => onOpenAuthModal('doctor')}
                style={styles.doctorLoginBtn}
              >
                🩺 Doctor Login
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal('patient')}
                style={styles.patientLoginBtn}
              >
                🫁 Patient Login
              </button>
            </div>
          )}

          {/* System Indicators */}
          <div style={styles.statusGroup}>
            <div style={styles.statusPill}>
              <span style={styles.statusDotGreen}></span>
              ResNet-18 (MPS)
            </div>
            <div style={styles.statusPill}>
              <span style={styles.statusDotCyan}></span>
              JWT Guard
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(7, 11, 19, 0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '12px 24px',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  logoIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.3) 100%)',
    border: '1px solid rgba(6, 182, 212, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#38bdf8',
  },
  brandTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: '-0.02em',
  },
  brandBadge: {
    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: '900',
  },
  brandSubtitle: {
    fontSize: '0.72rem',
    color: '#94a3b8',
    letterSpacing: '0.01em',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(15, 23, 42, 0.8)',
    padding: '4px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 18px',
    borderRadius: '8px',
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(59, 130, 246, 0.22) 100%)',
    color: '#f8fafc',
    border: '1px solid rgba(6, 182, 212, 0.4)',
    boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)',
  },
  tabBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  tabIcon: {
    fontSize: '1rem',
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(30, 41, 59, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '5px 12px',
    borderRadius: '10px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  doctorBadge: {
    fontSize: '0.68rem',
    fontWeight: '800',
    padding: '2px 7px',
    borderRadius: '5px',
    background: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.4)',
  },
  patientBadge: {
    fontSize: '0.68rem',
    fontWeight: '800',
    padding: '2px 7px',
    borderRadius: '5px',
    background: 'rgba(52, 211, 153, 0.2)',
    color: '#34d399',
    border: '1px solid rgba(52, 211, 153, 0.4)',
  },
  logoutBtn: {
    padding: '4px 10px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  authActions: {
    display: 'flex',
    gap: '8px',
  },
  doctorLoginBtn: {
    padding: '6px 14px',
    background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)',
    border: '1px solid rgba(56, 189, 248, 0.5)',
    color: '#38bdf8',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  patientLoginBtn: {
    padding: '6px 14px',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.3) 100%)',
    border: '1px solid rgba(52, 211, 153, 0.5)',
    color: '#34d399',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  statusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '9999px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '0.72rem',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  statusDotGreen: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 6px #10b981',
  },
  statusDotCyan: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#06b6d4',
    boxShadow: '0 0 6px #06b6d4',
  },
};
