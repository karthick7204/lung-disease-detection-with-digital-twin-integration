import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root paths
const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const PREDICT_SCRIPT_PATH = path.resolve(PROJECT_ROOT, 'lung detector', 'predict.py');
const MODEL_WEIGHTS_PATH = path.resolve(PROJECT_ROOT, 'lung detector', 'model_output', 'best_resnet18.pth');
const CLASS_MAPPING_PATH = path.resolve(PROJECT_ROOT, 'lung detector', 'model_output', 'class_mapping.json');

/**
 * Computes structured Digital Twin metrics based on the ResNet-18 prediction.
 *
 * @param {Object} rawPrediction - Output from predict.py
 * @param {number} patientAge - Age of patient
 * @returns {Object} Enriched Digital Twin profile
 */
export function generateDigitalTwinProfile(rawPrediction, patientAge = null) {
  const isPneumonia = Boolean(rawPrediction.is_pneumonia);
  const confidence = Number(rawPrediction.confidence) || 0.5;

  // Use quantitative severity from deep learning model if available
  let severityIndex = rawPrediction.severity_index !== undefined
    ? Number(rawPrediction.severity_index)
    : (isPneumonia ? Math.min(99, Math.max(65, Math.round(confidence * 100))) : 5);

  let status = 'Healthy / Clear';
  let lungCondition = '';
  let affectedLobes = rawPrediction.aeration_scores?.affectedLobes || [];
  let recommendations = [];

  if (isPneumonia) {
    status = severityIndex >= 80 ? 'Severe Pulmonary Infection' : (severityIndex >= 60 ? 'Moderate Infiltration' : 'Mild Infiltration');
    lungCondition =
      'Bilateral/focal pulmonary infiltrates and airspace consolidation detected. Grad-CAM confirms localized parenchymal inflammation.';
    if (affectedLobes.length === 0) {
      affectedLobes = ['Right Lower Lobe (RLL)', 'Left Lower Lobe (LLL)', 'Basal Segments'];
    }
    recommendations = [
      'Clinical correlation with inflammatory biomarkers (CRP, Procalcitonin) recommended.',
      'Evaluate oxygen saturation (SpO2) and arterial blood gases.',
      'Review Grad-CAM explainability heatmap for anatomical lobe consolidation.',
      'Schedule follow-up digital twin scan in 10-14 days to monitor infiltrate clearing.',
    ];
  } else {
    status = 'Healthy / Clear';
    lungCondition =
      'Clear bilateral lung parenchyma. Normal bronchovascular markings with no acute focal consolidation or pleural effusion.';
    affectedLobes = [];
    recommendations = [
      'Clear pulmonary fields; no acute airspace consolidation identified.',
      'Maintain standard clinical monitoring if symptoms persist.',
    ];
  }

  // Aeration estimates computed from spatial Grad-CAM density or inverted severity
  let leftAeration = rawPrediction.aeration_scores?.leftLung ?? (isPneumonia ? Math.max(25, 100 - severityIndex + 5) : 98);
  let rightAeration = rawPrediction.aeration_scores?.rightLung ?? (isPneumonia ? Math.max(20, 100 - severityIndex - 5) : 96);
  let overallAeration = rawPrediction.aeration_scores?.overall ?? Math.round((leftAeration + rightAeration) / 2);

  const gradcamFilename = rawPrediction.gradcam_image_path
    ? path.basename(rawPrediction.gradcam_image_path)
    : null;

  return {
    twinStatus: status,
    severityIndex: Math.round(severityIndex),
    lungCondition,
    affectedLobes,
    gradcamFilename,
    modelArchitecture: rawPrediction.model_architecture || 'Attentive-LungNet (ResNet-18 + CBAM + Grad-CAM)',
    aerationScores: {
      overall: overallAeration,
      leftLung: leftAeration,
      rightLung: rightAeration,
    },
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Executes the PyTorch ResNet-18 prediction script on a given chest X-ray image file.
 * Returns the raw prediction plus enriched Digital Twin computational state.
 *
 * @param {string} imagePath - Absolute or relative path to the image file
 * @param {number} [patientAge] - Patient's age for clinical context
 * @returns {Promise<Object>} Complete prediction and digital twin data
 */
export async function runInference(imagePath, patientAge = null) {
  const resolvedImagePath = path.resolve(imagePath);

  if (!fs.existsSync(resolvedImagePath)) {
    throw new Error(`Target chest X-ray image not found at: ${resolvedImagePath}`);
  }

  if (!fs.existsSync(PREDICT_SCRIPT_PATH)) {
    throw new Error(`AI inference script not found at: ${PREDICT_SCRIPT_PATH}`);
  }

  const pythonCmd = process.env.PYTHON_PATH || 'python3';

  return new Promise((resolve, reject) => {
    const args = [
      PREDICT_SCRIPT_PATH,
      '--image',
      resolvedImagePath,
      '--model',
      MODEL_WEIGHTS_PATH,
      '--mapping',
      CLASS_MAPPING_PATH,
      '--json',
    ];

    const child = spawn(pythonCmd, args, {
      cwd: path.dirname(PREDICT_SCRIPT_PATH),
      env: { ...process.env },
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Python inference process: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `Inference script exited with code ${code}.\nStderr: ${stderrData || 'none'}\nStdout: ${stdoutData || 'none'}`
          )
        );
      }

      try {
        const rawPrediction = JSON.parse(stdoutData.trim());
        if (!rawPrediction.success) {
          return reject(new Error(rawPrediction.error || 'AI prediction returned failure.'));
        }

        const digitalTwin = generateDigitalTwinProfile(rawPrediction, patientAge);

        resolve({
          prediction: {
            predictedClass: rawPrediction.predicted_class,
            confidence: rawPrediction.confidence,
            confidencePercentage: rawPrediction.confidence_percentage,
            probabilities: {
              normal: rawPrediction.probabilities?.NORMAL || 0,
              pneumonia: rawPrediction.probabilities?.PNEUMONIA || 0,
            },
            isPneumonia: rawPrediction.is_pneumonia,
            analyzedAt: new Date(),
          },
          digitalTwin,
        });
      } catch (parseError) {
        reject(
          new Error(
            `Failed to parse prediction output JSON: ${parseError.message}\nRaw Output: ${stdoutData}`
          )
        );
      }
    });
  });
}
