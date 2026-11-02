import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { connectDB, closeDB } from './config/db.js';
import patientScanRoutes from './routes/patientScanRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// Apply security headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows frontend to fetch image streams
  })
);

// Configure CORS for authorized frontend communication
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      // or if origin matches configured CLIENT_URL
      if (!origin || origin === clientUrl || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked request from origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parse JSON request payloads with size limits
app.use(express.json({ limit: '2mb' }));

// Parse URL-encoded form bodies
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Root health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'LungTwin AI Backend',
    version: '1.0.0',
    description: 'Chest X-Ray Upload & Patient Scan Management API',
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      auth: {
        unifiedLogin: 'POST /api/auth/login ({ email, password, role? })',
        me: 'GET /api/auth/me (Bearer token)',
        doctorRegister: 'POST /api/auth/doctor/register',
        doctorLogin: 'POST /api/auth/doctor/login',
        patientRegister: 'POST /api/auth/patient/register',
        patientLogin: 'POST /api/auth/patient/login',
      },
      patientScans: {
        upload: 'POST /api/patient-scans (Doctor only: multipart/form-data: image, patientName, patientEmail?, age, gender, clinicalNote)',
        list: 'GET /api/patient-scans (Doctor sees all, Patient sees only their lungs)',
        getById: 'GET /api/patient-scans/:id (Doctor sees any, Patient sees only their lungs)',
        getImage: 'GET /api/patient-scans/:id/image',
        myDigitalTwin: 'GET /api/patient-scans/digital-twin/my-twin (Patient only)',
        digitalTwinSearch: 'GET /api/patient-scans/digital-twin/search?name=<patientName> (Doctor searches any, Patient restricted to self)',
        delete: 'DELETE /api/patient-scans/:id (Doctor only)',
      },
      health: 'GET /api/health',
    },
  });
});

// Detailed system health check
app.get('/api/health', (req, res) => {
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      state: dbStatusMap[mongoose.connection.readyState] || 'unknown',
      connected: mongoose.connection.readyState === 1,
    },
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient-scans', patientScanRoutes);

// Catch 404 routes
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

// Server startup configuration (defaults to 5001 to avoid macOS AirPlay Receiver on port 5000)
const PORT = process.env.PORT && process.env.PORT !== '5000' ? process.env.PORT : 5001;

let server = null;

async function startServer() {
  // Connect to MongoDB Atlas
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 LungTwin AI Backend running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏥 Doctor Upload API: http://localhost:${PORT}/api/patient-scans`);
    console.log(`🔐 Doctor Auth API:   http://localhost:${PORT}/api/auth`);
    console.log(`===============================================`);
  });
}

// Handle unexpected process errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down server gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await closeDB();
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();

export default app;
