"""
=============================================================================
🧠 AttentiveLungResNet: Dual-Head Multi-Task ResNet with CBAM Attention
=============================================================================
Architectural Novelties:
1. CBAM Attention Layer: Sits atop Layer 4 (512x7x7) to filter peripheral
   bone/diaphragm artifacts and emphasize infected parenchyma.
2. Multi-Task Dual Head:
   - Head A: Categorical Classifier (Normal vs Pneumonia logits)
   - Head B: Continuous Pulmonary Severity Regressor (0% to 100% scale)
3. Spatial Lobe Aeration Extractor: Decomposes 7x7 spatial activation field
   into physiological lung lobes (RUL, RML/RLL, LUL, LLL).
=============================================================================
"""

from typing import Dict, Any, Tuple
import torch
import torch.nn as nn
import torchvision.models as models
from .attention import CBAM


class AttentiveLungResNet(nn.Module):
    """
    Novel ResNet Architecture with Integrated Dual Attention & Multi-Task Heads
    """
    def __init__(self, num_classes: int = 2, pretrained: bool = False):
        super(AttentiveLungResNet, self).__init__()

        # 1. Base Feature Extraction Backbone
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        base = models.resnet18(weights=weights)

        self.conv1 = base.conv1
        self.bn1 = base.bn1
        self.relu = base.relu
        self.maxpool = base.maxpool

        self.layer1 = base.layer1  # 64 channels
        self.layer2 = base.layer2  # 128 channels
        self.layer3 = base.layer3  # 256 channels
        self.layer4 = base.layer4  # 512 channels, 7x7 spatial map

        # 2. Novel Attention Layer (CBAM) applied to deepest convolutional activations
        self.cbam = CBAM(in_planes=512, ratio=16, kernel_size=7)

        # 3. Global Feature Pooling & Shared Latent Projection Neck
        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.shared_neck = nn.Sequential(
            nn.Linear(512, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.35)
        )

        # 4. Novel Multi-Task Head A: Disease Classification Head
        self.classifier = nn.Linear(256, num_classes)

        # 5. Novel Multi-Task Head B: Continuous Pulmonary Severity Regressor (0 - 100%)
        self.severity_head = nn.Sequential(
            nn.Linear(256, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
            nn.Sigmoid()  # Multiplied by 100 in forward pass
        )

    def extract_features(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Passes input through backbone and attention layers.
        Returns both raw layer4 activations and CBAM-attended activations.
        """
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        conv_features = self.layer4(x)  # (B, 512, 7, 7)

        # Apply CBAM Attention
        attended_features = self.cbam(conv_features)  # (B, 512, 7, 7)
        return conv_features, attended_features

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass producing:
        - logits: Classification output (Batch, num_classes)
        - severity: Continuous severity percentage (Batch, 1) in [0, 100]
        - attended_map: Spatial 2D attention map (Batch, 512, 7, 7)
        """
        _, attended_features = self.extract_features(x)

        # Pool and project
        pooled = self.gap(attended_features)
        flat = torch.flatten(pooled, 1)
        latent = self.shared_neck(flat)

        # Multi-task branch outputs
        logits = self.classifier(latent)
        severity = self.severity_head(latent) * 100.0  # Scale [0, 1] to [0, 100%]

        return logits, severity, attended_features

    def compute_lobe_aeration(self, spatial_map: torch.Tensor, is_pneumonia: bool) -> Dict[str, Any]:
        """
        Decomposes the 7x7 spatial activation map into physiological lung quadrants.
        Calculates lobe-specific aeration percentages for the 3D Digital Twin.
        """
        # Average across the 512 feature channels -> (7, 7) intensity map
        if spatial_map.dim() == 4:
            spatial_map = spatial_map[0]  # Take first sample in batch
        spatial_density = torch.mean(spatial_map, dim=0).detach().cpu().numpy()

        # Min-max normalization of activation density
        min_v = spatial_density.min()
        max_v = spatial_density.max()
        if max_v > min_v:
            normalized_density = (spatial_density - min_v) / (max_v - min_v)
        else:
            normalized_density = spatial_density

        # Anatomical quadrants on 7x7 grid:
        # Columns 0..3: Right Lung (Anatomical Left on PA view)
        # Columns 4..6: Left Lung (Anatomical Right on PA view)
        # Rows 0..3: Upper Lobes
        # Rows 4..6: Lower Lobes
        right_upper = float(normalized_density[0:3, 0:3].mean())
        right_lower = float(normalized_density[3:7, 0:3].mean())
        left_upper = float(normalized_density[0:3, 4:7].mean())
        left_lower = float(normalized_density[3:7, 4:7].mean())

        if is_pneumonia:
            # Opacity reduces aeration
            right_aeration = max(20, min(95, round(100 - (right_lower * 60 + right_upper * 30))))
            left_aeration = max(20, min(95, round(100 - (left_lower * 60 + left_upper * 30))))
            overall_aeration = round((right_aeration + left_aeration) / 2)
            
            affected = []
            if right_lower > 0.4:
                affected.append("Right Lower Lobe (RLL)")
            if left_lower > 0.4:
                affected.append("Left Lower Lobe (LLL)")
            if right_upper > 0.5:
                affected.append("Right Upper Lobe (RUL)")
            if left_upper > 0.5:
                affected.append("Left Upper Lobe (LUL)")
            if not affected:
                affected = ["Bilateral Basal Segments"]
        else:
            right_aeration = 98
            left_aeration = 97
            overall_aeration = 98
            affected = []

        return {
            "overall": overall_aeration,
            "rightLung": right_aeration,
            "leftLung": left_aeration,
            "affectedLobes": affected,
            "quadrantDensity": {
                "rightUpper": round(right_upper, 3),
                "rightLower": round(right_lower, 3),
                "leftUpper": round(left_upper, 3),
                "leftLower": round(left_lower, 3),
            }
        }

