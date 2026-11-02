import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import PatientScan from '../models/PatientScan.js';
import Patient from '../models/Patient.js';
import {
  validateImageContent,
  isSafePath,
  deleteFileIfExists,
} from '../utils/fileValidator.js';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { runInference } from '../utils/aiPredictor.js';
import { getPatientAccessFilter, canUserAccessScan } from '../middleware/auth.js';

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @desc    Upload patient chest X-ray, trigger AI prediction, and generate Digital Twin record
 * @route   POST /api/patient-scans
 * @access  Private (Doctor / Admin)
 */
export async function uploadPatientScan(req, res, next) {
  // 1. Verify file was provided by Multer
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Please upload a chest X-ray image file (field name: "image").',
    });
  }

  const uploadedFilePath = req.file.path;

  try {
    // 2. Validate patient metadata fields
    const { patientName, patientEmail, age, gender, clinicalNote } = req.body;

    if (!patientName || typeof patientName !== 'string' || !patientName.trim()) {
      await deleteFileIfExists(uploadedFilePath);
      return res.status(400).json({
        success: false,
        error: 'Patient name is required and cannot be empty.',
      });
    }

    // 3. Inspect binary magic numbers of the uploaded file
    const contentCheck = await validateImageContent(uploadedFilePath);
    if (!contentCheck.valid) {
      await deleteFileIfExists(uploadedFilePath);
      return res.status(400).json({
        success: false,
        error: contentCheck.error,
        isDicom: Boolean(contentCheck.isDicom),
      });
    }

    // 4. Validate and parse optional age field
    let validatedAge = null;
    if (age !== undefined && age !== null && age !== '') {
      const numAge = Number(age);
      if (Number.isNaN(numAge) || numAge < 0 || numAge > 130) {
        await deleteFileIfExists(uploadedFilePath);
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid age between 0 and 130.',
        });
      }
      validatedAge = numAge;
    }

    // 5. Normalize gender if provided
    let normalizedGender = 'unknown';
    if (gender && typeof gender === 'string') {
      const cleanGender = gender.trim().toLowerCase();
      const validGenders = ['male', 'female', 'other', 'unknown'];
      if (validGenders.includes(cleanGender)) {
        normalizedGender = cleanGender;
      }
    }

    // 6. Check if registered Patient exists by email or name to link scan
    let linkedPatient = null;
    if (patientEmail && typeof patientEmail === 'string') {
      linkedPatient = await Patient.findOne({ email: patientEmail.toLowerCase().trim() });
    }
    if (!linkedPatient) {
      linkedPatient = await Patient.findOne({
        name: new RegExp(`^${escapeRegex(patientName.trim())}$`, 'i'),
      });
    }

    // 7. Run AI Deep Learning Prediction & Digital Twin Generation
    console.log(`🧠 Triggering ResNet-18 prediction on uploaded scan: ${req.file.filename}`);
    let aiResult;
    try {
      aiResult = await runInference(uploadedFilePath, validatedAge);
      console.log(`✅ AI Prediction: ${aiResult.prediction.predictedClass} (${aiResult.prediction.confidencePercentage})`);
    } catch (aiErr) {
      console.error('⚠️ AI inference failed:', aiErr.message);
      aiResult = {
        prediction: {
          predictedClass: 'ERROR',
          confidence: 0,
          confidencePercentage: '0%',
          probabilities: { normal: 0, pneumonia: 0 },
          isPneumonia: false,
          analyzedAt: new Date(),
        },
        digitalTwin: {
          twinStatus: 'Analysis Error',
          severityIndex: 0,
          lungCondition: `AI analysis could not complete: ${aiErr.message}`,
          affectedLobes: [],
          aerationScores: { overall: 50, leftLung: 50, rightLung: 50 },
          recommendations: ['Retry AI analysis or consult radiologist.'],
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // 8. Create and persist PatientScan record with Digital Twin state
    const patientScan = new PatientScan({
      patientName: patientName.trim(),
      patient: linkedPatient ? linkedPatient._id : null,
      patientEmail: linkedPatient
        ? linkedPatient.email
        : (patientEmail ? patientEmail.toLowerCase().trim() : ''),
      age: validatedAge !== null ? validatedAge : (linkedPatient ? linkedPatient.age : null),
      gender: normalizedGender !== 'unknown' ? normalizedGender : (linkedPatient ? linkedPatient.gender : 'unknown'),
      clinicalNote: clinicalNote && typeof clinicalNote === 'string' ? clinicalNote.trim() : '',
      imageFilename: req.file.filename,
      imagePath: path.relative(process.cwd(), uploadedFilePath),
      originalImageName: req.file.originalname,
      mimeType: contentCheck.detectedType || req.file.mimetype,
      fileSize: req.file.size,
      uploadedAt: new Date(),
      status: 'analyzed',
      uploadedBy: req.user ? req.user._id : null,
      prediction: aiResult.prediction,
      digitalTwin: aiResult.digitalTwin,
    });

    const savedRecord = await patientScan.save();

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const responsePayload = {
      ...savedRecord.toJSON(),
      imageUrl: `${baseUrl}/api/patient-scans/${savedRecord._id}/image`,
    };

    return res.status(201).json({
      success: true,
      message: 'Chest X-ray uploaded and Digital Twin state generated successfully.',
      data: responsePayload,
    });
  } catch (error) {
    // Clean up orphaned file on any failure
    await deleteFileIfExists(uploadedFilePath);
    next(error);
  }
}

/**
 * @desc    Get paginated list of patient scan records (Doctor sees all, Patient sees only theirs)
 * @route   GET /api/patient-scans
 * @access  Private (Doctor / Patient / Admin)
 */
export async function getPatientScans(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // Build base filter based on role permissions
    let filter = getPatientAccessFilter(req.user);

    // Optional search filter by patient name (for doctors, or within self for patient)
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      if (req.user && req.user.role === 'patient') {
        filter = { $and: [filter, { patientName: searchRegex }] };
      } else {
        filter.patientName = searchRegex;
      }
    }

    // Total count for pagination metadata
    const totalRecords = await PatientScan.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Fetch records sorted newest first
    const scans = await PatientScan.find(filter)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploadedBy', 'name email hospital');

    return res.status(200).json({
      success: true,
      count: scans.length,
      pagination: {
        total: totalRecords,
        page,
        totalPages,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: scans,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get details of a single patient scan by ID (Doctor sees any, Patient sees only theirs)
 * @route   GET /api/patient-scans/:id
 * @access  Private (Doctor / Patient / Admin)
 */
export async function getPatientScanById(req, res, next) {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid patient scan ID format: '${id}'`,
      });
    }

    const scan = await PatientScan.findById(id).populate(
      'uploadedBy',
      'name email hospital'
    );

    if (!scan) {
      return res.status(404).json({
        success: false,
        error: `Patient scan record with ID '${id}' not found.`,
      });
    }

    // Check ownership / permission
    if (!canUserAccessScan(req.user, scan)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are only authorized to view your own lung scans.',
      });
    }

    return res.status(200).json({
      success: true,
      data: scan,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Securely retrieve the chest X-ray image (Doctor sees any, Patient sees only theirs)
 * @route   GET /api/patient-scans/:id/image
 * @access  Private (Doctor / Patient / Admin)
 */
export async function getPatientScanImage(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid patient scan ID format: '${id}'`,
      });
    }

    const scan = await PatientScan.findById(id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        error: `Patient scan record with ID '${id}' not found.`,
      });
    }

    // Check ownership / permission
    if (!canUserAccessScan(req.user, scan)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to view this chest X-ray image.',
      });
    }

    // Resolve absolute path and guard against Directory Traversal
    const filePath = path.resolve(UPLOAD_DIR, scan.imageFilename);

    if (!isSafePath(UPLOAD_DIR, filePath)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Path traversal or unauthorized file path access detected.',
      });
    }

    // Verify file exists on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'The chest X-ray image file is missing from local storage.',
      });
    }

    // Set secure content headers
    res.setHeader('Content-Type', scan.mimeType || 'image/png');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(scan.originalImageName)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Stream file to client
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Retrieve the Grad-CAM explainability heatmap overlay for an authorized patient record
 * @route   GET /api/patient-scans/:id/gradcam
 * @access  Private (Doctor / Patient / Admin)
 */
