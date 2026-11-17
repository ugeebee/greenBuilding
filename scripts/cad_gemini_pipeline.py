#!/usr/bin/env python3
"""CAD to Gemini Auto-Annotation and YOLO Training Pipeline.

Processes AutoCAD .dwg plans, classifies floor plans vs non-floor plans via Gemini,
extracts 2D bounding box annotations, builds a YOLOv8 dataset, and fine-tunes
the architectural model.

Storage:
- CAD Inputs: /media/utkarsh/New Volume/AutoCAD PLans/
- Working Dir (PNGs, Dataset, Runs): /media/utkarsh/Utkarsh/greenBuilding/
- Final Target Weights: /home/utkarsh/Desktop/greenBuilding/backend/weights/best.pt
"""

import os
import sys
import time
import json
import re
import shutil
import base64
import random
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add external packages directory to sys.path
EXTERNAL_PACKAGES = Path("/media/utkarsh/Utkarsh/greenBuilding/packages")
if str(EXTERNAL_PACKAGES) not in sys.path:
    sys.path.insert(0, str(EXTERNAL_PACKAGES))

EXTERNAL_LIB = Path("/media/utkarsh/Utkarsh/greenBuilding/lib")
if EXTERNAL_LIB.exists():
    curr_ld = os.environ.get("LD_LIBRARY_PATH", "")
    if str(EXTERNAL_LIB) not in curr_ld:
        os.environ["LD_LIBRARY_PATH"] = f"{EXTERNAL_LIB}:{curr_ld}"

# Enable Aspose CAD runtime
os.environ["DOTNET_SYSTEM_GLOBALIZATION_INVARIANT"] = "1"

import requests
from PIL import Image

# Directory configurations
SOURCE_CAD_DIR = Path("/media/utkarsh/New Volume/AutoCAD PLans")
EXTERNAL_WORK_DIR = Path("/media/utkarsh/Utkarsh/greenBuilding")
PNG_DIR = EXTERNAL_WORK_DIR / "converted_pngs"
DATASET_DIR = EXTERNAL_WORK_DIR / "dataset"
RUNS_DIR = EXTERNAL_WORK_DIR / "runs"
TARGET_WEIGHTS_DIR = Path("/home/utkarsh/Desktop/greenBuilding/backend/weights")

CLASS_MAPPING = {
    "bedroom": 0,
    "living_room": 1,
    "kitchen": 2,
    "bathroom": 3,
    "hallway": 4,
    "balcony": 5,
    "room": 6,
    "door": 7,
    "window": 8,
    "wall": 9,
}

CLASS_NAMES = [
    "bedroom",
    "living_room",
    "kitchen",
    "bathroom",
    "hallway",
    "balcony",
    "room",
    "door",
    "window",
    "wall",
]


def load_gemini_api_key() -> str:
    """Retrieve Gemini API key from environment or backend/.env files."""
    key = os.getenv("GEMINI_API_KEY")
    if key:
        return key.strip().strip("'\"")

    env_paths = [
        Path("/home/utkarsh/Desktop/greenBuilding/backend/.env"),
        Path("/home/utkarsh/Desktop/greenBuilding/backend/.env.development"),
        Path("/home/utkarsh/Desktop/greenBuilding/.env"),
    ]
    for ep in env_paths:
        if ep.exists():
            for line in ep.read_text().splitlines():
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    val = line.split("=", 1)[1].strip().strip("'\"")
                    if val and val != "your_key_here":
                        return val
    return ""


def convert_dwg_to_png(dwg_path: Path, png_path: Path, max_dim: int = 1024) -> bool:
    """Convert an AutoCAD .dwg file to high-resolution PNG using aspose.cad."""
    if png_path.exists() and png_path.stat().st_size > 1000:
        return True

    try:
        import aspose.cad as cad
        from aspose.cad.imageoptions import PngOptions, CadRasterizationOptions

        image = cad.Image.load(str(dwg_path))
        raster_options = CadRasterizationOptions()
        raster_options.page_width = float(max_dim)
        raster_options.page_height = float(max_dim)
        raster_options.background_color = cad.Color.white

        options = PngOptions()
        options.vector_rasterization_options = raster_options

        png_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(str(png_path), options)
        return png_path.exists() and png_path.stat().st_size > 1000
    except Exception as e:
        print(f"[DWG Conversion Error] {dwg_path.name}: {e}", file=sys.stderr)
        return False


