#!/usr/bin/env python3
"""
Mobile-Optimized Gaussian Splatting PLY Preprocessor

Generates balanced models for mobile WebGL rendering with:
- 25,000–40,000 splats
- SH degree: 1
- Background pruning
- Reduced overdraw (medium gaussian size)
- Compressed output

Usage:
    python scripts/optimize_splat_mobile.py input.ply -o output.compressed.ply
    python scripts/optimize_splat_mobile.py input.ply --target-splats 32000 --output output.ply
"""

import argparse
import numpy as np
from pathlib import Path


def load_ply(path: str):
    """Load PLY using gsply if available, else plyfile fallback."""
    try:
        from gsply import plyread, GSData
        data = plyread(path)
        return data, "gsply"
    except ImportError:
        from plyfile import PlyData
        ply = PlyData.read(path)
        return ply, "plyfile"


def save_ply_gsply(data, path: str, compressed: bool = True):
    """Save using gsply with optional compression."""
    from gsply import GSData
    if hasattr(data, "save"):
        data.save(path, compressed=compressed)
    else:
        raise ValueError("gsply required for saving")


def optimize_for_mobile(
    input_path: str,
    output_path: str,
    target_splats: int = 32000,
    min_splats: int = 25000,
    max_splats: int = 40000,
    sh_degree: int = 1,
    opacity_threshold: float = 0.01,
    background_prune_ratio: float = 0.15,
    scale_clamp: tuple = (0.001, 0.15),
    compressed: bool = True,
):
    """
    Optimize Gaussian Splatting PLY for mobile rendering.
    
    Args:
        input_path: Input PLY path
        output_path: Output path (.ply or .compressed.ply)
        target_splats: Target splat count (25k-40k)
        sh_degree: Spherical harmonics degree (1 = directional lighting)
        opacity_threshold: Remove splats below this opacity
        background_prune_ratio: Fraction of periphery splats to remove (0-1)
        scale_clamp: (min, max) scale bounds for medium gaussian size
        compressed: Use PlayCanvas compressed format
    """
    data, backend = load_ply(input_path)
    
    if backend == "plyfile":
        raise SystemExit(
            "gsply required for optimization. Install with: pip install gsply"
        )
    
    # Ensure contiguous for operations
    data = data.make_contiguous() if hasattr(data, "make_contiguous") else data
    
    n_orig = len(data)
    print(f"Loaded {n_orig:,} splats from {input_path}")
    
    # 1) Opacity pruning - remove near-invisible splats
    if hasattr(data, "opacities"):
        if hasattr(data, "denormalize"):
            data.denormalize()
        opacities = np.asarray(data.opacities).flatten()
        mask = opacities >= opacity_threshold
        data = data[mask]
        opacities = opacities[mask]
        print(f"After opacity pruning: {len(data):,} splats")
    
    # 2) Importance score: opacity * geometric_mean(scales) - prioritize visible, reasonably-sized
    means = np.asarray(data.means)
    scales = np.asarray(data.scales)
    opacities = np.asarray(data.opacities)
    
    scale_geom = np.exp(np.mean(np.log(np.clip(np.abs(scales) + 1e-8, 1e-8, None)), axis=1))
    importance = opacities * scale_geom
    
    # 3) Background pruning - remove splats far from center (often sky/ground)
    center = np.median(means, axis=0)
    dists = np.linalg.norm(means - center, axis=1)
    radius = np.percentile(dists, 95)
    
    # Mark background: distant + low importance
    is_background = (dists > radius * 0.8) & (importance < np.percentile(importance, 50))
    n_background = int(len(data) * background_prune_ratio)
    background_inds = np.where(is_background)[0]
    if len(background_inds) > n_background:
        remove_background = background_inds[
            np.argsort(importance[background_inds])[:n_background]
        ]
        keep_mask = np.ones(len(data), dtype=bool)
        keep_mask[remove_background] = False
        data = data[keep_mask]
        means = np.asarray(data.means)
        scales = np.asarray(data.scales)
        opacities = np.asarray(data.opacities)
        importance = opacities * np.exp(np.mean(np.log(np.clip(np.abs(scales) + 1e-8, 1e-8, None)), axis=1))
    
    print(f"After background pruning: {len(data):,} splats")
    
    # 4) Downsample to target count (importance-weighted)
    means = np.asarray(data.means)
    scales = np.asarray(data.scales)
    opacities = np.asarray(data.opacities)
    scale_geom = np.exp(np.mean(np.log(np.clip(np.abs(scales) + 1e-8, 1e-8, None)), axis=1))
    importance = opacities * scale_geom

    target = np.clip(target_splats, min_splats, min(max_splats, len(data)))
    if len(data) > target:
        top_k = np.argsort(importance)[-target:]
        data = data[top_k]
    
    print(f"After downsampling: {len(data):,} splats (target {target})")
    
    # 5) Medium gaussian size - clamp scales
    scales = np.asarray(data.scales)
    scales = np.clip(np.abs(scales), scale_clamp[0], scale_clamp[1]) * np.sign(scales)
    data.scales = scales
    
    # 6) Reduce SH to degree 1 (keep only SH0 + first 9 f_rest coefficients)
    if hasattr(data, "shN") and data.shN is not None:
        shN = np.asarray(data.shN)
        ndim = len(shN.shape)
        if ndim == 2 and shN.shape[1] > 9:
            data.shN = shN[:, :9].copy()
        elif ndim == 3 and shN.shape[1] > 3:
            data.shN = shN[:, :3, :].copy()
    
    if hasattr(data, "normalize"):
        data.normalize()
    
    # 7) Save compressed
    out_path = str(output_path)
    if compressed and not out_path.endswith(".compressed.ply"):
        out_path = out_path.replace(".ply", ".compressed.ply")
    
    save_ply_gsply(data, out_path, compressed=compressed)
    
    size_mb = Path(out_path).stat().st_size / (1024 * 1024)
    print(f"Saved to {out_path} ({size_mb:.2f} MB, compressed={compressed})")
    print("Mobile optimization complete. Use maxSplats=40000, maxSh=1 in loadSplat().")


def main():
    parser = argparse.ArgumentParser(
        description="Optimize Gaussian Splatting PLY for mobile (25k-40k splats, SH1)"
    )
    parser.add_argument("input", help="Input PLY file")
    parser.add_argument("-o", "--output", default=None, help="Output path")
    parser.add_argument(
        "--target-splats",
        type=int,
        default=32000,
        help="Target splat count (default: 32000)",
    )
    parser.add_argument(
        "--min-splats",
        type=int,
        default=25000,
        help="Minimum splats (default: 25000)",
    )
    parser.add_argument(
        "--max-splats",
        type=int,
        default=40000,
        help="Maximum splats (default: 40000)",
    )
    parser.add_argument(
        "--sh-degree",
        type=int,
        default=1,
        choices=[0, 1, 2, 3],
        help="Spherical harmonics degree (default: 1)",
    )
    parser.add_argument(
        "--opacity-threshold",
        type=float,
        default=0.01,
        help="Remove splats with opacity below this (default: 0.01)",
    )
    parser.add_argument(
        "--no-compress",
        action="store_true",
        help="Save uncompressed PLY",
    )
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")
    
    output_path = args.output or str(input_path).replace(".ply", ".mobile.ply")
    
    optimize_for_mobile(
        str(input_path),
        output_path,
        target_splats=args.target_splats,
        min_splats=args.min_splats,
        max_splats=args.max_splats,
        sh_degree=args.sh_degree,
        opacity_threshold=args.opacity_threshold,
        compressed=not args.no_compress,
    )


if __name__ == "__main__":
    main()
