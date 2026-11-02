import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { connectDB, closeDB } from '../config/db.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import PatientScan from '../models/PatientScan.js';

dotenv.config();

async function seed() {
  console.log('🌱 Starting LungTwin AI Demo Seed Script...');

  const conn = await connectDB();
  if (!conn) {
    console.error('❌ Could not connect to database. Please check your MONGODB_URI in .env');
    process.exit(1);
  }

  try {
    const secret = process.env.JWT_SECRET || 'lungtwin_dev_jwt_secret_key_change_in_production_2026_secure';

    // 1. Seed Doctor Account
    const doctorEmail = 'doctor.smith@lungtwin.ai';
    const doctorPassword = 'LungTwinDoctor2026!';

    let doctor = await Doctor.findOne({ email: doctorEmail });
    if (!doctor) {
      doctor = await Doctor.create({
        name: 'Dr. Sarah Smith, MD',
        email: doctorEmail,
        password: doctorPassword,
        licenseNumber: 'MD-PULM-88921',
        hospital: 'Metropolitan Pulmonary Center',
        role: 'doctor',
      });
      console.log('✅ Demo Doctor account created: Dr. Sarah Smith');
    } else {
      console.log('ℹ️ Demo Doctor account already exists: Dr. Sarah Smith');
    }

    const doctorToken = jwt.sign(
      {
        id: doctor._id,
        email: doctor.email,
        name: doctor.name,
        role: 'doctor',
      },
      secret,
      { expiresIn: '30d' }
    );

    // 2. Seed Patient Account 1: Robert Fox
    const patient1Email = 'robert.fox@example.com';
    const patient1Password = 'PatientPass2026!';

    let patient1 = await Patient.findOne({ email: patient1Email });
    if (!patient1) {
      patient1 = await Patient.create({
        name: 'Robert Fox',
        email: patient1Email,
        password: patient1Password,
        role: 'patient',
        age: 58,
        gender: 'male',
        medicalRecordNumber: 'MRN-90214',
        phone: '+1-555-019-2831',
      });
      console.log('✅ Demo Patient account created: Robert Fox');
    } else {
      console.log('ℹ️ Demo Patient account already exists: Robert Fox');
    }

    const patient1Token = jwt.sign(
      {
        id: patient1._id,
        email: patient1.email,
        name: patient1.name,
        role: 'patient',
      },
      secret,
      { expiresIn: '30d' }
    );

    // 3. Seed Patient Account 2: Emily Watson
    const patient2Email = 'emily.watson@example.com';
    const patient2Password = 'PatientPass2026!';

    let patient2 = await Patient.findOne({ email: patient2Email });
    if (!patient2) {
      patient2 = await Patient.create({
        name: 'Emily Watson',
        email: patient2Email,
        password: patient2Password,
        role: 'patient',
        age: 42,
        gender: 'female',
        medicalRecordNumber: 'MRN-78102',
        phone: '+1-555-018-9923',
      });
      console.log('✅ Demo Patient account created: Emily Watson');
    } else {
      console.log('ℹ️ Demo Patient account already exists: Emily Watson');
    }

    const patient2Token = jwt.sign(
      {
        id: patient2._id,
        email: patient2.email,
        name: patient2.name,
        role: 'patient',
      },
      secret,
      { expiresIn: '30d' }
    );

    // 4. Link existing scans to patients and doctor
    const updatedFox = await PatientScan.updateMany(
      { patientName: { $regex: /^robert fox$/i } },
      {
        $set: {
          patient: patient1._id,
          patientEmail: patient1.email,
          uploadedBy: doctor._id,
        },
      }
    );
    console.log(`🔗 Linked ${updatedFox.modifiedCount} scans to patient Robert Fox.`);

    const updatedWatson = await PatientScan.updateMany(
      { patientName: { $regex: /^emily watson$/i } },
      {
        $set: {
          patient: patient2._id,
          patientEmail: patient2.email,
          uploadedBy: doctor._id,
        },
      }
    );
    console.log(`🔗 Linked ${updatedWatson.modifiedCount} scans to patient Emily Watson.`);

    console.log('\n====================================================');
    console.log('🩺 DEMO DOCTOR CREDENTIALS:');
    console.log(`Email:    ${doctor.email}`);
    console.log(`Password: ${doctorPassword}`);
    console.log(`Role:     ${doctor.role}`);
    console.log(`Doctor Token: Bearer ${doctorToken}`);
    console.log('----------------------------------------------------');
    console.log('🫁 DEMO PATIENT 1 (Robert Fox) CREDENTIALS:');
    console.log(`Email:    ${patient1.email}`);
    console.log(`Password: ${patient1Password}`);
    console.log(`Role:     ${patient1.role}`);
    console.log(`Patient Token: Bearer ${patient1Token}`);
    console.log('----------------------------------------------------');
    console.log('🫁 DEMO PATIENT 2 (Emily Watson) CREDENTIALS:');
    console.log(`Email:    ${patient2.email}`);
    console.log(`Password: ${patient2Password}`);
    console.log(`Role:     ${patient2.role}`);
    console.log(`Patient Token: Bearer ${patient2Token}`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

seed();
