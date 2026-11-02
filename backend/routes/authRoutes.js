import express from 'express';
import {
  registerDoctor,
  loginDoctor,
  registerPatient,
  loginPatient,
  loginUser,
  getMe,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// -----------------------------------------------------------------------------
// Unified Auth Endpoints
// -----------------------------------------------------------------------------
// POST /api/auth/login - Unified login (Doctor or Patient)
router.post('/login', loginUser);

// GET /api/auth/me - Retrieve current logged-in user profile (Doctor or Patient)
router.get('/me', authenticateToken, getMe);

// -----------------------------------------------------------------------------
// Doctor Specific Endpoints
// -----------------------------------------------------------------------------
// POST /api/auth/doctor/register
router.post('/doctor/register', registerDoctor);
// POST /api/auth/doctor/login
router.post('/doctor/login', loginDoctor);

// Backward compatibility: POST /api/auth/register defaults to doctor registration
router.post('/register', registerDoctor);

// -----------------------------------------------------------------------------
// Patient Specific Endpoints
// -----------------------------------------------------------------------------
// POST /api/auth/patient/register
router.post('/patient/register', registerPatient);
// POST /api/auth/patient/login
router.post('/patient/login', loginPatient);

export default router;
