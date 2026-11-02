'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore token and user profile on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('lungtwin_token');
      const storedUser = localStorage.getItem('lungtwin_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Verify token with backend
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error('Token invalid or expired');
          })
          .then((data) => {
            if (data?.user) {
              setUser(data.user);
              localStorage.setItem('lungtwin_user', JSON.stringify(data.user));
            }
          })
          .catch(() => {
            // Token expired or invalid
            logout();
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const saveSession = useCallback((tokenData, userData) => {
    setToken(tokenData);
    setUser(userData);
    try {
      localStorage.setItem('lungtwin_token', tokenData);
      localStorage.setItem('lungtwin_user', JSON.stringify(userData));
    } catch (e) {
      console.warn('Could not persist to localStorage:', e);
    }
  }, []);

  const login = async (email, password, role) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed. Please check your credentials.');
    }

    saveSession(data.token, data.user);
    return data;
  };

  const registerDoctor = async ({ name, email, password, licenseNumber, hospital }) => {
    const res = await fetch('/api/auth/doctor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, licenseNumber, hospital }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Doctor registration failed.');
    }

    saveSession(data.token, data.user);
    return data;
  };

  const registerPatient = async ({ name, email, password, age, gender, medicalRecordNumber, phone }) => {
    const res = await fetch('/api/auth/patient/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, age, gender, medicalRecordNumber, phone }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Patient registration failed.');
    }

    saveSession(data.token, data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem('lungtwin_token');
      localStorage.removeItem('lungtwin_user');
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }
  };

  const isDoctor = user?.role === 'doctor' || user?.role === 'admin';
  const isPatient = user?.role === 'patient';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        loading,
        isDoctor,
        isPatient,
        login,
        registerDoctor,
        registerPatient,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

