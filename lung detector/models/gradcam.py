"""
=============================================================================
🩺 Grad-CAM (Gradient-Weighted Class Activation Mapping) & Severity Extractor
=============================================================================
Provides visual interpretability and quantitative lesion area measurement:
1. Generates clinical heatmaps showing which lung lobes triggered the decision.
2. Computes physical Pulmonary Opacity Ratio (% of high-activation lung field).
=============================================================================
"""

from typing import Tuple, Dict, Any
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
import matplotlib.cm as cm


class GradCAM:
    """
    Grad-CAM implementation for ResNet / AttentiveLungResNet
    """
    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register forward and backward hooks
        self.target_layer.register_forward_hook(self._save_activations)
        self.target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, input, output):
        self.activations = output.detach()

    def _save_gradients(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate_heatmap(self, input_tensor: torch.Tensor, target_class: int = 1) -> np.ndarray:
        """
        Computes 2D normalized Grad-CAM heatmap for the specified class index.
        """
        self.model.zero_grad()
        
        # Forward pass
        output = self.model(input_tensor)
        # Handle dual-head output (logits, severity, ...) vs single-head output
        if isinstance(output, tuple):
            logits = output[0]
        else:
            logits = output

        # Target class score
        score = logits[0, target_class]
        score.backward(retain_graph=True)

        # Global average pooling of gradients: weights alpha_k
        # gradients shape: (1, Channels, H, W)
        weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)  # (1, C, 1, 1)

        # Weighted combination of activation maps
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)  # (1, 1, H, W)

        # Apply ReLU: only positive correlations contribute to the class
        cam = nn.functional.relu(cam)

        # Normalize between 0 and 1
        cam = cam.squeeze().cpu().numpy()
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)

        return cam

    def compute_cam_severity(self, heatmap_2d: np.ndarray, threshold: float = 0.35) -> float:
        """
        Calculates the Pulmonary Opacity Severity Index (0 - 100%)
        based on the proportion of spatial activation exceeding the threshold.
        """
        # Exclude extreme borders (outer 8% margin of image) to disregard ribs/shoulders
        h, w = heatmap_2d.shape
        margin_y = int(h * 0.08)
        margin_x = int(w * 0.08)
        lung_field = heatmap_2d[margin_y:h - margin_y, margin_x:w - margin_x]

        # Active lesion fraction
        active_mask = (lung_field >= threshold).astype(float)
        active_ratio = float(np.mean(active_mask))
        mean_intensity = float(np.mean(lung_field[lung_field >= threshold])) if np.any(lung_field >= threshold) else 0.0

        # Weighted severity index combining area coverage and opacity density
        severity_index = (active_ratio * 0.6 + mean_intensity * 0.4) * 100.0
        return float(np.clip(severity_index, 0.0, 100.0))

    def overlay_on_image(
        self,
        original_image_path: str,
        heatmap_2d: np.ndarray,
        alpha: float = 0.45,
        colormap_name: str = 'jet'
    ) -> Image.Image:
        """
        Overlays the Grad-CAM heatmap onto the original chest X-ray image and returns PIL Image.
        """
        orig_img = Image.open(original_image_path).convert('RGB')
        w, h = orig_img.size

        # Resize heatmap to match image size using PIL bilinear interpolation
        cam_img = Image.fromarray((heatmap_2d * 255).astype(np.uint8)).resize((w, h), Image.Resampling.BILINEAR)
        cam_norm = np.array(cam_img) / 255.0

        # Apply colormap (compatible with modern and legacy matplotlib versions)
        import matplotlib as mpl
        try:
            cmap = mpl.colormaps[colormap_name]
        except (AttributeError, KeyError):
            try:
                cmap = cm.get_cmap(colormap_name)
            except AttributeError:
                cmap = mpl.colormaps.get_cmap(colormap_name)
        colored_cam = cmap(cam_norm)[:, :, :3]  # Strip alpha
        colored_cam = (colored_cam * 255).astype(np.uint8)

        # Alpha blend with original
        orig_np = np.array(orig_img)
        blended = (orig_np * (1.0 - alpha) + colored_cam * alpha).astype(np.uint8)

        return Image.fromarray(blended)
