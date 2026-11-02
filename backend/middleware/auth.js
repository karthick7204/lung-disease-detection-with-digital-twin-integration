import jwt from 'jsonwebtoken';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';

/**
 * Helper to escape regex special characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * JWT Authentication Middleware
 * Verifies Bearer token in the Authorization header.
 * Attaches the authenticated doctor or patient object to req.user.
 */
export async function authenticateToken(req, res, next) {
  // Support token from Authorization header or ?token= query parameter (useful for img tags)
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'lungtwin_dev_jwt_secret_key_change_in_production_2026_secure';
    const decoded = jwt.verify(token, secret);

    let user = null;

    if (decoded.role === 'patient') {
      user = await Patient.findById(decoded.id).select('-password');
    } else if (decoded.role === 'doctor' || decoded.role === 'admin') {
      user = await Doctor.findById(decoded.id).select('-password');
    } else {
      // Fallback: check Doctor first, then Patient
      user = await Doctor.findById(decoded.id).select('-password');
      if (!user) {
        user = await Patient.findById(decoded.id).select('-password');
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account associated with this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
    });
  }
}

/**
 * Optional Authentication Middleware
 * If a Bearer token is present, verifies it and populates req.user.
 * If not present or invalid, proceeds gracefully with req.user = null.
 */
export async function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'lungtwin_dev_jwt_secret_key_change_in_production_2026_secure';
    const decoded = jwt.verify(token, secret);
    let user = null;

    if (decoded.role === 'patient') {
      user = await Patient.findById(decoded.id).select('-password');
    } else {
      user = await Doctor.findById(decoded.id).select('-password');
      if (!user) {
        user = await Patient.findById(decoded.id).select('-password');
      }
    }
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Role-Based Authorization Middleware
 * Ensures the authenticated user possesses the required role (e.g., 'doctor', 'patient', or 'admin').
 *
 * @param  {...string} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required before checking roles.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access requires role: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'`,
      });
    }

    next();
  };
}

/**
 * Helper to construct MongoDB filter based on caller role.
 * - Doctors / Admins see all patients' scans.
 * - Patients can ONLY see their own scans.
 *
 * @param {object} user - req.user object
 * @returns {object} - Mongoose query filter object
 */
export function getPatientAccessFilter(user) {
  if (!user) return { _id: null }; // No access if unauthenticated

  if (user.role === 'doctor' || user.role === 'admin') {
    return {}; // Doctor sees all scans
  }

  // Patient can only see their own scans by ID, email, or name
  const escapedName = escapeRegex(user.name.trim());
  return {
    $or: [
      { patient: user._id },
      { patientEmail: user.email.toLowerCase().trim() },
      { patientName: new RegExp(`^${escapedName}$`, 'i') },
    ],
  };
}

/**
 * Check if a user is permitted to view/manage a specific scan.
 * - Doctor/Admin can access any scan.
 * - Patient can only access if it belongs to them.
 *
 * @param {object} user - req.user
 * @param {object} scan - PatientScan document
 * @returns {boolean}
 */
export function canUserAccessScan(user, scan) {
  if (!user || !scan) return false;
  if (user.role === 'doctor' || user.role === 'admin') return true;

  if (user.role === 'patient') {
    // Check patient ID match
    if (scan.patient && scan.patient.toString() === user._id.toString()) {
      return true;
    }
    // Check patient email match
    if (scan.patientEmail && scan.patientEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) {
      return true;
    }
    // Check patient name match (case-insensitive)
    if (scan.patientName && scan.patientName.toLowerCase().trim() === user.name.toLowerCase().trim()) {
      return true;
    }
  }

  return false;
}
