import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.TEST_URL || 'http://localhost:5001';

async function runAuthRoleTests() {
  console.log('🧪 ==============================================================');
  console.log('🧪 LungTwin AI: Doctor vs Patient JWT & Data Isolation Test Suite');
  console.log(`🧪 Target URL: ${BASE_URL}`);
  console.log('🧪 ==============================================================\n');

  let doctorToken = null;
  let patientToken = null;
  let otherPatientToken = null;

  // 1. Doctor Login
  try {
    process.stdout.write('1. Logging in as Doctor (Dr. Priya Sharma)... ');
    let res = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dr.priya.sharma@lungtwin.ai',
        password: 'LungTwinDoctor2026!',
      }),
    });
    let data = await res.json();
    if (res.status !== 200) {
      // Fallback to legacy email if not re-seeded
      res = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'doctor.smith@lungtwin.ai',
          password: 'LungTwinDoctor2026!',
        }),
      });
      data = await res.json();
    }
    if (res.status === 200 && data.token && data.user?.role === 'doctor') {
      doctorToken = data.token;
      console.log(`✅ PASSED (Role: ${data.user.role}, Name: ${data.user.name})`);
    } else {
      console.log('❌ FAILED:', res.status, data);
      return;
    }
  } catch (err) {
    console.log('❌ FAILED: Server not running at', BASE_URL, '-', err.message);
    return;
  }

  // 2. Patient 1 Login (Rahul Verma)
  try {
    process.stdout.write('2. Logging in as Patient (Rahul Verma)... ');
    let res = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rahul.verma@example.com',
        password: 'PatientPass2026!',
      }),
    });
    let data = await res.json();
    if (res.status !== 200) {
      res = await fetch(`${BASE_URL}/api/auth/patient/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'robert.fox@example.com',
          password: 'PatientPass2026!',
        }),
      });
      data = await res.json();
    }
    if (res.status === 200 && data.token && data.user?.role === 'patient') {
      patientToken = data.token;
      console.log(`✅ PASSED (Role: ${data.user.role}, Name: ${data.user.name})`);
    } else {
      console.log('❌ FAILED:', res.status, data);
      return;
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    return;
  }

  // 3. Patient 2 Login (Ananya Iyer)
  try {
    process.stdout.write('3. Logging in as Second Patient (Ananya Iyer)... ');
    let res = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ananya.iyer@example.com',
        password: 'PatientPass2026!',
      }),
    });
    let data = await res.json();
    if (res.status !== 200) {
      res = await fetch(`${BASE_URL}/api/auth/patient/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'emily.watson@example.com',
          password: 'PatientPass2026!',
        }),
      });
      data = await res.json();
    }
    if (res.status === 200 && data.token && data.user?.role === 'patient') {
      otherPatientToken = data.token;
      console.log(`✅ PASSED (Role: ${data.user.role}, Name: ${data.user.name})`);
    } else {
      console.log('❌ FAILED:', res.status, data);
      return;
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    return;
  }

  // 4. Verify Doctor can see ALL patient scans
  let allScans = [];
  try {
    process.stdout.write('4. Verifying Doctor can view ALL patient scans (GET /api/patient-scans)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.success && Array.isArray(data.data)) {
      allScans = data.data;
      console.log(`✅ PASSED (Doctor sees total ${data.pagination.total} scans across all patients)`);
    } else {
      console.log('❌ FAILED:', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 5. Verify Patient can ONLY see their own scans
  try {
    process.stdout.write('5. Verifying Patient (Rahul Verma) ONLY sees his own scans... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      const foreignScans = data.data.filter(
        (s) => !['rahul verma', 'robert fox'].includes(s.patientName?.toLowerCase())
      );
      if (foreignScans.length === 0) {
        console.log(`✅ PASSED (Received ${data.data.length} scans, 0 other patients' scans leaked)`);
      } else {
        console.log(`❌ FAILED: Leaked ${foreignScans.length} scans of other patients!`);
      }
    } else {
      console.log('❌ FAILED:', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 6. Verify Patient cannot upload scans (Only Doctor can upload)
  try {
    process.stdout.write('6. Verifying Patient CANNOT upload scans (Expect 403 Forbidden)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const data = await res.json();
    if (res.status === 403) {
      console.log(`✅ PASSED (Blocked with 403: ${data.error})`);
    } else {
      console.log('❌ FAILED (Expected 403):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 7. Verify Patient cannot delete scans (Only Doctor can delete)
  if (allScans.length > 0) {
    try {
      process.stdout.write('7. Verifying Patient CANNOT delete scans (Expect 403 Forbidden)... ');
      const res = await fetch(`${BASE_URL}/api/patient-scans/${allScans[0]._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      const data = await res.json();
      if (res.status === 403) {
        console.log(`✅ PASSED (Blocked with 403: ${data.error})`);
      } else {
        console.log('❌ FAILED (Expected 403):', res.status, data);
      }
    } catch (err) {
      console.log('❌ FAILED:', err.message);
    }
  }

  // 8. Verify Patient retrieving his own digital twin
  try {
    process.stdout.write('8. Testing Patient Digital Twin retrieval (/api/patient-scans/digital-twin/my-twin)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans/digital-twin/my-twin`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log(`✅ PASSED (Retrieved Digital Twin for: ${data.patientName})`);
    } else {
      console.log('❌ FAILED:', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 9. Verify Patient cannot access other patient digital twin by searching
  try {
    process.stdout.write('9. Verifying Patient search isolation (Rahul queries ?name=Ananya Iyer)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans/digital-twin/search?name=Ananya%20Iyer`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const data = await res.json();
    // Server must force patient's identity (Rahul Verma or Robert Fox), not return Ananya Iyer
    if (res.status === 200 && ['rahul verma', 'robert fox'].includes(data.patientName?.toLowerCase())) {
      console.log(`✅ PASSED (Search was safely forced to ${data.patientName}, Ananya's data NOT exposed)`);
    } else if (res.status === 403) {
      console.log(`✅ PASSED (Blocked with 403 Forbidden)`);
    } else {
      console.log('❌ FAILED:', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 10. Verify Unauthenticated request is rejected
  try {
    process.stdout.write('10. Verifying Request Without JWT is rejected (Expect 401)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans`);
    const data = await res.json();
    if (res.status === 401) {
      console.log(`✅ PASSED (Properly rejected with 401: ${data.error})`);
    } else {
      console.log('❌ FAILED (Expected 401):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  console.log('\n🎉 ALL DOCTOR & PATIENT AUTHENTICATION & PERMISSION TESTS COMPLETED!\n');
}

runAuthRoleTests();

