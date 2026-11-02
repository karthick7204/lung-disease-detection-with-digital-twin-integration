import jwt from 'jsonwebtoken';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';

/**
 * Generate a signed JWT for the authenticated doctor or patient.
 *
 * @param {object} user - Mongoose Doctor or Patient document
 * @param {string} role - 'doctor' | 'patient' | 'admin'
 * @returns {string} - Signed JWT
 */
function generateToken(user, role) {
  const secret = process.env.JWT_SECRET || 'lungtwin_dev_jwt_secret_key_change_in_production_2026_secure';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: role || user.role,
    },
    secret,
    { expiresIn }
  );
}

// -----------------------------------------------------------------------------
// Doctor Authentication
// -----------------------------------------------------------------------------

/**
 * @desc    Register a new Doctor account
 * @route   POST /api/auth/doctor/register (or /api/auth/register)
 * @access  Public
 */
export async function registerDoctor(req, res, next) {
  try {
    const { name, email, password, licenseNumber, hospital } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide full name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingDoctor = await Doctor.findOne({ email: cleanEmail });
    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        error: 'A doctor account with this email address already exists.',
      });
    }

    const doctor = await Doctor.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      licenseNumber: licenseNumber ? licenseNumber.trim() : '',
      hospital: hospital ? hospital.trim() : '',
      role: 'doctor',
    });

    const token = generateToken(doctor, 'doctor');

    return res.status(201).json({
      success: true,
      message: 'Doctor account registered successfully.',
      token,
      user: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        role: 'doctor',
        licenseNumber: doctor.licenseNumber,
        hospital: doctor.hospital,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Authenticate doctor and issue JWT
 * @route   POST /api/auth/doctor/login
 * @access  Public
 */
export async function loginDoctor(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const doctor = await Doctor.findOne({ email: cleanEmail }).select('+password');

    if (!doctor) {
      return res.status(401).json({
        success: false,
        error: 'Invalid doctor email or password.',
      });
    }

    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid doctor email or password.',
      });
    }

    const token = generateToken(doctor, 'doctor');

    return res.status(200).json({
      success: true,
      message: 'Doctor login successful.',
      token,
      user: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        role: 'doctor',
        licenseNumber: doctor.licenseNumber,
        hospital: doctor.hospital,
      },
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// Patient Authentication
// -----------------------------------------------------------------------------

/**
 * @desc    Register a new Patient account
 * @route   POST /api/auth/patient/register
 * @access  Public
 */
export async function registerPatient(req, res, next) {
  try {
    const { name, email, password, age, gender, medicalRecordNumber, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide full name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingPatient = await Patient.findOne({ email: cleanEmail });
    if (existingPatient) {
      return res.status(409).json({
        success: false,
        error: 'A patient account with this email address already exists.',
      });
    }

    let parsedAge = null;
    if (age !== undefined && age !== null && age !== '') {
      parsedAge = Number(age);
      if (Number.isNaN(parsedAge) || parsedAge < 0 || parsedAge > 130) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid age between 0 and 130.',
        });
      }
    }

    const patient = await Patient.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: 'patient',
      age: parsedAge,
      gender: gender ? gender.toLowerCase().trim() : 'unknown',
      medicalRecordNumber: medicalRecordNumber ? medicalRecordNumber.trim() : '',
      phone: phone ? phone.trim() : '',
    });

    const token = generateToken(patient, 'patient');

    return res.status(201).json({
      success: true,
      message: 'Patient account registered successfully.',
      token,
      user: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        role: 'patient',
        age: patient.age,
        gender: patient.gender,
        medicalRecordNumber: patient.medicalRecordNumber,
        phone: patient.phone,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Authenticate patient and issue JWT
 * @route   POST /api/auth/patient/login
 * @access  Public
 */
export async function loginPatient(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const patient = await Patient.findOne({ email: cleanEmail }).select('+password');

    if (!patient) {
      return res.status(401).json({
        success: false,
        error: 'Invalid patient email or password.',
      });
    }

    const isMatch = await patient.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid patient email or password.',
      });
    }

    const token = generateToken(patient, 'patient');

    return res.status(200).json({
      success: true,
      message: 'Patient login successful.',
      token,
      user: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        role: 'patient',
        age: patient.age,
        gender: patient.gender,
        medicalRecordNumber: patient.medicalRecordNumber,
        phone: patient.phone,
      },
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// Unified / Shared Authentication
// -----------------------------------------------------------------------------

/**
 * @desc    Unified Login supporting Doctor or Patient
 * @route   POST /api/auth/login
 * @access  Public
 */
export async function loginUser(req, res, next) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. If role is explicitly specified
    if (role === 'doctor') {
      const doctor = await Doctor.findOne({ email: cleanEmail }).select('+password');
      if (!doctor || !(await doctor.comparePassword(password))) {
        return res.status(401).json({ success: false, error: 'Invalid doctor email or password.' });
      }
      const token = generateToken(doctor, 'doctor');
      return res.status(200).json({
        success: true,
        message: 'Doctor login successful.',
        token,
        user: {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          role: 'doctor',
          hospital: doctor.hospital,
          licenseNumber: doctor.licenseNumber,
        },
      });
    }

    if (role === 'patient') {
      const patient = await Patient.findOne({ email: cleanEmail }).select('+password');
      if (!patient || !(await patient.comparePassword(password))) {
        return res.status(401).json({ success: false, error: 'Invalid patient email or password.' });
      }
      const token = generateToken(patient, 'patient');
      return res.status(200).json({
        success: true,
        message: 'Patient login successful.',
        token,
        user: {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          role: 'patient',
          age: patient.age,
          gender: patient.gender,
          medicalRecordNumber: patient.medicalRecordNumber,
        },
      });
    }

    // 2. Role not specified: try Doctor first, then Patient
    const doctor = await Doctor.findOne({ email: cleanEmail }).select('+password');
    if (doctor && (await doctor.comparePassword(password))) {
      const token = generateToken(doctor, 'doctor');
      return res.status(200).json({
        success: true,
        message: 'Doctor login successful.',
        token,
        user: {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          role: 'doctor',
          hospital: doctor.hospital,
          licenseNumber: doctor.licenseNumber,
        },
      });
    }

    const patient = await Patient.findOne({ email: cleanEmail }).select('+password');
    if (patient && (await patient.comparePassword(password))) {
      const token = generateToken(patient, 'patient');
      return res.status(200).json({
        success: true,
        message: 'Patient login successful.',
        token,
        user: {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          role: 'patient',
          age: patient.age,
          gender: patient.gender,
          medicalRecordNumber: patient.medicalRecordNumber,
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid credentials. User not found.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get currently authenticated user profile (Doctor or Patient)
 * @route   GET /api/auth/me
 * @access  Private (Doctor / Patient / Admin)
 */
export async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
}
