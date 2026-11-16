"""Backend API Floor Plan Analyzer wrapper.

Executes segmentation or hybrid detection and outputs JSON + overlay image.
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

def run_analysis(image_path: str, method: str = "segmentation", weights_path: str = None, pixels_per_meter: float = None, output_json: str = None, output_overlay: str = None):
    input_path = Path(image_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if not weights_path:
        default_weights = backend_dir / "weights" / "best.pt"
        if default_weights.exists():
            weights_path = str(default_weights)

    analysis_data = None
    overlay_path = output_overlay or str(input_path.parent / f"{input_path.stem}_overlay.png")

    # Attempt selected method with graceful fallback
    try:
        if method in ("segmentation", "yolo") and weights_path and Path(weights_path).exists():
            from floorplan_reader.segmentation.yolo_segmenter import YoloFloorPlanSegmenter
            from floorplan_reader.visualization.segmentation_visualizer import draw_styled_segmentation_overlay
            from PIL import Image

            segmenter = YoloFloorPlanSegmenter(weights_path=weights_path)
            analysis = segmenter.analyze(input_path, pixels_per_meter=pixels_per_meter)
            analysis_data = analysis.model_dump()

            # Render overlay
            orig_img = Image.open(input_path).convert("RGB")
            overlay_img = draw_styled_segmentation_overlay(orig_img, analysis)
            overlay_img.save(overlay_path)

        elif method == "hybrid":
            from floorplan_reader.detection.hybrid_analyzer import HybridFloorPlanAnalyzer
            from floorplan_reader.visualization.visualizer import visualize_floorplan
            from PIL import Image

            analyzer = HybridFloorPlanAnalyzer()
            analysis = analyzer.analyze(input_path, pixels_per_meter=pixels_per_meter)
            analysis_data = analysis.model_dump()

            orig_img = Image.open(input_path).convert("RGB")
            overlay_img = visualize_floorplan(orig_img, analysis)
            overlay_img.save(overlay_path)

        else:
            # Fallback to hybrid analyzer
            from floorplan_reader.detection.hybrid_analyzer import HybridFloorPlanAnalyzer
            from floorplan_reader.visualization.visualizer import visualize_floorplan
            from PIL import Image

            analyzer = HybridFloorPlanAnalyzer()
            analysis = analyzer.analyze(input_path, pixels_per_meter=pixels_per_meter)
            analysis_data = analysis.model_dump()

            orig_img = Image.open(input_path).convert("RGB")
            overlay_img = visualize_floorplan(orig_img, analysis)
            overlay_img.save(overlay_path)

    except Exception as e:
        # If segmentation fails (e.g. CUDA/PyTorch issue), attempt hybrid as fallback
        print(f"Warning: Primary analysis method '{method}' encountered error: {e}. Trying hybrid fallback...", file=sys.stderr)
        try:
            from floorplan_reader.detection.hybrid_analyzer import HybridFloorPlanAnalyzer
            from floorplan_reader.visualization.visualizer import visualize_floorplan
            from PIL import Image

            analyzer = HybridFloorPlanAnalyzer()
            analysis = analyzer.analyze(input_path, pixels_per_meter=pixels_per_meter)
            analysis_data = analysis.model_dump()

            orig_img = Image.open(input_path).convert("RGB")
            overlay_img = visualize_floorplan(orig_img, analysis)
            overlay_img.save(overlay_path)
        except Exception as e2:
            print(f"Error in hybrid fallback: {e2}", file=sys.stderr)
            raise

    # Encode overlay image as base64
    overlay_b64 = ""
    if os.path.exists(overlay_path):
        with open(overlay_path, "rb") as f:
            overlay_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")

    result = {
        "status": "success",
        "method_used": method,
        "analysis": analysis_data,
        "overlay_base64": overlay_b64,
        "overlay_path": overlay_path,
    }

    if output_json:
        with open(output_json, "w") as f:
            json.dump(result, f, indent=2)

    return result

def main():
    parser = argparse.ArgumentParser(description="Floor Plan Analyzer API Bridge")
    parser.add_argument("--image", required=True, help="Input floor plan image path")
    parser.add_argument("--method", default="segmentation", choices=["segmentation", "hybrid", "yolo"])
    parser.add_argument("--weights_path", default=None, help="Weights path")
    parser.add_argument("--pixels_per_meter", type=float, default=None)
    parser.add_argument("--output_json", default=None)
    parser.add_argument("--output_overlay", default=None)
    args = parser.parse_args()

    res = run_analysis(
        image_path=args.image,
        method=args.method,
        weights_path=args.weights_path,
        pixels_per_meter=args.pixels_per_meter,
        output_json=args.output_json,
        output_overlay=args.output_overlay,
    )
    print(json.dumps({"status": "success", "total_rooms": res["analysis"]["metadata"]["total_rooms"]}))

if __name__ == "__main__":
    main()