export async function getPatientScanGradcam(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid patient scan ID format: '${id}'`,
      });
    }

    const scan = await PatientScan.findById(id);
    if (!scan) {
      return res.status(404).json({
        success: false,
        error: `Patient scan record with ID '${id}' not found.`,
      });
    }

    if (!canUserAccessScan(req.user, scan)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to view this explainability heatmap.',
      });
    }

    const gradcamFilename = scan.digitalTwin?.gradcamFilename;
    const targetFilename = gradcamFilename || scan.imageFilename;
    const filePath = path.resolve(UPLOAD_DIR, targetFilename);

    if (!isSafePath(UPLOAD_DIR, filePath) || !fs.existsSync(filePath)) {
      const fallbackPath = path.resolve(UPLOAD_DIR, scan.imageFilename);
      if (fs.existsSync(fallbackPath)) {
        res.setHeader('Content-Type', scan.mimeType || 'image/jpeg');
        return res.sendFile(fallbackPath);
      }
      return res.status(404).json({
        success: false,
        error: 'The explainability heatmap file is missing from local storage.',
      });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="gradcam-${encodeURIComponent(scan.originalImageName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Delete a patient scan record and its associated image file
 * @route   DELETE /api/patient-scans/:id
 * @access  Private (Doctor / Admin only)
 */
export async function deletePatientScan(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid patient scan ID format: '${id}'`,
      });
    }

    const scan = await PatientScan.findById(id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        error: `Patient scan record with ID '${id}' not found.`,
      });
    }

    // Delete image file from storage if it exists
    const filePath = path.resolve(UPLOAD_DIR, scan.imageFilename);
    if (isSafePath(UPLOAD_DIR, filePath)) {
      await deleteFileIfExists(filePath);
    }

    // Delete database record
    await scan.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Patient scan record and associated chest X-ray image deleted successfully.',
      deletedId: id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to build Digital Twin summary and timeline
 */
