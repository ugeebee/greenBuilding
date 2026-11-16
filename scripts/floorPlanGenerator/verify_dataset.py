#!/usr/bin/env python3
"""
Floor Plan Dataset Verification and Quality Assurance
===================================================
1. Validates dataset integrity: image files, YOLO label files, mask files, and COCO JSON.
2. Checks coordinate bounds (all polygon points in [0.0, 1.0]).
3. Compiles statistics and class frequencies.
4. Generates a high-resolution visual inspection montage ('preview_montage.png')
   displaying sample floor plan images side-by-side with ground-truth segmentation overlays.
"""

import sys
import json
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

CLASSES = [
    "bedroom",      # 0
    "living_room",  # 1
    "kitchen",      # 2
    "bathroom",     # 3
    "hallway",      # 4
    "balcony",      # 5
    "room",         # 6
    "door",         # 7
    "window",       # 8
    "wall",         # 9
]

OVERLAY_COLORS = {
    0: (59, 130, 246, 90),    # bedroom: blue
    1: (249, 115, 22, 90),    # living_room: orange
    2: (34, 197, 94, 90),     # kitchen: green
    3: (168, 85, 247, 90),    # bathroom: purple
    4: (234, 179, 8, 90),     # hallway: yellow
    5: (20, 184, 166, 90),    # balcony: teal
    6: (244, 63, 94, 90),     # room: rose
    7: (37, 99, 235, 180),    # door: bright blue
    8: (6, 182, 212, 180),    # window: cyan
    9: (15, 23, 42, 220),     # wall: dark slate
}


def verify_dataset(dataset_dir: Path):
    print(f"=== Verifying Dataset at {dataset_dir} ===")

    splits = ["train", "val", "test"]
    stats = {}
    all_valid = True

    total_images = 0
    total_labels = 0
    total_masks = 0
    class_instances = {c: 0 for c in range(len(CLASSES))}
    coord_errors = 0

    for split in splits:
        img_dir = dataset_dir / "images" / split
        lbl_dir = dataset_dir / "labels" / split
        msk_dir = dataset_dir / "masks" / split

        if not img_dir.exists() or not lbl_dir.exists():
            print(f"ERROR: Missing directory for split '{split}'")
            all_valid = False
            continue

        images = sorted(img_dir.glob("*.png"))
        labels = sorted(lbl_dir.glob("*.txt"))
        masks = sorted(msk_dir.glob("*.png"))

        total_images += len(images)
        total_labels += len(labels)
        total_masks += len(masks)

        print(f"\nSplit '{split}':")
        print(f"  Images: {len(images)}")
        print(f"  Labels: {len(labels)}")
        print(f"  Masks:  {len(masks)}")

        if len(images) != len(labels) or len(images) != len(masks):
            print(f"  WARNING: File count mismatch in {split}!")
            all_valid = False

        # Validate first 100 label files in each split for coordinate integrity
        for lbl_path in labels:
            text = lbl_path.read_text(encoding="utf-8").strip()
            if not text:
                continue
            for line in text.split("\n"):
                parts = line.split()
                if not parts:
                    continue
                cid = int(parts[0])
                if cid < 0 or cid >= len(CLASSES):
                    print(f"  ERROR: Invalid class ID {cid} in {lbl_path.name}")
                    all_valid = False
                class_instances[cid] += 1
                coords = [float(p) for p in parts[1:]]
                for c in coords:
                    if c < -0.01 or c > 1.01:
                        coord_errors += 1

    print("\n--- Annotation Integrity Summary ---")
    print(f"Total Images: {total_images}")
    print(f"Total Labels: {total_labels}")
    print(f"Total Masks:  {total_masks}")
    print(f"Coordinate out-of-bound errors: {coord_errors}")
    print("\nClass Instance Counts:")
    for cid, cnt in class_instances.items():
        print(f"  [{cid}] {CLASSES[cid]:12s}: {cnt:,} instances")

    # Verify COCO JSON
    coco_train = dataset_dir / "annotations" / "instances_train.json"
    if coco_train.exists():
        with open(coco_train, "r", encoding="utf-8") as f:
            cdata = json.load(f)
            print(f"\nCOCO Train JSON: {len(cdata['images'])} images, {len(cdata['annotations'])} annotations, {len(cdata['categories'])} categories")

    # Generate Visual Inspection Montage
    generate_preview_montage(dataset_dir)


def generate_preview_montage(dataset_dir: Path, output_file: str = "preview_montage.png"):
    """Creates a high-resolution 2x4 side-by-side inspection grid."""
    print("\nGenerating visual verification montage...")
    train_img_dir = dataset_dir / "images" / "train"
    train_lbl_dir = dataset_dir / "labels" / "train"

    sample_images = sorted(train_img_dir.glob("*.png"))[:4]
    if not sample_images:
        print("No images found for montage.")
        return

    tile_size = 512
    montage_w = tile_size * 2 * 2  # 2 columns of pairs (Original, Overlay)
    montage_h = tile_size * 2      # 2 rows

    montage = Image.new("RGB", (tile_size * 4, tile_size * 2), (245, 247, 250))
    montage_draw = ImageDraw.Draw(montage)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except Exception:
        font = ImageFont.load_default()
        font_sm = ImageFont.load_default()

    for idx, img_path in enumerate(sample_images):
        row = idx // 2
        col_pair = (idx % 2) * 2

        orig_img = Image.open(img_path).convert("RGBA").resize((tile_size, tile_size), Image.Resampling.LANCZOS)

        # Create overlay image
        overlay = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)

        lbl_path = train_lbl_dir / f"{img_path.stem}.txt"
        if lbl_path.exists():
            for line in lbl_path.read_text().strip().split("\n"):
                parts = line.split()
                if len(parts) < 3:
                    continue
                cid = int(parts[0])
                coords = [float(p) for p in parts[1:]]
                poly_pts = [
                    (coords[i] * tile_size, coords[i + 1] * tile_size)
                    for i in range(0, len(coords), 2)
                ]
                color = OVERLAY_COLORS.get(cid, (100, 100, 100, 100))
                overlay_draw.polygon(poly_pts, fill=color, outline=(0, 0, 0, 180))

        # Composite original with overlay
        comp = Image.alpha_composite(orig_img, overlay).convert("RGB")

        # Paste Original
        pos_orig_x = col_pair * tile_size
        pos_orig_y = row * tile_size
        montage.paste(orig_img.convert("RGB"), (pos_orig_x, pos_orig_y))
        montage_draw.text((pos_orig_x + 12, pos_orig_y + 12), f"Sample #{idx+1}: {img_path.name} (Original)", fill=(15, 23, 42), font=font)

        # Paste Annotated Overlay
        pos_ov_x = (col_pair + 1) * tile_size
        pos_ov_y = row * tile_size
        montage.paste(comp, (pos_ov_x, pos_ov_y))
        montage_draw.text((pos_ov_x + 12, pos_ov_y + 12), f"Ground Truth Segmentation Overlay", fill=(15, 23, 42), font=font)

    montage_path = dataset_dir / output_file
    montage.save(montage_path, format="PNG", optimize=True)
    print(f"Inspection montage successfully saved to: {montage_path}")


def main():
    parser = argparse.ArgumentParser(description="Verify 5000 Floor Plan Dataset")
    parser.add_argument("--dataset-dir", type=str, default="./dataset_5000", help="Dataset directory")
    args = parser.parse_args()

    d_path = Path(args.dataset_dir).resolve()
    if not d_path.exists():
        print(f"Error: Directory {d_path} does not exist.")
        sys.exit(1)

    verify_dataset(d_path)


if __name__ == "__main__":
    main()