def call_gemini_api(api_key: str, prompt: str, image_path: Optional[Path] = None, model: str = "gemini-flash-lite-latest") -> str:
    """Execute Gemini REST API call with retries and rate limit safety."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    parts = [{"text": prompt}]

    if image_path and image_path.exists():
        with open(image_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")
        parts.append({"inline_data": {"mime_type": "image/png", "data": b64_data}})

    payload = {"contents": [{"parts": parts}]}
    headers = {"Content-Type": "application/json"}

    for attempt in range(4):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            elif resp.status_code in (429, 503):
                # Rate limit / busy: back off exponentially
                time.sleep(5.0 * (attempt + 1))
            else:
                print(f"[Gemini API HTTP {resp.status_code}] {resp.text[:120]}", file=sys.stderr)
                time.sleep(3.0)
        except Exception as e:
            time.sleep(3.0)

    return ""


def classify_drawing_with_gemini(api_key: str, png_path: Path) -> Dict[str, Any]:
    """Ask Gemini whether this drawing is a valid architectural floor plan."""
    prompt = (
        "Analyze this architectural drawing image.\n"
        "Determine if this is a 2D floor plan suitable for training an architectural room/opening detection model.\n"
        "Floor plans are overhead horizontal cut views showing interior room layouts, walls, doors, and windows.\n"
        "Drawings that are NOT floor plans include: site plans, building elevations, cross-sections, structural details, electrical, or plumbing diagrams.\n\n"
        "Respond ONLY with a JSON object in this format:\n"
        "{\n"
        '  "is_floor_plan": true,\n'
        '  "drawing_type": "residential_floor_plan",\n'
        '  "usable_for_training": true,\n'
        '  "reason": "Clear overhead layout showing rooms, doors, and walls"\n'
        "}"
    )

    txt = call_gemini_api(api_key, prompt, png_path)
    match = re.search(r"\{.*\}", txt, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return {
        "is_floor_plan": False,
        "drawing_type": "unknown",
        "usable_for_training": False,
        "reason": "Could not parse JSON",
    }


def annotate_floorplan_with_gemini(api_key: str, png_path: Path) -> List[Dict[str, Any]]:
    """Prompt Gemini to detect bounding boxes for rooms, doors, and windows."""
    prompt = (
        "You are an expert architectural blueprint vision model.\n"
        "Detect all rooms, doors, and windows in this 2D architectural floor plan drawing.\n"
        "For each detected element, output:\n"
        "- 'label': must be one of ['bedroom', 'living_room', 'kitchen', 'bathroom', 'hallway', 'balcony', 'room', 'door', 'window', 'wall']\n"
        "- 'box_2d': [ymin, xmin, ymax, xmax] normalized on a 0 to 1000 scale.\n\n"
        "Respond ONLY with a JSON array:\n"
        "[\n"
        '  {"label": "bedroom", "box_2d": [150, 100, 450, 500]},\n'
        '  {"label": "door", "box_2d": [440, 250, 470, 310]}\n'
        "]"
    )

    txt = call_gemini_api(api_key, prompt, png_path)
    match = re.search(r"\[.*\]", txt, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return []


def gemini_box_to_yolo_line(label: str, box_2d: List[int]) -> Optional[str]:
    """Convert [ymin, xmin, ymax, xmax] (0-1000 scale) to YOLOv8-seg 4-corner polygon format."""
    normalized_label = label.lower().strip()
    class_id = CLASS_MAPPING.get(normalized_label)
    if class_id is None:
        if "bed" in normalized_label:
            class_id = 0
        elif "living" in normalized_label or "hall" in normalized_label:
            class_id = 1
        elif "kitchen" in normalized_label:
            class_id = 2
        elif "bath" in normalized_label or "toilet" in normalized_label or "wc" in normalized_label:
            class_id = 3
        elif "door" in normalized_label:
            class_id = 7
        elif "win" in normalized_label:
            class_id = 8
        elif "wall" in normalized_label:
            class_id = 9
        else:
            class_id = 6

    if len(box_2d) != 4:
        return None

    ymin, xmin, ymax, xmax = [float(v) for v in box_2d]
    ymin = max(0.0, min(1000.0, ymin)) / 1000.0
    ymax = max(0.0, min(1000.0, ymax)) / 1000.0
    xmin = max(0.0, min(1000.0, xmin)) / 1000.0
    xmax = max(0.0, min(1000.0, xmax)) / 1000.0

    w = xmax - xmin
    h = ymax - ymin

    if w <= 0.005 or h <= 0.005:
        return None

    # YOLOv8-seg expects polygon points: x1 y1 x2 y2 x3 y3 x4 y4 (clockwise)
    x1, y1 = xmin, ymin
    x2, y2 = xmax, ymin
    x3, y3 = xmax, ymax
    x4, y4 = xmin, ymax

    return f"{class_id} {x1:.6f} {y1:.6f} {x2:.6f} {y2:.6f} {x3:.6f} {y3:.6f} {x4:.6f} {y4:.6f}"


def build_augmented_dataset(annotations_map: Dict[str, List[str]]) -> Path:
    """Construct YOLO train/val dataset structure with augmentations."""
    train_img_dir = DATASET_DIR / "images" / "train"
    train_lbl_dir = DATASET_DIR / "labels" / "train"
    val_img_dir = DATASET_DIR / "images" / "val"
    val_lbl_dir = DATASET_DIR / "labels" / "val"

    for d in [train_img_dir, train_lbl_dir, val_img_dir, val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)

    items = list(annotations_map.items())
    random.seed(42)
    random.shuffle(items)

    val_count = max(1, int(len(items) * 0.15))
    val_items = items[:val_count]
    train_items = items[val_count:]

    print(f"\n[Dataset] Splitting {len(items)} plans: {len(train_items)} train, {len(val_items)} val")

    def rotate_polygon(line: str, angle: int) -> str:
        parts = line.strip().split()
        cid = parts[0]
        coords = [float(v) for v in parts[1:]]
        pts = [(coords[i], coords[i + 1]) for i in range(0, len(coords), 2)]
        if angle == 90:
            new_pts = [(1.0 - y, x) for x, y in pts]
        elif angle == 180:
            new_pts = [(1.0 - x, 1.0 - y) for x, y in pts]
        elif angle == 270:
            new_pts = [(y, 1.0 - x) for x, y in pts]
        else:
            new_pts = pts
        flat = " ".join(f"{x:.6f} {y:.6f}" for x, y in new_pts)
        return f"{cid} {flat}"

    for png_name, lines in val_items:
        src_png = PNG_DIR / png_name
        if not src_png.exists():
            continue
        shutil.copy(src_png, val_img_dir / png_name)
        lbl_file = val_lbl_dir / (Path(png_name).stem + ".txt")
        lbl_file.write_text("\n".join(lines))

    for png_name, lines in train_items:
        src_png = PNG_DIR / png_name
        if not src_png.exists():
            continue

        base_stem = Path(png_name).stem
        orig_img = Image.open(src_png)

        for angle in [0, 90, 180, 270]:
            aug_name = f"{base_stem}_rot{angle}.png"
            aug_lbl = f"{base_stem}_rot{angle}.txt"

            if angle == 0:
                orig_img.save(train_img_dir / aug_name)
                (train_lbl_dir / aug_lbl).write_text("\n".join(lines))
            else:
                rot_img = orig_img.rotate(-angle, expand=True)
                rot_img.save(train_img_dir / aug_name)
                rot_lines = [rotate_polygon(l, angle) for l in lines]
                (train_lbl_dir / aug_lbl).write_text("\n".join(rot_lines))

    data_yaml_path = DATASET_DIR / "data.yaml"
    yaml_content = f"""path: {DATASET_DIR.as_posix()}
