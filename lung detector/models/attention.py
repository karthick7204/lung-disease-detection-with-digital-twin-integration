"""
=============================================================================
🧠 Convolutional Block Attention Module (CBAM) for Pulmonary Feature Focus
=============================================================================
Novel Attention Layer:
1. Channel Attention Module (CAM): Explores cross-channel feature relationships
   to emphasize "WHAT" pathological opacities and textures are salient.
2. Spatial Attention Module (SAM): Explores inter-spatial relationships to
   emphasize "WHERE" lesions reside, filtering out non-pulmonary boundaries.
=============================================================================
"""

import torch
import torch.nn as nn


class ChannelAttention(nn.Module):
    """
    Channel Attention Module (CAM)
    Aggregates spatial dimensions using both Average-Pooling and Max-Pooling,
    passes them through a shared Multi-Layer Perceptron (MLP) with reduction ratio,
    and combines them to generate a 1D channel attention map.
    """
    def __init__(self, in_planes: int, ratio: int = 16):
        super(ChannelAttention, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)

        # Shared MLP: 1x1 Conv with reduction ratio
        reduced_planes = max(1, in_planes // ratio)
        self.fc1 = nn.Conv2d(in_planes, reduced_planes, kernel_size=1, bias=False)
        self.relu = nn.ReLU(inplace=True)
        self.fc2 = nn.Conv2d(reduced_planes, in_planes, kernel_size=1, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        avg_out = self.fc2(self.relu(self.fc1(self.avg_pool(x))))
        max_out = self.fc2(self.relu(self.fc1(self.max_pool(x))))
        channel_weights = self.sigmoid(avg_out + max_out)
        return channel_weights


class SpatialAttention(nn.Module):
    """
    Spatial Attention Module (SAM)
    Applies Average-Pooling and Max-Pooling across the channel axis to generate
    two 2D feature maps, concatenates them, and applies a 7x7 convolution to
    produce a 2D spatial attention map highlighting active pulmonary fields.
    """
    def __init__(self, kernel_size: int = 7):
        super(SpatialAttention, self).__init__()
        assert kernel_size in (3, 7), "kernel_size must be 3 or 7"
        padding = 3 if kernel_size == 7 else 1
        self.conv1 = nn.Conv2d(2, 1, kernel_size=kernel_size, padding=padding, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Channel-wise pooling
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        pooled_cat = torch.cat([avg_out, max_out], dim=1)
        spatial_weights = self.sigmoid(self.conv1(pooled_cat))
        return spatial_weights


class CBAM(nn.Module):
    """
    Sequential Convolutional Block Attention Module
    F_intermediate = CAM(F) ⊗ F
    F_attended     = SAM(F_intermediate) ⊗ F_intermediate
    """
    def __init__(self, in_planes: int, ratio: int = 16, kernel_size: int = 7):
        super(CBAM, self).__init__()
        self.ca = ChannelAttention(in_planes, ratio=ratio)
        self.sa = SpatialAttention(kernel_size=kernel_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 1. Apply Channel Attention
        x_channel = x * self.ca(x)
        # 2. Apply Spatial Attention
        x_out = x_channel * self.sa(x_channel)
        return x_out