function buildDigitalTwinResponse(scans, patientName, req) {
  if (!scans || scans.length === 0) {
    return {
      success: true,
      count: 0,
      patientName,
      summary: null,
      timeline: [],
      message: `No Digital Twin records found for patient '${patientName}'.`,
    };
  }

  const latestScan = scans[0];
  const oldestScan = scans[scans.length - 1];

  let progressionTrend = 'baseline';
  if (scans.length >= 2) {
    const prevScan = scans[1];
    const prevSev = prevScan.digitalTwin?.severityIndex ?? 50;
    const curSev = latestScan.digitalTwin?.severityIndex ?? 50;
    if (curSev < prevSev - 10) {
      progressionTrend = 'improving';
    } else if (curSev > prevSev + 10) {
      progressionTrend = 'deteriorating';
    } else {
      progressionTrend = 'stable';
    }
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const timeline = scans.map((scan, index) => {
    const scanId = scan._id.toString();
    return {
      id: scanId,
      scanOrder: scans.length - index,
      uploadedAt: scan.uploadedAt,
      formattedDate: new Date(scan.uploadedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      ageAtScan: scan.age,
      gender: scan.gender,
      clinicalNote: scan.clinicalNote || '',
      imageUrl: `${baseUrl}/api/patient-scans/${scanId}/image`,
      gradcamUrl: `${baseUrl}/api/patient-scans/${scanId}/gradcam`,
      originalImageName: scan.originalImageName,
      prediction: scan.prediction || {
        predictedClass: 'UNKNOWN',
        confidence: 0,
        confidencePercentage: '0%',
        isPneumonia: false,
      },
      digitalTwin: scan.digitalTwin || {
        twinStatus: 'Unknown',
        severityIndex: 0,
        lungCondition: '',
        affectedLobes: [],
        aerationScores: { overall: 100, leftLung: 100, rightLung: 100 },
        recommendations: [],
      },
    };
  });

  const summary = {
    patientName: latestScan.patientName,
    currentAge: latestScan.age,
    gender: latestScan.gender,
    totalScans: scans.length,
    currentCondition: latestScan.digitalTwin?.twinStatus || 'Unknown',
    currentSeverityIndex: latestScan.digitalTwin?.severityIndex || 0,
    predictedClass: latestScan.prediction?.predictedClass || 'UNKNOWN',
    confidencePercentage: latestScan.prediction?.confidencePercentage || '0%',
    aerationScores: latestScan.digitalTwin?.aerationScores || { overall: 100, leftLung: 100, rightLung: 100 },
    firstScanDate: oldestScan.uploadedAt,
    latestScanDate: latestScan.uploadedAt,
    progressionTrend,
    latestImageUrl: `${baseUrl}/api/patient-scans/${latestScan._id}/image`,
    latestGradcamUrl: `${baseUrl}/api/patient-scans/${latestScan._id}/gradcam`,
    modelArchitecture: latestScan.digitalTwin?.modelArchitecture || 'Attentive-LungNet (ResNet-18 + CBAM + Grad-CAM)',
  };

  return {
    success: true,
    count: scans.length,
    patientName: latestScan.patientName,
    summary,
    timeline,
  };
}

/**
 * @desc    Search patient by name and retrieve Digital Twin history & timeline
 *          (Doctor can search any patient; Patient can ONLY see their own twin)
 * @route   GET /api/patient-scans/digital-twin/search?name=<patientName>
 * @access  Private (Doctor / Patient / Admin)
 */
export async function searchPatientDigitalTwin(req, res, next) {
  try {
    let targetName = req.query.name;

    // If caller is a patient, strictly enforce searching ONLY their own records!
    if (req.user && req.user.role === 'patient') {
      targetName = req.user.name;
    }

    if (!targetName || typeof targetName !== 'string' || !targetName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a patient name to search.',
      });
    }

    const trimmedName = targetName.trim();
    const escapedName = escapeRegex(trimmedName);
    const exactRegex = new RegExp(`^${escapedName}$`, 'i');

    // Build filter based on role
    let baseFilter;
    if (req.user && req.user.role === 'patient') {
      baseFilter = getPatientAccessFilter(req.user);
    } else {
      baseFilter = { patientName: exactRegex };
    }

    // Find all scans for this patient, sorted newest first
    let scans = await PatientScan.find(baseFilter)
      .sort({ uploadedAt: -1 })
      .lean();

    // If doctor searched and no exact match, fallback to partial search
    if (scans.length === 0 && (!req.user || req.user.role !== 'patient')) {
      const partialRegex = new RegExp(escapedName, 'i');
      scans = await PatientScan.find({ patientName: partialRegex })
        .sort({ uploadedAt: -1 })
        .lean();
    }

    const response = buildDigitalTwinResponse(scans, trimmedName, req);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get currently logged-in patient's own pulmonary Digital Twin
 * @route   GET /api/patient-scans/digital-twin/my-twin
 * @access  Private (Patient only)
 */
export async function getMyDigitalTwin(req, res, next) {
  try {
    const filter = getPatientAccessFilter(req.user);

    const scans = await PatientScan.find(filter)
      .sort({ uploadedAt: -1 })
      .lean();

    const response = buildDigitalTwinResponse(scans, req.user.name, req);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