train: images/train
val: images/val
names:
"""
    for i, name in enumerate(CLASS_NAMES):
        yaml_content += f"  {i}: {name}\n"

    data_yaml_path.write_text(yaml_content)
    print(f"[Dataset] data.yaml created at {data_yaml_path}")
    return data_yaml_path


def run_pipeline():
    """Execute the full end-to-end autonomous pipeline."""
    print("=" * 70)
    print("🌿 CAD to Gemini Auto-Annotation & YOLO Training Pipeline")
    print("=" * 70)

    api_key = load_gemini_api_key()
    if not api_key:
        print("❌ Error: GEMINI_API_KEY not found in backend/.env or environment.")
        sys.exit(1)

    print("✅ Gemini API Key authenticated.")

    # Step 1: Convert all DWG files to PNG
    dwg_files = sorted(list(SOURCE_CAD_DIR.glob("*.dwg")) + list(SOURCE_CAD_DIR.glob("*.DWG")))
    print(f"\n📂 Step 1: Converting {len(dwg_files)} AutoCAD files to PNG...")
    PNG_DIR.mkdir(parents=True, exist_ok=True)

    converted_count = 0
    for idx, dwg in enumerate(dwg_files, 1):
        safe_name = re.sub(r"[^\w\-_.]", "_", dwg.stem) + ".png"
        target_png = PNG_DIR / safe_name
        if target_png.exists():
            converted_count += 1
            continue

        print(f"[{idx}/{len(dwg_files)}] Converting: {dwg.name} -> {safe_name}")
        if convert_dwg_to_png(dwg, target_png):
            converted_count += 1

    print(f"✅ Converted {converted_count}/{len(dwg_files)} CAD files into PNG images.")

    # Step 2: Classify Drawings with Gemini
    classifications_file = EXTERNAL_WORK_DIR / "gemini_classifications.json"
    classifications: Dict[str, Any] = {}
    if classifications_file.exists():
        try:
            classifications = json.loads(classifications_file.read_text())
        except Exception:
            classifications = {}

    png_files = sorted(list(PNG_DIR.glob("*.png")))
    print(f"\n🧠 Step 2: Classifying {len(png_files)} drawings using Gemini...")

    for idx, png_p in enumerate(png_files, 1):
        if png_p.name in classifications:
            continue

        print(f"[{idx}/{len(png_files)}] Classifying with Gemini: {png_p.name}...")
        res = classify_drawing_with_gemini(api_key, png_p)
        classifications[png_p.name] = res
        classifications_file.write_text(json.dumps(classifications, indent=2))
        time.sleep(3.5)  # 15 RPM rate limit safety

    usable_floorplans = [
        k for k, v in classifications.items()
        if v.get("is_floor_plan") is True
    ]
    print(f"✅ Classification complete! Found {len(usable_floorplans)} verified floor plans suitable for training.")

    # Step 3: Annotate Floor Plans with Gemini
    annotations_file = EXTERNAL_WORK_DIR / "gemini_annotations.json"
    raw_annotations: Dict[str, Any] = {}
    if annotations_file.exists():
        try:
            raw_annotations = json.loads(annotations_file.read_text())
        except Exception:
            raw_annotations = {}

    print(f"\n🏷️ Step 3: Auto-annotating {len(usable_floorplans)} floor plans with Gemini...")
    yolo_labels_map: Dict[str, List[str]] = {}

    for idx, png_name in enumerate(usable_floorplans, 1):
        png_p = PNG_DIR / png_name
        if not png_p.exists():
            continue

        if png_name not in raw_annotations or not raw_annotations[png_name]:
            print(f"[{idx}/{len(usable_floorplans)}] Grounding annotations: {png_name}...")
            boxes = annotate_floorplan_with_gemini(api_key, png_p)
            raw_annotations[png_name] = boxes
            annotations_file.write_text(json.dumps(raw_annotations, indent=2))
            time.sleep(3.5)
        else:
            boxes = raw_annotations[png_name]

        yolo_lines = []
        for b in boxes:
            lbl = b.get("label", "room")
            coords = b.get("box_2d", [])
            line = gemini_box_to_yolo_line(lbl, coords)
            if line:
                yolo_lines.append(line)

        if yolo_lines:
            yolo_labels_map[png_name] = yolo_lines

    print(f"✅ Generated YOLO annotations for {len(yolo_labels_map)} blueprints.")

    # Step 4: Build Augmented YOLO Dataset
    print("\n📦 Step 4: Building augmented dataset (4-way rotations)...")
    data_yaml = build_augmented_dataset(yolo_labels_map)

    # Step 5: Train YOLOv8
    print("\n🏋️ Step 5: Starting YOLO fine-tuning...")
    try:
        from ultralytics import YOLO
        import torch

        base_weights = TARGET_WEIGHTS_DIR / "best.pt"
        if not base_weights.exists():
            base_weights = "yolov8s.pt"
        else:
            base_weights = str(base_weights)

        device_target = 0 if torch.cuda.is_available() else "cpu"
        print(f"[Training] Using compute device: {device_target}")

        model = YOLO(base_weights)
        train_results = model.train(
            data=str(data_yaml),
            epochs=30,
            imgsz=640,
            batch=8,
            device=device_target,
            project=str(RUNS_DIR),
            name="cad_gemini_finetune",
            save=True,
            verbose=True,
        )

        trained_best = RUNS_DIR / "cad_gemini_finetune" / "weights" / "best.pt"
        if trained_best.exists():
            backup_weights = TARGET_WEIGHTS_DIR / "best_previous.pt"
            current_best = TARGET_WEIGHTS_DIR / "best.pt"
            if current_best.exists():
                shutil.copy(current_best, backup_weights)
            shutil.copy(trained_best, current_best)
            print(f"🎉 SUCCESS! Fine-tuned weights deployed to {current_best} (backup saved as best_previous.pt)")

    except Exception as e:
        print(f"Training error: {e}", file=sys.stderr)

    print("\n🎉 ALL PIPELINE STEPS COMPLETED!")


if __name__ == "__main__":
    run_pipeline()
