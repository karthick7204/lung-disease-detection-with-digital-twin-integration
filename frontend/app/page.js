'use client';

import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import DoctorUpload from '../components/DoctorUpload';
import PatientSearch from '../components/PatientSearch';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, isDoctor, isPatient } = useAuth();

  const [activeTab, setActiveTab] = useState('doctor');
  const [selectedPatientName, setSelectedPatientName] = useState('Robert Fox');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalRole, setAuthModalRole] = useState('doctor');

  // If a patient logs in, automatically switch active tab to patient view
  useEffect(() => {
    if (isPatient) {
      setActiveTab('patient');
      if (user?.name) {
        setSelectedPatientName(user.name);
      }
    }
  }, [isPatient, user?.name]);

  const handleScanCreated = (scanData) => {
    if (scanData?.patientName) {
      setSelectedPatientName(scanData.patientName);
    }
  };

  const handleSwitchToPatient = (patientName) => {
    if (patientName) {
      setSelectedPatientName(patientName);
    }
    setActiveTab('patient');
  };

  const handleOpenAuthModal = (role = 'doctor') => {
    setAuthModalRole(role);
    setAuthModalOpen(true);
  };

  return (
    <div style={styles.page}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={handleOpenAuthModal}
      />

      <main style={styles.main}>
        {activeTab === 'doctor' && !isPatient ? (
          <DoctorUpload
            onScanCreated={handleScanCreated}
            onSwitchToPatient={handleSwitchToPatient}
          />
        ) : (
          <PatientSearch initialPatientName={selectedPatientName} />
        )}
      </main>

      {/* Auth Modal for Doctor / Patient Sign In & Register */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole={authModalRole}
      />

      {/* Footer & Educational Research Disclaimer */}
      <footer style={styles.footer}>
        <div style={styles.footerContainer}>
          <div style={styles.disclaimer}>
            <span style={styles.disclaimerBadge}>RESEARCH PROTOTYPE</span>
            <p style={styles.disclaimerText}>
              <strong>DISCLAIMER:</strong> LungTwin AI is an educational and research prototype built for deep learning benchmarking and visualization. It is <strong>NOT</strong> a certified medical diagnostic device and must not be used for clinical decision-making or patient treatment.
            </p>
          </div>
          <div style={styles.footerMeta}>
            Powered by PyTorch ResNet-18 (ImageNet Weights) • Apple Silicon MPS Acceleration • MongoDB Atlas • JWT Dual-Role Guard
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
  },
  main: {
    flex: 1,
  },
  footer: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(7, 11, 19, 0.95)',
    padding: '24px',
    marginTop: '40px',
  },
  footerContainer: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
    textAlign: 'center',
  },
  disclaimer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '900px',
  },
  disclaimerBadge: {
    fontSize: '0.7rem',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '6px',
    background: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid rgba(244, 63, 94, 0.3)',
    color: '#fda4af',
    letterSpacing: '0.05em',
  },
  disclaimerText: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    lineHeight: '1.5',
    margin: 0,
  },
  footerMeta: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
};
