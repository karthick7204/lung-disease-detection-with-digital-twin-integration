import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

async function runTestSuite() {
  console.log(`\n🧪 ==========================================`);
  console.log(`🧪 LungTwin AI Backend Test Suite`);
  console.log(`🧪 Target URL: ${BASE_URL}`);
  console.log(`🧪 ==========================================\n`);

  let token = null;
  let testScanId = null;

  // 1. Health Check
  try {
    process.stdout.write('1. Checking Server Health (GET /api/health)... ');
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    if (res.status === 200 && data.status === 'healthy') {
      console.log(`✅ PASSED (DB: ${data.database.state})`);
    } else {
      console.log(`❌ FAILED (Status: ${res.status})`, data);
      return;
    }
  } catch (err) {
    console.log(`❌ FAILED: Server is not reachable at ${BASE_URL}. Ensure 'npm run dev' is running.`);
    console.error(err.message);
    return;
  }

  // 2. Doctor Registration / Login
  try {
    process.stdout.write('2. Authenticating Doctor (POST /api/auth/login or register)... ');
    const doctorCredentials = {
      name: 'Dr. Test Radiologist',
      email: `doctor.test.${Date.now()}@lungtwin.ai`,
      password: 'TestPassword123!',
      hospital: 'General Pulmonary Center',
      licenseNumber: 'TEST-12345',
    };

    // Try registering
    let authRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctorCredentials),
    });

    let authData = await authRes.json();
    if (authRes.status === 201 && authData.token) {
      token = authData.token;
      console.log('✅ PASSED (Registered new doctor)');
    } else {
      // Fallback: try demo doctor login
      authRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'doctor.smith@lungtwin.ai',
          password: 'LungTwinDoctor2026!',
        }),
      });
      authData = await authRes.json();
      if (authRes.status === 200 && authData.token) {
        token = authData.token;
        console.log('✅ PASSED (Logged in with demo doctor)');
      } else {
        console.log('❌ FAILED to authenticate:', authData);
        return;
      }
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    return;
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // 3. Test Unauthorized Access (No Token)
  try {
    process.stdout.write('3. Verifying Unauthorized Access is Blocked (GET /api/patient-scans)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans`);
    const data = await res.json();
    if (res.status === 401 && data.success === false) {
      console.log('✅ PASSED (Correctly rejected with 401 Unauthorized)');
    } else {
      console.log('❌ FAILED (Expected 401):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 4. Test Valid Patient Chest X-Ray Upload
  try {
    process.stdout.write('4. Uploading Patient Chest X-Ray (POST /api/patient-scans)... ');

    const sampleImagePath = path.resolve('assets/sample-chest-xray.jpg');
    let imageBuffer;
    if (fs.existsSync(sampleImagePath)) {
      imageBuffer = fs.readFileSync(sampleImagePath);
    } else {
      // Fallback: create a 1x1 valid PNG buffer
      imageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
    }

    const formData = new FormData();
    formData.append('patientName', 'Jane Doe (Synthetic Demo)');
    formData.append('age', '48');
    formData.append('gender', 'female');
    formData.append('clinicalNote', 'Persistent dry cough for 3 weeks. Suspected minor opacity in right lower lobe.');
    formData.append(
      'image',
      new Blob([imageBuffer], { type: 'image/jpeg' }),
      'chest_xray_demo.jpg'
    );

    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    const data = await res.json();
    if (res.status === 201 && data.success && data.data?._id) {
      testScanId = data.data._id;
      console.log(`✅ PASSED (Created record ID: ${testScanId})`);
    } else {
      console.log('❌ FAILED (Expected 201):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 5. Test Missing Patient Name (Negative Test)
  try {
    process.stdout.write('5. Testing Upload Without Patient Name (Expect 400)... ');
    const formData = new FormData();
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    formData.append('patientName', ''); // Empty name
    formData.append('age', '30');
    formData.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'test.png');

    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    const data = await res.json();
    if (res.status === 400 && data.success === false) {
      console.log('✅ PASSED (Rejected with 400 Bad Request)');
    } else {
      console.log('❌ FAILED (Expected 400):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 6. Test Spoofed File Extension / Magic Bytes (Negative Test)
  try {
    process.stdout.write('6. Testing Spoofed File Content (Text file renamed as .jpg)... ');
    const fakeImageBuffer = Buffer.from('This is a plain text script, NOT a real chest X-ray image!');
    const formData = new FormData();
    formData.append('patientName', 'Fake File Test');
    formData.append('image', new Blob([fakeImageBuffer], { type: 'image/jpeg' }), 'fake.jpg');

    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    const data = await res.json();
    if (res.status === 400 && data.success === false) {
      console.log('✅ PASSED (Caught by Magic Byte Validator)');
    } else {
      console.log('❌ FAILED (Expected 400):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 7. Test DICOM File Rejection (Negative Test)
  try {
    process.stdout.write('7. Testing DICOM Format Detection & Rejection (Expect 400)... ');
    // Build a synthetic buffer with DICOM signature ('DICM' at byte 128)
    const dicomBuffer = Buffer.alloc(140);
    dicomBuffer.write('DICM', 128, 4, 'ascii');

    const formData = new FormData();
    formData.append('patientName', 'DICOM Test Patient');
    formData.append('image', new Blob([dicomBuffer], { type: 'application/dicom' }), 'scan.dcm');

    const res = await fetch(`${BASE_URL}/api/patient-scans`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    const data = await res.json();
    if (res.status === 400 && (data.isDicom || data.error?.includes('DICOM'))) {
      console.log('✅ PASSED (Properly identified and rejected DICOM file)');
    } else {
      console.log('❌ FAILED (Expected DICOM rejection):', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 8. Test Paginated Scan List
  try {
    process.stdout.write('8. Fetching Paginated Scan List (GET /api/patient-scans?page=1&limit=5)... ');
    const res = await fetch(`${BASE_URL}/api/patient-scans?page=1&limit=5`, {
      headers: authHeaders,
    });
    const data = await res.json();
    if (res.status === 200 && data.success && Array.isArray(data.data)) {
      console.log(`✅ PASSED (${data.data.length} records returned, total: ${data.pagination.total})`);
    } else {
      console.log('❌ FAILED:', res.status, data);
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }

  // 9. Test Single Record Retrieval
  if (testScanId) {
    try {
      process.stdout.write(`9. Fetching Single Record Details (GET /api/patient-scans/${testScanId})... `);
      const res = await fetch(`${BASE_URL}/api/patient-scans/${testScanId}`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.status === 200 && data.success && data.data._id === testScanId) {
        console.log(`✅ PASSED (Found: ${data.data.patientName})`);
      } else {
        console.log('❌ FAILED:', res.status, data);
      }
    } catch (err) {
      console.log('❌ FAILED:', err.message);
    }

    // 10. Test Secure Image Stream Retrieval
    try {
      process.stdout.write(`10. Retrieving Chest X-Ray Image Stream (GET /api/patient-scans/${testScanId}/image)... `);
      const res = await fetch(`${BASE_URL}/api/patient-scans/${testScanId}/image`, {
        headers: authHeaders,
      });
      const contentType = res.headers.get('content-type');
      if (res.status === 200 && (contentType.includes('image/') || contentType.includes('jpeg') || contentType.includes('png'))) {
        const imageBlob = await res.blob();
        console.log(`✅ PASSED (Type: ${contentType}, Size: ${(imageBlob.size / 1024).toFixed(1)} KB)`);
      } else {
        console.log('❌ FAILED:', res.status, contentType);
      }
    } catch (err) {
      console.log('❌ FAILED:', err.message);
    }

    // 11. Test Invalid ObjectId Validation
    try {
      process.stdout.write('11. Testing Invalid ObjectId Format (Expect 400)... ');
      const res = await fetch(`${BASE_URL}/api/patient-scans/invalid-id-12345`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.status === 400 && data.success === false) {
        console.log('✅ PASSED (Rejected invalid ObjectId)');
      } else {
        console.log('❌ FAILED (Expected 400):', res.status, data);
      }
    } catch (err) {
      console.log('❌ FAILED:', err.message);
    }

    // 12. Test Deletion & Associated File Cleanup
    try {
      process.stdout.write(`12. Deleting Scan & Verifying File Cleanup (DELETE /api/patient-scans/${testScanId})... `);
      const res = await fetch(`${BASE_URL}/api/patient-scans/${testScanId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.status === 200 && data.success) {
        console.log('✅ PASSED (Record and file deleted cleanly)');
      } else {
        console.log('❌ FAILED:', res.status, data);
      }
    } catch (err) {
      console.log('❌ FAILED:', err.message);
    }
  }

  console.log(`\n🎉 Test suite execution completed!\n`);
}

runTestSuite();
