# 🫁 LungTwin AI Backend — Doctor X-Ray Upload Service

Backend service for **LungTwin AI**, a medical web application for ingesting chest X-ray radiographs, managing patient clinical records, and preparing data for future 3D pulmonary digital twin visualization and AI inference.

---

## 📋 Table of Contents
1. [Tech Stack](#-tech-stack)
2. [Project Architecture](#-project-architecture)
3. [Folder Structure](#-folder-structure)
4. [Prerequisites & Installation](#-prerequisites--installation)
5. [MongoDB Atlas Setup](#-mongodb-atlas-setup)
6. [Environment Variables](#-environment-variables)
7. [Running the Application](#-running-the-application)
8. [API Documentation](#-api-documentation)
   - [Authentication Endpoints](#authentication-endpoints)
   - [Patient Scan Endpoints](#patient-scan-endpoints)
9. [Step-by-Step Testing with Postman & cURL](#-step-by-step-testing-with-postman--curl)
10. [Security & Validation Safeguards](#-security--validation-safeguards)
11. [Troubleshooting Guide](#-troubleshooting-guide)
12. [Future Roadmap](#-future-roadmap)

---

## 🛠 Tech Stack

- **Runtime:** Node.js (v18+ recommended, ES Modules `"type": "module"`)
- **Web Framework:** Express.js 5.x
- **Database:** MongoDB Atlas (Mongoose ODM)
- **File Uploads:** Multer with memory & disk buffer inspection
- **Security:** Helmet, CORS, JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Path Traversal Prevention
- **Environment:** `dotenv`

---

## 🏗 Project Architecture

```
                       [ Doctor Frontend / Postman ]
                                    │
                                    ▼
                          [ Express Web Server ]
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
 [ /api/auth (JWT) ]                             [ /api/patient-scans ]
   - Register Doctor                               - Authenticate & Role Check
   - Login & Issue Token                           - Multer File Filter (MIME / Ext)
                                                   - Binary Magic Byte Inspector
                                                   - File Size & Type Validation
                                                            │
                                  ┌─────────────────────────┴─────────────────────────┐
                                  ▼                                                   ▼
                       [ uploads/ Directory ]                              [ MongoDB Atlas ]
                       - Safe UUID Filename                                - Patient Metadata
                       - Non-public Controlled Stream                      - Image Filename Reference
                       - Automatic Orphan Cleanup                          - Timestamps & Indexes
```

---

## 📁 Folder Structure

```text
lungtwin-backend/
├── assets/
│   └── sample-chest-xray.jpg       # Sample PA chest X-ray for immediate testing
├── config/
│   └── db.js                       # MongoDB Atlas connection manager & event listeners
├── controllers/
│   ├── authController.js           # Doctor registration, login, and profile
│   └── patientScanController.js    # Upload, list, getById, image stream, delete
├── middleware/
│   ├── auth.js                     # JWT verification & role-based doctor authorization
│   ├── errorHandler.js             # Centralized error handler & 404 middleware
│   └── upload.js                   # Multer configuration, 10MB limit & safe UUID naming
├── models/
│   ├── Doctor.js                   # Doctor credentials model (bcrypt hashed)
│   └── PatientScan.js              # Patient metadata and X-ray reference schema
├── routes/
│   ├── authRoutes.js               # /api/auth routes
│   └── patientScanRoutes.js        # /api/patient-scans routes
├── scripts/
│   ├── seedDemo.js                 # Seeds demo doctor account and prints ready-to-use JWT
│   └── testApi.js                  # Automated 12-step test suite
├── uploads/
│   └── .gitkeep                    # Storage directory for uploaded scans (gitignored)
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore file (prevents committing secrets/uploads)
├── package.json                    # Project dependencies and npm scripts
└── server.js                       # Main application entry point
```

---

## ⚡ Prerequisites & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)
- A **MongoDB Atlas** account (free M0 tier available at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas))

### 2. Installation
Open your terminal in the project directory:

```bash
# Install all required production and development dependencies
npm install
```

---

## 🌐 MongoDB Atlas Setup

1. **Create an Account / Cluster:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
   - Click **Create Database** -> Choose the free **M0 Sandbox** cluster.
   - Choose a region close to you.

2. **Create a Database User:**
   - Under **Security** -> **Database Access** -> Click **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: e.g., `lungtwin_admin`.
   - Password: Click **Autogenerate Secure Password** or set a strong password (copy it!).
   - Database User Privileges: **Read and write to any database**.

3. **Configure IP Access List:**
   - Under **Security** -> **Network Access** -> Click **Add IP Address**.
   - For development, select **Allow Access from Anywhere** (`0.0.0.0/0`) or add your current IP address.

4. **Retrieve Connection String:**
   - Go to **Databases** -> Click **Connect** next to your cluster.
   - Choose **Drivers** -> Driver: **Node.js** (version 5.5 or later).
   - Copy the connection URI:
     ```text
     mongodb+srv://lungtwin_admin:<password>@cluster0.xxxxx.mongodb.net/lungtwin?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual database user password.

---

## 🔐 Environment Variables

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your actual configuration:

```env
# Server Port
PORT=5000

# Node Environment ('development' or 'production')
NODE_ENV=development

# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://lungtwin_admin:YourSecurePassword123@cluster0.xxxxx.mongodb.net/lungtwin?retryWrites=true&w=majority

# Frontend Origin for CORS
CLIENT_URL=http://localhost:3000

# JWT Authentication Secret
JWT_SECRET=super_secret_jwt_key_lungtwin_ai_production_grade_token_2026

# Token expiration
JWT_EXPIRES_IN=7d

# File Upload Settings
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
```

> **Security Note:** The `.env` file is excluded from Git in `.gitignore`. Never commit `.env` or credentials to version control.

---

## 🚀 Running the Application

### Development Mode (with hot reload via Nodemon):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

### Seed Demo Doctor Account:
Creates a demo doctor account in MongoDB and outputs a ready-to-use JWT token:
```bash
npm run seed
```

### Run Automated API Integration Tests:
```bash
npm run test-api
```

---

## 📖 API Documentation

### Base URL: `http://localhost:5000`

---

### Authentication Endpoints

#### 1. Register Doctor
- **Method:** `POST`
- **URL:** `/api/auth/register`
- **Access:** Public
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Dr. Sarah Smith, MD",
  "email": "doctor.smith@lungtwin.ai",
  "password": "DoctorPassword123!",
  "licenseNumber": "MD-PULM-88921",
  "hospital": "Metropolitan Pulmonary Center"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Doctor account registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "doctor": {
    "id": "671e3b5e4f1a2c001a123456",
    "name": "Dr. Sarah Smith, MD",
    "email": "doctor.smith@lungtwin.ai",
    "role": "doctor",
    "licenseNumber": "MD-PULM-88921",
    "hospital": "Metropolitan Pulmonary Center"
  }
}
```

#### 2. Doctor Login
- **Method:** `POST`
- **URL:** `/api/auth/login`
- **Access:** Public
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "email": "doctor.smith@lungtwin.ai",
  "password": "DoctorPassword123!"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "doctor": {
    "id": "671e3b5e4f1a2c001a123456",
    "name": "Dr. Sarah Smith, MD",
    "email": "doctor.smith@lungtwin.ai",
    "role": "doctor"
  }
}
```

---

### Patient Scan Endpoints

> **Note:** All `/api/patient-scans` endpoints require the header:  
> `Authorization: Bearer <your_jwt_token>`

#### 3. Upload Patient Chest X-Ray
- **Method:** `POST`
- **URL:** `/api/patient-scans`
- **Access:** Private (Doctor role required)
- **Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: multipart/form-data`
- **Multipart Form Fields:**
  | Field Name | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `image` | File | **Yes** | Chest X-ray image (JPEG or PNG, up to 10MB) |
  | `patientName` | Text | **Yes** | Full patient name |
  | `age` | Text/Number | No | Patient age (0 - 130) |
  | `gender` | Text | No | `'male'`, `'female'`, `'other'`, or `'unknown'` |
  | `clinicalNote` | Text | No | Short clinical history or presenting symptoms |

- **Sample Response (201 Created):**
```json
{
  "success": true,
  "message": "Patient chest X-ray scan record uploaded successfully.",
  "data": {
    "patientName": "Robert Vance",
    "age": 54,
    "gender": "male",
    "clinicalNote": "Chronic cough, 20 pack-year smoking history. Rule out consolidation in right middle lobe.",
    "imageFilename": "scan-1740645678901-b4f7e2a9-c1d4-4a5e-99f8-7b1234567890.jpg",
    "imagePath": "uploads/scan-1740645678901-b4f7e2a9-c1d4-4a5e-99f8-7b1234567890.jpg",
    "originalImageName": "chest_xray_rvance.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 630784,
    "uploadedAt": "2026-10-27T14:15:30.123Z",
    "status": "uploaded",
    "uploadedBy": "671e3b5e4f1a2c001a123456",
    "id": "671e3c884f1a2c001a123789",
    "createdAt": "2026-10-27T14:15:30.125Z",
    "updatedAt": "2026-10-27T14:15:30.125Z"
  }
}
```

#### 4. Get Paginated Scan Records
- **Method:** `GET`
- **URL:** `/api/patient-scans?page=1&limit=10&search=Robert`
- **Access:** Private (Doctor role required)
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Records per page (default: 10, max: 50)
  - `search`: (Optional) Case-insensitive search on patient name
- **Sample Response (200 OK):**
```json
{
  "success": true,
  "count": 1,
  "pagination": {
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "limit": 10,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": "671e3c884f1a2c001a123789",
      "patientName": "Robert Vance",
      "age": 54,
      "gender": "male",
      "clinicalNote": "Chronic cough, 20 pack-year smoking history.",
      "imageFilename": "scan-1740645678901-b4f7e2a9-c1d4-4a5e-99f8-7b1234567890.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 630784,
      "uploadedAt": "2026-10-27T14:15:30.123Z",
      "status": "uploaded",
      "uploadedBy": {
        "id": "671e3b5e4f1a2c001a123456",
        "name": "Dr. Sarah Smith, MD",
        "email": "doctor.smith@lungtwin.ai",
        "hospital": "Metropolitan Pulmonary Center"
      }
    }
  ]
}
```

#### 5. Get Single Scan Details
- **Method:** `GET`
- **URL:** `/api/patient-scans/:id`
- **Access:** Private (Doctor role required)
- **Headers:** `Authorization: Bearer <token>`
- **Sample Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "671e3c884f1a2c001a123789",
    "patientName": "Robert Vance",
    "age": 54,
    "gender": "male",
    "clinicalNote": "Chronic cough, 20 pack-year smoking history.",
    "imageFilename": "scan-1740645678901-b4f7e2a9-c1d4-4a5e-99f8-7b1234567890.jpg",
    "imagePath": "uploads/scan-1740645678901-b4f7e2a9-c1d4-4a5e-99f8-7b1234567890.jpg",
    "originalImageName": "chest_xray_rvance.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 630784,
    "uploadedAt": "2026-10-27T14:15:30.123Z",
    "status": "uploaded"
  }
}
```

#### 6. Securely Retrieve Associated Chest X-Ray Image
- **Method:** `GET`
- **URL:** `/api/patient-scans/:id/image`
- **Access:** Private (Doctor role required)
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  - Status: `200 OK`
  - `Content-Type: image/jpeg` (or `image/png`)
  - `Content-Disposition: inline; filename="chest_xray_rvance.jpg"`
  - Body: Raw image binary stream

#### 7. Delete Scan Record & Associated File
- **Method:** `DELETE`
- **URL:** `/api/patient-scans/:id`
- **Access:** Private (Doctor role required)
- **Headers:** `Authorization: Bearer <token>`
- **Sample Response (200 OK):**
```json
{
  "success": true,
  "message": "Patient scan record and associated chest X-ray image deleted successfully.",
  "deletedId": "671e3c884f1a2c001a123789"
}
```

---

## 🧪 Step-by-Step Testing with Postman & cURL

### Quick Verification via cURL:

#### Step 1: Login as Doctor
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor.smith@lungtwin.ai",
    "password": "LungTwinDoctor2026!"
  }'
```
*Copy the `token` from the response.*

#### Step 2: Upload a Patient Scan
```bash
curl -X POST http://localhost:5000/api/patient-scans \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "patientName=John Doe" \
  -F "age=45" \
  -F "gender=male" \
  -F "clinicalNote=Persistent dyspnea on exertion." \
  -F "image=@assets/sample-chest-xray.jpg"
```

#### Step 3: View List of Scans
```bash
curl -X GET "http://localhost:5000/api/patient-scans?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Step 4: Retrieve the Image Stream
```bash
# Save retrieved image to local file downloaded_xray.jpg
curl -X GET "http://localhost:5000/api/patient-scans/YOUR_SCAN_ID/image" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  --output downloaded_xray.jpg
```

---

### Step-by-Step Postman Setup:

1. **Create an Environment in Postman:**
   - Variable `baseUrl` = `http://localhost:5000`
   - Variable `authToken` = *(leave blank, will be set on login)*

2. **Login Request:**
   - Method: `POST`
   - URL: `{{baseUrl}}/api/auth/login`
   - Body -> `raw` -> `JSON`:
     ```json
     {
       "email": "doctor.smith@lungtwin.ai",
       "password": "LungTwinDoctor2026!"
     }
     ```
   - In the **Tests** tab, add:
     ```javascript
     const res = pm.response.json();
     if (res.token) {
       pm.environment.set("authToken", res.token);
     }
     ```

3. **Upload Chest X-Ray Request:**
   - Method: `POST`
   - URL: `{{baseUrl}}/api/patient-scans`
   - **Authorization** tab -> Type: `Bearer Token` -> Token: `{{authToken}}`
   - **Body** tab -> select **form-data**:
     - Key `patientName` (Text): `Alice Walker`
     - Key `age` (Text): `62`
     - Key `gender` (Text): `female`
     - Key `clinicalNote` (Text): `Suspected left lower lobe pneumonia.`
     - Key `image` -> hover over key, click dropdown to change from **Text** to **File** -> Select `assets/sample-chest-xray.jpg`.
   - Click **Send**.

4. **View Image Request:**
   - Method: `GET`
   - URL: `{{baseUrl}}/api/patient-scans/{{scanId}}/image`
   - **Authorization** tab -> `Bearer Token`: `{{authToken}}`
   - In Postman, the image renders visually directly in the response window.

---

## 🛡 Security & Validation Safeguards

1. **Binary Magic Byte Inspection (`utils/fileValidator.js`):**
   - Attackers frequently rename executable files (`exploit.exe`) to `.jpg` or `.png`.
   - The backend directly inspects the first bytes of the file buffer on disk to verify genuine JPEG (`0xFF 0xD8 0xFF`) or PNG (`0x89 0x50 0x4E 0x47`) file signatures.
   - Any non-matching file is immediately rejected with `400 Bad Request` and deleted from storage.

2. **Explicit DICOM Handling:**
   - Scans for standard DICOM preamble signature (`DICM` at offset 128) and `.dcm` extensions.
   - Rejects unparsed DICOM files with a clear instructional error:  
     `"DICOM file format detected. Direct DICOM uploads are not supported in this version. Please convert your chest X-ray to a high-resolution PNG or JPEG before uploading."`

3. **Path Traversal (LFI) Guard (`isSafePath`):**
   - Filenames are randomized via `crypto.randomUUID()`.
   - Path normalization guarantees no file can be fetched outside the designated `uploads/` directory, preventing directory traversal attacks like `../../etc/passwd`.

4. **Orphaned File Garbage Collection:**
   - If database operations fail, or if metadata validation fails after Multer writes a temporary file, `fs.promises.unlink` automatically cleans up the unindexed file.

5. **No Base64 Bloat in Database:**
   - Only file references and metadata are stored in MongoDB Atlas documents. Images reside in organized file storage, keeping database queries fast and lightweight.

---

## ❓ Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `querySrv ENOTFOUND ...` | Invalid Atlas URI or no internet connection | Check `MONGODB_URI` in `.env`. Ensure your computer is connected to the internet. |
| `MongoServerError: bad auth : authentication failed` | Incorrect Atlas username or password | Check your MongoDB Atlas Database Access user credentials. Verify special characters in password are URL-encoded if needed. |
| `MongooseError: operation timed out` | IP Access List not configured in Atlas | Go to Atlas -> Network Access -> Add IP `0.0.0.0/0` (Allow from anywhere) for development. |
| `File too large` (400) | Image exceeds 10MB limit | Compress image or adjust `MAX_FILE_SIZE_MB` in `.env`. |
| `Authentication required` (401) | Missing or invalid Bearer token | Ensure `Authorization: Bearer <token>` header is included in your request. |
| `Invalid patient scan ID format` (400) | Non-24 character hex ID in URL | Ensure the ID in URL is a valid MongoDB 24-character hexadecimal ObjectId. |

---

## 🔮 Future Roadmap (Preparing for AI & 3D Digital Twin)

1. **Python AI Microservice Integration:**
   - Once the user uploads a chest X-ray, the `status` will transition to `"pending_ai"`.
   - A background message queue or direct HTTP webhook will send the image reference to a PyTorch / TorchVision inference worker running DenseNet-121 / CheXNet.
2. **3D Lung Digital Twin Visualization:**
   - AI heatmaps (Grad-CAM) will be mapped onto a 3D polygonal lung mesh in the frontend using Three.js / React Three Fiber.
3. **Cloud Storage Migration:**
   - Transition local `uploads/` directory to AWS S3, Google Cloud Storage, or Cloudinary using pre-signed secure URLs for production scale.
