import express from 'express';
import {
  uploadPatientScan,
  getPatientScans,
  getPatientScanById,
  getPatientScanImage,
  getPatientScanGradcam,
  deletePatientScan,
  searchPatientDigitalTwin,
  getMyDigitalTwin,
} from '../controllers/patientScanController.js';
import { uploadSingleImage } from '../middleware/upload.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// 1. Digital Twin Routes
// ---------------------------------------------------------------------------

// GET /api/patient-scans/digital-twin/my-twin
// Authenticated Patient retrieves their own Digital Twin directly
router.get(
  '/digital-twin/my-twin',
  authenticateToken,
  requireRole('patient'),
  getMyDigitalTwin
);

// GET /api/patient-scans/digital-twin/search?name=<patientName>
// Doctor can search any patient; Patient can only access their own digital twin
router.get(
  '/digital-twin/search',
  authenticateToken,
  searchPatientDigitalTwin
);

// ---------------------------------------------------------------------------
// 2. Scan Image Streaming
// ---------------------------------------------------------------------------

// GET /api/patient-scans/:id/image
// Stream chest X-ray image (verified for Doctor, or matching Patient owner)
router.get('/:id/image', authenticateToken, getPatientScanImage);

// GET /api/patient-scans/:id/gradcam
// Stream Grad-CAM explainability heatmap overlay image
router.get('/:id/gradcam', authenticateToken, getPatientScanGradcam);

// ---------------------------------------------------------------------------
// 3. Doctor Scan Upload & Analysis Route
// ---------------------------------------------------------------------------

// POST /api/patient-scans
// Doctor uploads chest X-ray, runs AI inference, saves record linked to patient
router.post(
  '/',
  authenticateToken,
  requireRole('doctor', 'admin'),
  uploadSingleImage,
  uploadPatientScan
);

// ---------------------------------------------------------------------------
// 4. Clinical & Management Routes
// ---------------------------------------------------------------------------

// GET /api/patient-scans - Paginated scan list (Doctor sees all, Patient sees only theirs)
router.get('/', authenticateToken, getPatientScans);

// GET /api/patient-scans/:id - Single scan record (Doctor sees any, Patient sees only theirs)
router.get('/:id', authenticateToken, getPatientScanById);

// DELETE /api/patient-scans/:id - Delete record (Requires Doctor / Admin role)
router.delete(
  '/:id',
  authenticateToken,
  requireRole('doctor', 'admin'),
  deletePatientScan
);

export default router;
