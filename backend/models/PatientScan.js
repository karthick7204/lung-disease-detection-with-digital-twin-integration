import mongoose from 'mongoose';

/**
 * PatientScan Schema
 * Stores patient demographic details, clinical context, and uploaded chest X-ray image references.
 *
 * NOTE: Patient documents store file references and metadata, NEVER raw base64 or binary data.
 */
const patientScanSchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      minlength: [2, 'Patient name must be at least 2 characters'],
      maxlength: [100, 'Patient name cannot exceed 100 characters'],
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [130, 'Please enter a valid age (0-130)'],
      default: null,
    },
    gender: {
      type: String,
      trim: true,
      enum: {
        values: ['male', 'female', 'other', 'unknown', ''],
        message: '{VALUE} is not a valid gender (allowed: male, female, other, unknown)',
      },
      default: 'unknown',
    },
    clinicalNote: {
      type: String,
      trim: true,
      maxlength: [2000, 'Clinical note cannot exceed 2000 characters'],
      default: '',
    },
    imageFilename: {
      type: String,
      required: [true, 'Stored image filename is required'],
      unique: true,
      trim: true,
    },
    imagePath: {
      type: String,
      required: [true, 'Image storage path is required'],
      trim: true,
    },
    originalImageName: {
      type: String,
      required: [true, 'Original image filename is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'File size in bytes is required'],
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['uploaded', 'pending_ai', 'processing', 'analyzed', 'archived'],
      default: 'analyzed',
    },
    // Registered Patient reference (if linked to an account)
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    // Patient email for fast lookup and account linking
    patientEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
      index: true,
    },
    // Doctor who uploaded this scan record
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    // Deep Learning Model Prediction
    prediction: {
      predictedClass: {
        type: String,
        enum: ['NORMAL', 'PNEUMONIA', 'PENDING', 'ERROR'],
        default: 'PENDING',
      },
      confidence: { type: Number, default: 0 },
      confidencePercentage: { type: String, default: '0%' },
      probabilities: {
        normal: { type: Number, default: 0 },
        pneumonia: { type: Number, default: 0 },
      },
      isPneumonia: { type: Boolean, default: false },
      analyzedAt: { type: Date, default: null },
    },
    // Digital Twin Pulmonary State
    digitalTwin: {
      twinStatus: {
        type: String,
        default: 'Healthy / Clear',
      },
      severityIndex: { type: Number, min: 0, max: 100, default: 0 },
      lungCondition: { type: String, default: '' },
      affectedLobes: [{ type: String }],
      aerationScores: {
        overall: { type: Number, default: 100 },
        leftLung: { type: Number, default: 100 },
        rightLung: { type: Number, default: 100 },
      },
      recommendations: [{ type: String }],
      gradcamFilename: { type: String, default: null },
      modelArchitecture: { type: String, default: 'Attentive-LungNet (ResNet-18 + CBAM + Grad-CAM)' },
      generatedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// Indexes for fast lookup, patient digital twin history, and pagination
patientScanSchema.index({ patientName: 1, uploadedAt: -1 });
patientScanSchema.index({ patient: 1, uploadedAt: -1 });
patientScanSchema.index({ patientEmail: 1, uploadedAt: -1 });
patientScanSchema.index({ uploadedAt: -1 });
patientScanSchema.index({ patientName: 'text' });

// Clean response representation
patientScanSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj.__v;
  return obj;
};

const PatientScan = mongoose.model('PatientScan', patientScanSchema);

export default PatientScan;
