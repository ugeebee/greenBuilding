#!/usr/bin/env python3
"""
Architectural Floor Plan Dataset Generator
=========================================
Generates a comprehensive dataset of 5,000 diverse, architecturally valid floor plan
PNG images along with multi-format computer vision annotations:
- YOLOv8/v11 instance segmentation polygon annotations
- YOLO object detection bounding boxes
- COCO JSON format instances
- 8-bit semantic segmentation masks
- Rich architectural metadata (dimensions, schedules, areas)
- Out-of-the-box data.yaml configuration
"""

import os
import sys
import math
import json
import random
import argparse
import time
from pathlib import Path
from typing import List, Dict, Tuple, Any, Optional
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageDraw, ImageFont

# ==============================================================================
# 1. TAXONOMY & COLOR PALETTES
# ==============================================================================

# Standard 10-class architectural floor plan hierarchy
CLASSES = [
    "bedroom",      # 0
    "living_room",  # 1
    "kitchen",      # 2
    "bathroom",     # 3
    "hallway",      # 4
    "balcony",      # 5
    "room",         # 6 (office, dining, study, generic)
    "door",         # 7
    "window",       # 8
    "wall",         # 9 (structural walls)
]

CLASS_TO_ID = {name: i for i, name in enumerate(CLASSES)}

# Semantic segmentation mask color palette (RGB)
MASK_PALETTE = {
    0: (147, 197, 253),  # bedroom: soft blue
    1: (254, 215, 170),  # living_room: soft amber
    2: (187, 247, 208),  # kitchen: soft green
    3: (233, 213, 255),  # bathroom: soft purple
    4: (254, 240, 138),  # hallway: soft yellow
    5: (167, 243, 208),  # balcony: soft emerald
    6: (254, 205, 211),  # room (office/dining): soft rose
    7: (37, 99, 235),    # door: vibrant blue
    8: (14, 165, 233),   # window: cyan
    9: (30, 41, 59),     # wall: dark slate
    255: (255, 255, 255),# background: white
}

# Architectural rendering themes
THEMES = {
    "cad_light": {
        "bg": (255, 255, 255),
        "room_fill": (255, 255, 255),
        "wall_fill": (30, 41, 59),       # slate-800
        "wall_stroke": (15, 23, 42),     # slate-900
        "wall_hatch": (71, 85, 105),     # slate-600
        "door_leaf": (37, 99, 235),      # blue-600
        "door_arc": (148, 163, 184),     # slate-400
        "window_sill": (148, 163, 184),  # slate-400
        "window_glass": (2, 132, 199),    # sky-600
        "dim_line": (100, 116, 139),     # slate-500
        "text": (30, 41, 59),
        "grid": (241, 245, 249),         # slate-100
    },
    "blueprint": {
        "bg": (15, 35, 75),              # deep blueprint navy
        "room_fill": (18, 42, 90),
        "wall_fill": (29, 78, 216),      # blue-700
        "wall_stroke": (255, 255, 255),  # white
        "wall_hatch": (59, 130, 246),
        "door_leaf": (255, 255, 255),
        "door_arc": (147, 197, 253),
        "window_sill": (255, 255, 255),
        "window_glass": (56, 189, 248),
        "dim_line": (191, 219, 254),
        "text": (255, 255, 255),
        "grid": (24, 52, 110),
    },
    "high_contrast_bw": {
        "bg": (255, 255, 255),
        "room_fill": (255, 255, 255),
        "wall_fill": (0, 0, 0),          # pure black
        "wall_stroke": (0, 0, 0),
        "wall_hatch": (50, 50, 50),
        "door_leaf": (0, 0, 0),
        "door_arc": (120, 120, 120),
        "window_sill": (0, 0, 0),
        "window_glass": (80, 80, 80),
        "dim_line": (70, 70, 70),
        "text": (0, 0, 0),
        "grid": (230, 230, 230),
    },
}

# ==============================================================================
# 2. ARCHITECTURAL DATA STRUCTURES
# ==============================================================================

class Opening:
    def __init__(
        self,
        id_str: str,
        op_type: str,  # 'door' or 'window'
        wall: str,     # 'N', 'S', 'E', 'W'
        pos: float,    # meters from wall start
        width: float,  # meters
        flip_hinge: bool = False,
        flip_swing: bool = False,
    ):
        self.id = id_str
        self.op_type = op_type
        self.wall = wall
        self.pos = pos
        self.width = width
        self.flip_hinge = flip_hinge
        self.flip_swing = flip_swing

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.op_type,
            "wall": self.wall,
            "position": round(self.pos, 2),
            "width": round(self.width, 2),
            "flipHinge": self.flip_hinge,
            "flipSwing": self.flip_swing,
        }


class Room:
    def __init__(
        self,
        id_str: str,
        name: str,
        room_type: str,
        x: float,
        y: float,
        breadth: float,
        length: float,
        openings: Optional[List[Opening]] = None,
    ):
        self.id = id_str
        self.name = name
        self.room_type = room_type
        self.x = x
        self.y = y
        self.breadth = breadth
        self.length = length
        self.openings = openings or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.room_type,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "breadth": round(self.breadth, 2),
            "length": round(self.length, 2),
            "openings": [op.to_dict() for op in self.openings],
        }


class FloorPlan:
    def __init__(
        self,
        name: str,
        rooms: List[Room],
        ext_wall_thick: float = 0.20,
        int_wall_thick: float = 0.10,
    ):
        self.name = name
        self.rooms = rooms
        self.ext_wall_thick = ext_wall_thick
        self.int_wall_thick = int_wall_thick

    def get_bounds(self) -> Tuple[float, float, float, float]:
        """Returns (min_x, min_y, max_x, max_y) of room bounding envelope."""
        min_x = min(r.x for r in self.rooms)
        min_y = min(r.y for r in self.rooms)
        max_x = max(r.x + r.breadth for r in self.rooms)
        max_y = max(r.y + r.length for r in self.rooms)
        return min_x, min_y, max_x, max_y


# ==============================================================================
# 3. PROCEDURAL FLOOR PLAN SYNTHESIS ENGINES
# ==============================================================================

def generate_studio_layout(rng: random.Random) -> FloorPlan:
    """Generates a modern studio flat layout."""
    ext_t = rng.choice([0.20, 0.22, 0.25])
    int_t = rng.choice([0.10, 0.12])

    main_w = rng.uniform(5.0, 7.2)
    main_h = rng.uniform(4.0, 5.5)

    bath_w = rng.uniform(2.0, 2.6)
    bath_h = rng.uniform(1.8, 2.4)

    kit_w = main_w - bath_w
    kit_h = bath_h

    rooms = []

    # Main studio living/sleeping room
    st_ops = [
        Opening("st_entry", "door", "W", rng.uniform(0.5, 1.2), 0.95),
        Opening("st_win1", "window", "N", rng.uniform(0.8, main_w * 0.4), rng.uniform(1.6, 2.4)),
        Opening("st_win2", "window", "E", rng.uniform(0.8, main_h * 0.5), rng.uniform(1.4, 2.0)),
    ]
    rooms.append(Room("rm_main", "Studio Living & Bed", "living_room", 0.0, 0.0, main_w, main_h, st_ops))

    # Kitchenette
    k_ops = [
        Opening("k_win", "window", "S", rng.uniform(0.6, kit_w - 1.6), rng.uniform(1.2, 1.6)),
    ]
    rooms.append(Room("rm_kit", "Kitchenette", "kitchen", 0.0, main_h, kit_w, kit_h, k_ops))

    # Bathroom
    b_ops = [
        Opening("b_door", "door", "N", rng.uniform(0.3, bath_w - 1.0), 0.75, flip_swing=True),
        Opening("b_win", "window", "S", rng.uniform(0.4, bath_w - 1.2), 0.8),
    ]
    rooms.append(Room("rm_bath", "Bathroom", "bathroom", kit_w, main_h, bath_w, bath_h, b_ops))

    return FloorPlan(f"Studio Flat #{rng.randint(100, 999)}", rooms, ext_t, int_t)


def generate_1bhk_layout(rng: random.Random) -> FloorPlan:
    """Generates an urban 1-BHK apartment layout."""
    ext_t = rng.choice([0.20, 0.22, 0.25])
    int_t = rng.choice([0.10, 0.12])

    liv_w = rng.uniform(4.8, 6.2)
    liv_h = rng.uniform(4.0, 5.0)

    bed_w = rng.uniform(3.8, 4.8)
    bed_h = rng.uniform(3.5, 4.2)

    kit_w = rng.uniform(2.8, 3.6)
    kit_h = rng.uniform(2.4, 3.2)

    bath_w = liv_w - kit_w
    bath_h = kit_h

    balc_w = bed_w
    balc_h = rng.uniform(1.6, 2.2)

    rooms = []

    # Living & Dining
    liv_ops = [
        Opening("liv_entry", "door", "W", rng.uniform(0.6, 1.2), 1.0),
        Opening("liv_w1", "window", "N", rng.uniform(1.0, liv_w * 0.5), rng.uniform(1.8, 2.4)),
        Opening("liv_bed_d", "door", "E", rng.uniform(0.6, min(liv_h, bed_h) - 1.1), 0.9, flip_swing=True),
    ]
    rooms.append(Room("rm_liv", "Living & Dining", "living_room", 0.0, 0.0, liv_w, liv_h, liv_ops))

    # Master Bedroom
    bed_ops = [
        Opening("bed_w1", "window", "N", rng.uniform(0.8, bed_w - 2.0), rng.uniform(1.6, 2.2)),
        Opening("bed_w2", "window", "E", rng.uniform(0.8, bed_h - 1.8), rng.uniform(1.2, 1.8)),
    ]
    rooms.append(Room("rm_bed", "Master Bedroom", "bedroom", liv_w, 0.0, bed_w, bed_h, bed_ops))

    # Kitchen
    kit_ops = [
        Opening("k_door", "door", "N", rng.uniform(0.5, kit_w - 1.1), 0.85, flip_swing=True),
        Opening("k_win", "window", "S", rng.uniform(0.6, kit_w - 1.6), rng.uniform(1.2, 1.6)),
    ]
    rooms.append(Room("rm_kit", "Kitchen", "kitchen", 0.0, liv_h, kit_w, kit_h, kit_ops))

    # Bathroom
    bath_ops = [
        Opening("bath_d", "door", "N", rng.uniform(0.4, bath_w - 1.0), 0.75, flip_swing=True),
        Opening("bath_w", "window", "S", rng.uniform(0.4, bath_w - 1.1), 0.8),
    ]
    rooms.append(Room("rm_bath", "Bathroom", "bathroom", kit_w, liv_h, bath_w, bath_h, bath_ops))

    # Balcony attached to Bedroom
    balc_ops = [
        Opening("balc_w", "window", "E", rng.uniform(0.4, balc_h - 0.6), rng.uniform(1.2, 2.0)),
        Opening("balc_d", "door", "N", rng.uniform(0.8, balc_w - 1.2), 0.9),
    ]
    rooms.append(Room("rm_balc", "Balcony", "balcony", liv_w, bed_h, balc_w, balc_h, balc_ops))

    return FloorPlan(f"1-BHK Residence #{rng.randint(100, 999)}", rooms, ext_t, int_t)


def generate_2bhk_layout(rng: random.Random) -> FloorPlan:
    """Generates a contemporary 2-BHK apartment layout."""
    ext_t = rng.choice([0.20, 0.22, 0.25])
    int_t = rng.choice([0.10, 0.12])

    liv_w = rng.uniform(5.5, 7.0)
    liv_h = rng.uniform(4.2, 5.2)

    mb_w = rng.uniform(4.2, 5.2)
    mb_h = liv_h

    kit_w = rng.uniform(2.8, 3.6)
    kit_h = rng.uniform(3.0, 3.8)

    cbath_w = rng.uniform(1.8, 2.2)
    cbath_h = kit_h

    b2_w = liv_w - kit_w - cbath_w
    b2_h = kit_h

    es_w = rng.uniform(2.0, 2.6)
    es_h = kit_h * 0.75

    rooms = []

    # Living & Dining
    liv_ops = [
        Opening("main_door", "door", "W", rng.uniform(0.6, 1.2), 1.05),
        Opening("liv_w", "window", "N", rng.uniform(1.2, liv_w * 0.6), rng.uniform(2.0, 2.8)),
        Opening("d_mb", "door", "E", rng.uniform(0.8, mb_h - 1.2), 0.9, flip_swing=True),
    ]
    rooms.append(Room("rm_liv", "Living & Dining Room", "living_room", 0.0, 0.0, liv_w, liv_h, liv_ops))

    # Master Bedroom
    mb_ops = [
        Opening("mb_wn", "window", "N", rng.uniform(1.0, mb_w - 2.0), rng.uniform(1.8, 2.4)),
        Opening("mb_we", "window", "E", rng.uniform(1.0, mb_h - 2.0), rng.uniform(1.4, 2.0)),
        Opening("mb_es_d", "door", "S", rng.uniform(0.4, min(mb_w, es_w) - 0.9), 0.8, flip_swing=True),
    ]
    rooms.append(Room("rm_mb", "Master Suite", "bedroom", liv_w, 0.0, mb_w, mb_h, mb_ops))

    # Kitchen
    kit_ops = [
        Opening("k_d", "door", "N", rng.uniform(0.5, kit_w - 1.0), 0.85, flip_swing=True),
        Opening("k_w", "window", "W", rng.uniform(0.6, kit_h - 1.6), rng.uniform(1.2, 1.6)),
        Opening("k_s", "window", "S", rng.uniform(0.5, kit_w - 1.4), rng.uniform(1.0, 1.4)),
    ]
    rooms.append(Room("rm_kit", "Kitchen & Utility", "kitchen", 0.0, liv_h, kit_w, kit_h, kit_ops))

    # Common Bath
    cbath_ops = [
        Opening("cb_d", "door", "N", rng.uniform(0.3, cbath_w - 0.9), 0.75, flip_swing=True),
        Opening("cb_w", "window", "S", rng.uniform(0.4, cbath_w - 1.0), 0.8),
    ]
    rooms.append(Room("rm_cbath", "Common Restroom", "bathroom", kit_w, liv_h, cbath_w, cbath_h, cbath_ops))

    # Bedroom 2
    b2_ops = [
        Opening("b2_d", "door", "N", rng.uniform(0.3, b2_w - 1.1), 0.85, flip_swing=True),
        Opening("b2_w", "window", "S", rng.uniform(0.8, b2_w - 1.8), rng.uniform(1.6, 2.2)),
    ]
    rooms.append(Room("rm_bed2", "Guest Bedroom", "bedroom", kit_w + cbath_w, liv_h, b2_w, b2_h, b2_ops))

    # En-suite Bath
    es_ops = [
        Opening("es_w", "window", "S", rng.uniform(0.4, es_w - 1.0), 0.8),
    ]
    rooms.append(Room("rm_es", "En-Suite Bath", "bathroom", liv_w, mb_h, es_w, es_h, es_ops))

    return FloorPlan(f"2-BHK Apartment #{rng.randint(100, 999)}", rooms, ext_t, int_t)


def generate_3bhk_layout(rng: random.Random) -> FloorPlan:
    """Generates an executive 3-BHK luxury apartment."""
    ext_t = rng.choice([0.20, 0.25])
    int_t = rng.choice([0.10, 0.12])

    foyer_w = rng.uniform(2.2, 3.0)
    liv_w = rng.uniform(5.5, 7.2)
    din_w = rng.uniform(3.5, 4.5)
    total_w1 = foyer_w + liv_w + din_w
    top_h = rng.uniform(4.5, 5.5)

    mb_w = rng.uniform(4.5, 5.5)
    mb_h = rng.uniform(4.0, 5.0)

    b2_w = rng.uniform(3.8, 4.6)
    b2_h = mb_h

    b3_w = total_w1 - mb_w - b2_w
    b3_h = mb_h

    kit_w = din_w
    kit_h = rng.uniform(3.0, 3.8)

    rooms = []

    # Entry Foyer
    rooms.append(Room(
        "rm_foyer", "Entrance Foyer", "hallway", 0.0, 0.0, foyer_w, top_h,
        [Opening("f_main", "door", "W", rng.uniform(0.6, top_h - 1.4), 1.1)]
    ))

    # Formal Living Room
    rooms.append(Room(
        "rm_liv", "Great Living Room", "living_room", foyer_w, 0.0, liv_w, top_h,
        [Opening("liv_w", "window", "N", rng.uniform(1.2, liv_w - 2.4), rng.uniform(2.2, 3.2))]
    ))

    # Dining Hall
    rooms.append(Room(
        "rm_din", "Dining Hall", "room", foyer_w + liv_w, 0.0, din_w, top_h,
        [Opening("din_w", "window", "N", rng.uniform(0.8, din_w - 1.8), rng.uniform(1.6, 2.2))]
    ))

    # Master Bedroom
    rooms.append(Room(
        "rm_mb", "Master Suite", "bedroom", 0.0, top_h, mb_w, mb_h,
        [
            Opening("mb_d", "door", "N", rng.uniform(0.4, mb_w - 1.2), 0.9, flip_swing=True),
            Opening("mb_w1", "window", "W", rng.uniform(1.0, mb_h - 2.0), rng.uniform(1.8, 2.4)),
            Opening("mb_w2", "window", "S", rng.uniform(1.0, mb_w - 2.0), rng.uniform(1.8, 2.4)),
        ]
    ))

    # Bedroom 2
    rooms.append(Room(
        "rm_b2", "Bedroom 2", "bedroom", mb_w, top_h, b2_w, b2_h,
        [
            Opening("b2_d", "door", "N", rng.uniform(0.4, b2_w - 1.2), 0.85, flip_swing=True),
            Opening("b2_w", "window", "S", rng.uniform(0.8, b2_w - 1.8), rng.uniform(1.6, 2.2)),
        ]
    ))

    # Bedroom 3
    rooms.append(Room(
        "rm_b3", "Guest Suite", "bedroom", mb_w + b2_w, top_h, b3_w, b3_h,
        [
            Opening("b3_d", "door", "N", rng.uniform(0.4, b3_w - 1.2), 0.85, flip_swing=True),
            Opening("b3_w1", "window", "E", rng.uniform(1.0, b3_h - 2.0), rng.uniform(1.6, 2.2)),
            Opening("b3_w2", "window", "S", rng.uniform(0.8, b3_w - 1.8), rng.uniform(1.4, 2.0)),
        ]
    ))

    # Kitchen below dining
    rooms.append(Room(
        "rm_kit", "Chef's Kitchen", "kitchen", foyer_w + liv_w, top_h + mb_h, kit_w, kit_h,
        [
            Opening("k_d", "door", "N", rng.uniform(0.5, kit_w - 1.1), 0.85, flip_swing=True),
            Opening("k_w", "window", "E", rng.uniform(0.6, kit_h - 1.6), rng.uniform(1.4, 2.0)),
            Opening("k_s", "window", "S", rng.uniform(0.6, kit_w - 1.6), rng.uniform(1.2, 1.8)),
        ]
    ))

    # Balcony off living/dining
    balc_w = liv_w
    balc_h = rng.uniform(1.8, 2.4)
    rooms.append(Room(
        "rm_balc", "Grand Veranda", "balcony", foyer_w, top_h + mb_h, balc_w, balc_h,
        [Opening("balc_w", "window", "S", rng.uniform(0.8, balc_w - 2.0), rng.uniform(2.5, 3.5))]
    ))

    return FloorPlan(f"3-BHK Luxury Residence #{rng.randint(100, 999)}", rooms, ext_t, int_t)


def generate_office_layout(rng: random.Random) -> FloorPlan:
    """Generates a commercial corporate office floor plan."""
    ext_t = rng.choice([0.22, 0.25, 0.28])
    int_t = rng.choice([0.10, 0.12])

    rec_w = rng.uniform(4.5, 5.5)
    rec_h = rng.uniform(4.0, 4.8)

    conf_w = rng.uniform(5.0, 6.5)
    conf_h = rec_h

    exec_w = rng.uniform(4.0, 5.0)
    exec_h = rng.uniform(3.5, 4.2)

    open_w = rec_w + conf_w - exec_w
    open_h = rng.uniform(4.5, 5.5)

    bath_w = exec_w
    bath_h = open_h - exec_h

    rooms = [
        Room("off_rec", "Reception & Lobby", "hallway", 0.0, 0.0, rec_w, rec_h, [
            Opening("off_ent", "door", "W", rng.uniform(0.6, rec_h - 1.5), 1.2),
            Opening("off_rec_w", "window", "N", rng.uniform(1.0, rec_w - 2.0), rng.uniform(1.8, 2.4)),
        ]),
        Room("off_conf", "Boardroom", "room", rec_w, 0.0, conf_w, conf_h, [
            Opening("off_conf_d", "door", "W", rng.uniform(0.6, conf_h - 1.2), 0.95, flip_swing=True),
            Opening("off_conf_w1", "window", "N", rng.uniform(1.2, conf_w - 2.4), rng.uniform(2.2, 3.0)),
            Opening("off_conf_w2", "window", "E", rng.uniform(1.0, conf_h - 2.0), rng.uniform(1.8, 2.4)),
        ]),
        Room("off_exec", "Executive Cabin", "room", 0.0, rec_h, exec_w, exec_h, [
            Opening("off_ex_d", "door", "N", rng.uniform(0.5, exec_w - 1.1), 0.9, flip_swing=True),
            Opening("off_ex_w", "window", "W", rng.uniform(0.8, exec_h - 1.8), rng.uniform(1.6, 2.2)),
        ]),
        Room("off_open", "Open Workstation Floor", "room", exec_w, rec_h, open_w, open_h, [
            Opening("off_op_w1", "window", "E", rng.uniform(1.2, open_h - 2.4), rng.uniform(2.4, 3.2)),
            Opening("off_op_w2", "window", "S", rng.uniform(1.2, open_w - 2.4), rng.uniform(2.4, 3.2)),
        ]),
        Room("off_bath", "Restroom Suite", "bathroom", 0.0, rec_h + exec_h, bath_w, bath_h, [
            Opening("off_b_d", "door", "N", rng.uniform(0.4, bath_w - 1.0), 0.8, flip_swing=True),
            Opening("off_b_w", "window", "W", rng.uniform(0.3, bath_h - 0.9), 0.8),
        ]),
    ]

    return FloorPlan(f"Corporate Office Suite #{rng.randint(100, 999)}", rooms, ext_t, int_t)


def generate_procedural_layout(rng: random.Random) -> FloorPlan:
    """Generates an architecturally sound stochastic multi-room floor plan."""
    ext_t = rng.choice([0.20, 0.22, 0.25])
    int_t = rng.choice([0.10, 0.12])

    grid_cols = rng.randint(2, 3)
    grid_rows = rng.randint(2, 3)

    col_widths = [rng.uniform(3.5, 5.5) for _ in range(grid_cols)]
    row_heights = [rng.uniform(3.2, 4.8) for _ in range(grid_rows)]

    # Pool of candidate room types
    type_pool = ["living_room", "bedroom", "kitchen", "bathroom", "bedroom", "balcony", "room", "hallway"]
    rng.shuffle(type_pool)

    rooms = []
    curr_y = 0.0
    type_idx = 0

    # Ensure at least 1 living room, 1 bedroom, 1 bathroom, 1 kitchen
    required_types = ["living_room", "bedroom", "kitchen", "bathroom"]

    for r in range(grid_rows):
        curr_x = 0.0
        rh = row_heights[r]
        for c in range(grid_cols):
            cw = col_widths[c]

            # 15% chance to skip an outer corner to create realistic L-shape or courtyard
            if (r == 0 and c == grid_cols - 1) and rng.random() < 0.20:
                curr_x += cw
                continue
            if (r == grid_rows - 1 and c == 0) and rng.random() < 0.15:
                curr_x += cw
                continue

            if required_types:
                rtype = required_types.pop(0)
            else:
                rtype = type_pool[type_idx % len(type_pool)]
                type_idx += 1

            rname = rtype.replace("_", " ").title()
            rm_id = f"proc_r{r}_c{c}"

            # Openings for this room
            ops = []

            # Exterior windows
            if r == 0:  # North exterior wall
                ops.append(Opening(f"{rm_id}_wn", "window", "N", rng.uniform(0.6, cw - 1.8), rng.uniform(1.2, min(cw - 1.0, 2.2))))
            if r == grid_rows - 1:  # South exterior wall
                ops.append(Opening(f"{rm_id}_ws", "window", "S", rng.uniform(0.6, cw - 1.8), rng.uniform(1.2, min(cw - 1.0, 2.2))))
            if c == 0:  # West exterior wall
                if rtype == "living_room" or r == 0:
                    ops.append(Opening(f"{rm_id}_ent", "door", "W", rng.uniform(0.6, rh - 1.4), 1.0))
                else:
                    ops.append(Opening(f"{rm_id}_ww", "window", "W", rng.uniform(0.6, rh - 1.6), rng.uniform(1.2, min(rh - 0.8, 1.8))))
            if c == grid_cols - 1:  # East exterior wall
                ops.append(Opening(f"{rm_id}_we", "window", "E", rng.uniform(0.6, rh - 1.6), rng.uniform(1.2, min(rh - 0.8, 1.8))))

            # Interior doors
            if c > 0:  # Interior door to left neighbor
                ops.append(Opening(f"{rm_id}_dw", "door", "W", rng.uniform(0.3, rh - 1.2), 0.85, flip_swing=rng.choice([True, False])))
            if r > 0:  # Interior door to top neighbor
                ops.append(Opening(f"{rm_id}_dn", "door", "N", rng.uniform(0.3, cw - 1.2), 0.85, flip_swing=rng.choice([True, False])))

            rooms.append(Room(rm_id, rname, rtype, curr_x, curr_y, cw, rh, ops))
            curr_x += cw
        curr_y += rh

    return FloorPlan(f"Architectural Residence #{rng.randint(100, 999)}", rooms, ext_t, int_t)


def generate_sample_plan(seed: int) -> FloorPlan:
    """Master generator dispatching across varied architectural typologies."""
    rng = random.Random(seed)
    typology_roll = rng.random()

    if typology_roll < 0.15:
        return generate_studio_layout(rng)
    elif typology_roll < 0.35:
        return generate_1bhk_layout(rng)
    elif typology_roll < 0.60:
        return generate_2bhk_layout(rng)
    elif typology_roll < 0.80:
        return generate_3bhk_layout(rng)
    elif typology_roll < 0.90:
        return generate_office_layout(rng)
    else:
        return generate_procedural_layout(rng)


# ==============================================================================
# 4. SUB-SEGMENT WALL & OPENING GEOMETRY SOLVER
# ==============================================================================

class WallPiece:
    def __init__(self, start: float, end: float, is_shared: bool, should_render: bool):
        self.start = start
        self.end = end
        self.is_shared = is_shared
        self.should_render = should_render


def solve_room_wall_pieces(rm: Room, wall: str, all_rooms: List[Room]) -> List[WallPiece]:
    """
    Decomposes a room's wall into shared interior partitions vs. exterior segments,
    ensuring shared partitions are rendered exactly once without duplicate walls.
    """
    rx, ry, rw, rh = rm.x, rm.y, rm.breadth, rm.length
    wall_len = rw if wall in ("N", "S") else rh

    shared_intervals = []

    for other in all_rooms:
        if other.id == rm.id:
            continue
        ox, oy, ow, oh = other.x, other.y, other.breadth, other.length

        if wall == "N":
            if abs((oy + oh) - ry) < 0.05:
                ov_start = max(rx, ox)
                ov_end = min(rx + rw, ox + ow)
                if ov_end - ov_start > 0.02:
                    shared_intervals.append({
                        "start": max(0.0, ov_start - rx),
                        "end": min(wall_len, ov_end - rx),
                        "should_render": False,  # Top neighbor renders horizontal partition
                    })
        elif wall == "S":
            if abs(oy - (ry + rh)) < 0.05:
                ov_start = max(rx, ox)
                ov_end = min(rx + rw, ox + ow)
                if ov_end - ov_start > 0.02:
                    shared_intervals.append({
                        "start": max(0.0, ov_start - rx),
                        "end": min(wall_len, ov_end - rx),
                        "should_render": True,   # Lower Y room renders horizontal partition
                    })
        elif wall == "W":
            if abs((ox + ow) - rx) < 0.05:
                ov_start = max(ry, oy)
                ov_end = min(ry + rh, oy + oh)
                if ov_end - ov_start > 0.02:
                    shared_intervals.append({
                        "start": max(0.0, ov_start - ry),
                        "end": min(wall_len, ov_end - ry),
                        "should_render": False,  # Left neighbor renders vertical partition
                    })
        elif wall == "E":
            if abs(ox - (rx + rw)) < 0.05:
                ov_start = max(ry, oy)
                ov_end = min(ry + rh, oy + oh)
                if ov_end - ov_start > 0.02:
                    shared_intervals.append({
                        "start": max(0.0, ov_start - ry),
                        "end": min(wall_len, ov_end - ry),
                        "should_render": True,   # Lower X room renders vertical partition
                    })

    # Sort shared intervals by start position
    shared_intervals.sort(key=lambda item: item["start"])

    # Partition wall length into contiguous exterior and shared segments
    pieces = []
    cur = 0.0

    for iv in shared_intervals:
        if iv["start"] - cur > 0.02:
            pieces.append(WallPiece(cur, iv["start"], is_shared=False, should_render=True))
        pieces.append(WallPiece(iv["start"], iv["end"], is_shared=True, should_render=iv["should_render"]))
        cur = max(cur, iv["end"])

    if wall_len - cur > 0.02:
        pieces.append(WallPiece(cur, wall_len, is_shared=False, should_render=True))

    return [p for p in pieces if p.should_render]


# ==============================================================================
# 5. VECTOR-TO-RASTER 2D CAD RENDERER & ANNOTATION EXTRACTOR
# ==============================================================================

def render_and_annotate_plan(
    plan: FloorPlan,
    img_size: int = 1024,
    theme_name: str = "cad_light",
    include_text: bool = True,
    include_dims: bool = True,
    include_grid: bool = True,
    font_path: str = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
) -> Tuple[Image.Image, Image.Image, List[Dict[str, Any]]]:
    """
    Renders floor plan to a high-resolution PIL Image, creates an 8-bit semantic mask,
    and extracts ground-truth normalized polygon & bounding-box annotations.
    """
    theme = THEMES.get(theme_name, THEMES["cad_light"])

    # 1. Coordinate transformation & centering
    min_x, min_y, max_x, max_y = plan.get_bounds()
    plan_w = max_x - min_x
    plan_h = max_y - min_y

    margin_m = 1.6  # margin in meters for dimension strings and title block
    sheet_w = plan_w + margin_m * 2
    sheet_h = plan_h + margin_m * 2

    # Pixels per meter scale
    ppm = min((img_size - 80) / max(sheet_w, 0.1), (img_size - 80) / max(sheet_h, 0.1))

    # Center bounding box in canvas
    origin_px_x = (img_size - plan_w * ppm) / 2.0
    origin_px_y = (img_size - plan_h * ppm) / 2.0

    def to_px(world_x: float, world_y: float) -> Tuple[float, float]:
        px = origin_px_x + (world_x - min_x) * ppm
        py = origin_px_y + (world_y - min_y) * ppm
        return px, py

    # 2. Initialize Images
    img = Image.new("RGB", (img_size, img_size), theme["bg"])
    draw = ImageDraw.Draw(img)

    # Semantic segmentation mask (8-bit grayscale: pixel value = class_id, 255 = bg)
    mask = Image.new("L", (img_size, img_size), 255)
    mask_draw = ImageDraw.Draw(mask)

    # Annotations list
    annotations = []

    # Fonts
    try:
        font_sm = ImageFont.truetype(font_path, max(11, int(ppm * 0.22)))
        font_xs = ImageFont.truetype(font_path, max(9, int(ppm * 0.16)))
    except Exception:
        font_sm = ImageFont.load_default()
        font_xs = ImageFont.load_default()

    # 3. Optional Grid Background
    if include_grid:
        grid_step_m = 1.0
        gx = min_x - margin_m
        while gx <= max_x + margin_m:
            px, _ = to_px(gx, 0)
            draw.line([(px, 0), (px, img_size)], fill=theme["grid"], width=1)
            gx += grid_step_m
        gy = min_y - margin_m
        while gy <= max_y + margin_m:
            _, py = to_px(0, gy)
            draw.line([(0, py), (img_size, py)], fill=theme["grid"], width=1)
            gy += grid_step_m

    # 4. Render Rooms Floors & Extract Room Polygon Annotations
    for rm in plan.rooms:
        rx1, ry1 = to_px(rm.x, rm.y)
        rx2, ry2 = to_px(rm.x + rm.breadth, rm.y + rm.length)

        # Draw room floor
        draw.rectangle([rx1, ry1, rx2, ry2], fill=theme["room_fill"], outline=None)

        # Semantic mask for room
        class_id = CLASS_TO_ID.get(rm.room_type, 6)
        mask_draw.rectangle([rx1, ry1, rx2, ry2], fill=class_id)

        # Normalized polygon (4 corners: TL, TR, BR, BL)
        poly = [
            round(rx1 / img_size, 6), round(ry1 / img_size, 6),
            round(rx2 / img_size, 6), round(ry1 / img_size, 6),
            round(rx2 / img_size, 6), round(ry2 / img_size, 6),
            round(rx1 / img_size, 6), round(ry2 / img_size, 6),
        ]
        annotations.append({
            "class_id": class_id,
            "class_name": rm.room_type,
            "polygon": poly,
            "bbox": [
                round(rx1 / img_size, 6), round(ry1 / img_size, 6),
                round((rx2 - rx1) / img_size, 6), round((ry2 - ry1) / img_size, 6)
            ],
            "area_sqm": round(rm.breadth * rm.length, 2),
            "name": rm.name,
        })

    # 5. Render Solid Walls & Extract Wall Annotations
    ext_t = plan.ext_wall_thick
    int_t = plan.int_wall_thick

    for rm in plan.rooms:
        for wall_side in ["N", "S", "W", "E"]:
            pieces = solve_room_wall_pieces(rm, wall_side, plan.rooms)

            for p in pieces:
                thick = int_t if p.is_shared else ext_t

                if wall_side == "N":
                    wx1, wy1 = to_px(rm.x + p.start, rm.y - thick)
                    wx2, wy2 = to_px(rm.x + p.end, rm.y)
                elif wall_side == "S":
                    wx1, wy1 = to_px(rm.x + p.start, rm.y + rm.length)
                    wx2, wy2 = to_px(rm.x + p.end, rm.y + rm.length + thick)
                elif wall_side == "W":
                    wx1, wy1 = to_px(rm.x - thick, rm.y + p.start)
                    wx2, wy2 = to_px(rm.x, rm.y + p.end)
                elif wall_side == "E":
                    wx1, wy1 = to_px(rm.x + rm.breadth, rm.y + p.start)
                    wx2, wy2 = to_px(rm.x + rm.breadth + thick, rm.y + p.end)

                # Draw wall
                draw.rectangle([wx1, wy1, wx2, wy2], fill=theme["wall_fill"], outline=theme["wall_stroke"], width=1)

                # Wall semantic mask
                mask_draw.rectangle([wx1, wy1, wx2, wy2], fill=CLASS_TO_ID["wall"])

                # Annotation for solid wall piece
                poly = [
                    round(wx1 / img_size, 6), round(wy1 / img_size, 6),
                    round(wx2 / img_size, 6), round(wy1 / img_size, 6),
                    round(wx2 / img_size, 6), round(wy2 / img_size, 6),
                    round(wx1 / img_size, 6), round(wy2 / img_size, 6),
                ]
                annotations.append({
                    "class_id": CLASS_TO_ID["wall"],
                    "class_name": "wall",
                    "polygon": poly,
                    "bbox": [
                        round(wx1 / img_size, 6), round(wy1 / img_size, 6),
                        round(max(0.001, (wx2 - wx1) / img_size), 6), round(max(0.001, (wy2 - wy1) / img_size), 6)
                    ],
                })

    # 6. Render Openings (Doors & Windows) & Extract Annotations
    for rm in plan.rooms:
        for op in rm.openings:
            # Check if wall opening is on exterior or interior partition
            is_shared = False
            for p in solve_room_wall_pieces(rm, op.wall, plan.rooms):
                if p.start <= op.pos <= p.end and p.is_shared:
                    is_shared = True
                    break
            thick = int_t if is_shared else ext_t

            if op.wall == "N":
                ox1, oy1 = to_px(rm.x + op.pos, rm.y - thick)
                ox2, oy2 = to_px(rm.x + op.pos + op.width, rm.y)
                hinge_x, hinge_y = to_px(rm.x + op.pos, rm.y)
            elif op.wall == "S":
                ox1, oy1 = to_px(rm.x + op.pos, rm.y + rm.length)
                ox2, oy2 = to_px(rm.x + op.pos + op.width, rm.y + rm.length + thick)
                hinge_x, hinge_y = to_px(rm.x + op.pos, rm.y + rm.length)
            elif op.wall == "W":
                ox1, oy1 = to_px(rm.x - thick, rm.y + op.pos)
                ox2, oy2 = to_px(rm.x, rm.y + op.pos + op.width)
                hinge_x, hinge_y = to_px(rm.x, rm.y + op.pos)
            elif op.wall == "E":
                ox1, oy1 = to_px(rm.x + rm.breadth, rm.y + op.pos)
                ox2, oy2 = to_px(rm.x + rm.breadth + thick, rm.y + op.pos + op.width)
                hinge_x, hinge_y = to_px(rm.x + rm.breadth, rm.y + op.pos)

            cut_box = [min(ox1, ox2), min(oy1, oy2), max(ox1, ox2), max(oy1, oy2)]

            # Clear wall cutout (fill with room/sheet background)
            draw.rectangle(cut_box, fill=theme["room_fill"], outline=None)

            if op.op_type == "window":
                # Window: Sill lines and central glass line
                draw.line([(cut_box[0], cut_box[1]), (cut_box[2], cut_box[1])], fill=theme["window_sill"], width=2)
                draw.line([(cut_box[0], cut_box[3]), (cut_box[2], cut_box[3])], fill=theme["window_sill"], width=2)
                mid_y = (cut_box[1] + cut_box[3]) / 2.0
                mid_x = (cut_box[0] + cut_box[2]) / 2.0
                if op.wall in ("N", "S"):
                    draw.line([(cut_box[0], mid_y), (cut_box[2], mid_y)], fill=theme["window_glass"], width=2)
                else:
                    draw.line([(mid_x, cut_box[1]), (mid_x, cut_box[3])], fill=theme["window_glass"], width=2)

                mask_draw.rectangle(cut_box, fill=CLASS_TO_ID["window"])

                poly = [
                    round(cut_box[0] / img_size, 6), round(cut_box[1] / img_size, 6),
                    round(cut_box[2] / img_size, 6), round(cut_box[1] / img_size, 6),
                    round(cut_box[2] / img_size, 6), round(cut_box[3] / img_size, 6),
                    round(cut_box[0] / img_size, 6), round(cut_box[3] / img_size, 6),
                ]
                annotations.append({
                    "class_id": CLASS_TO_ID["window"],
                    "class_name": "window",
                    "polygon": poly,
                    "bbox": [
                        round(cut_box[0] / img_size, 6), round(cut_box[1] / img_size, 6),
                        round((cut_box[2] - cut_box[0]) / img_size, 6), round((cut_box[3] - cut_box[1]) / img_size, 6)
                    ],
                })

            elif op.op_type == "door":
                # Door: leaf line and 90-degree swing arc
                door_len_px = op.width * ppm
                leaf_end_x = hinge_x
                leaf_end_y = hinge_y + door_len_px if op.wall == "N" else hinge_y - door_len_px

                if op.wall in ("W", "E"):
                    leaf_end_x = hinge_x + door_len_px if op.wall == "W" else hinge_x - door_len_px
                    leaf_end_y = hinge_y

                # Draw leaf
                draw.line([(hinge_x, hinge_y), (leaf_end_x, leaf_end_y)], fill=theme["door_leaf"], width=2)

                # Draw swing arc bbox
                arc_bbox = [
                    min(hinge_x, leaf_end_x) - door_len_px,
                    min(hinge_y, leaf_end_y) - door_len_px,
                    max(hinge_x, leaf_end_x) + door_len_px,
                    max(hinge_y, leaf_end_y) + door_len_px,
                ]
                draw.arc(arc_bbox, start=0, end=90, fill=theme["door_arc"], width=1)

                # Total door bounding box for instance detection/segmentation
                door_box = [
                    min(cut_box[0], hinge_x, leaf_end_x),
                    min(cut_box[1], hinge_y, leaf_end_y),
                    max(cut_box[2], hinge_x, leaf_end_x),
                    max(cut_box[3], hinge_y, leaf_end_y),
                ]

                mask_draw.rectangle(cut_box, fill=CLASS_TO_ID["door"])

                poly = [
                    round(door_box[0] / img_size, 6), round(door_box[1] / img_size, 6),
                    round(door_box[2] / img_size, 6), round(door_box[1] / img_size, 6),
                    round(door_box[2] / img_size, 6), round(door_box[3] / img_size, 6),
                    round(door_box[0] / img_size, 6), round(door_box[3] / img_size, 6),
                ]
                annotations.append({
                    "class_id": CLASS_TO_ID["door"],
                    "class_name": "door",
                    "polygon": poly,
                    "bbox": [
                        round(door_box[0] / img_size, 6), round(door_box[1] / img_size, 6),
                        round(max(0.001, (door_box[2] - door_box[0]) / img_size), 6),
                        round(max(0.001, (door_box[3] - door_box[1]) / img_size), 6)
                    ],
                })

    # 7. Optional Room Labels & Dimension Strings
    if include_text:
        for rm in plan.rooms:
            rx1, ry1 = to_px(rm.x, rm.y)
            rx2, ry2 = to_px(rm.x + rm.breadth, rm.y + rm.length)
            cx = (rx1 + rx2) / 2.0
            cy = (ry1 + ry2) / 2.0

            text_title = rm.name.upper()
            text_dims = f"{rm.breadth:.2f}m × {rm.length:.2f}m"

            # Draw centered text
            draw.text((cx, cy - 8), text_title, fill=theme["text"], font=font_sm, anchor="ms")
            draw.text((cx, cy + 8), text_dims, fill=theme["dim_line"], font=font_xs, anchor="ms")

    # 8. Optional Exterior Dimension Strings
    if include_dims:
        dim_y = origin_px_y - 28
        p1_x, _ = to_px(min_x, min_y)
        p2_x, _ = to_px(max_x, min_y)
        draw.line([(p1_x, dim_y), (p2_x, dim_y)], fill=theme["dim_line"], width=1)
        draw.line([(p1_x, dim_y - 6), (p1_x, dim_y + 6)], fill=theme["dim_line"], width=1)
        draw.line([(p2_x, dim_y - 6), (p2_x, dim_y + 6)], fill=theme["dim_line"], width=1)
        draw.text(((p1_x + p2_x) / 2.0, dim_y - 4), f"{plan_w:.2f} m", fill=theme["dim_line"], font=font_xs, anchor="ms")

    return img, mask, annotations


# ==============================================================================
# 6. EXPORT UTILITIES (YOLO, COCO, METADATA)
# ==============================================================================

def write_yolo_label(annotations: List[Dict[str, Any]], filepath: Path):
    """Writes YOLOv8/v11 instance segmentation polygon lines to a .txt file."""
    lines = []
    for ann in annotations:
        cid = ann["class_id"]
        poly = ann["polygon"]
        # class_id x1 y1 x2 y2 ... xn yn
        poly_str = " ".join(f"{coord:.6f}" for coord in poly)
        lines.append(f"{cid} {poly_str}")
    filepath.write_text("\n".join(lines), encoding="utf-8")


def export_coco_json(samples: List[Dict[str, Any]], output_path: Path):
    """Exports dataset split to standard COCO instances JSON format."""
    images = []
    annotations = []
    ann_id = 1

    for sample in samples:
        img_id = sample["id"]
        images.append({
            "id": img_id,
            "file_name": sample["filename"],
            "width": sample["width"],
            "height": sample["height"],
        })
        for ann in sample["annotations"]:
            cid = ann["class_id"]
            # Convert polygon [x1, y1, x2, y2, ...] to pixel coordinates
            w = sample["width"]
            h = sample["height"]
            pixel_poly = [ann["polygon"][i] * (w if i % 2 == 0 else h) for i in range(len(ann["polygon"]))]
            bx, by, bw, bh = ann["bbox"]
            pixel_bbox = [bx * w, by * h, bw * w, bh * h]

            annotations.append({
                "id": ann_id,
                "image_id": img_id,
                "category_id": cid,
                "segmentation": [pixel_poly],
                "area": pixel_bbox[2] * pixel_bbox[3],
                "bbox": pixel_bbox,
                "iscrowd": 0,
            })
            ann_id += 1

    categories = [{"id": i, "name": name, "supercategory": "floorplan"} for i, name in enumerate(CLASSES)]

    coco_dict = {
        "images": images,
        "annotations": annotations,
        "categories": categories,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(coco_dict, f, indent=2)


# ==============================================================================
# 7. WORKER TASK FOR MULTIPROCESSING
# ==============================================================================

def generate_single_sample(args: Tuple[int, str, str, Path, Path, Path, int]) -> Dict[str, Any]:
    """Generates a single floor plan sample with all modalities and writes files."""
    sample_idx, split, base_name, img_dir, lbl_dir, msk_dir, img_res = args
    seed = sample_idx * 17 + 101
    rng = random.Random(seed)

    plan = generate_sample_plan(seed)

    # Styling variations
    theme_roll = rng.random()
    if theme_roll < 0.65:
        theme = "cad_light"
    elif theme_roll < 0.85:
        theme = "high_contrast_bw"
    else:
        theme = "blueprint"

    # 50% clean drawings without text, 50% with text & dimensions
    include_text = rng.random() > 0.50
    include_dims = rng.random() > 0.50
    include_grid = rng.random() > 0.40

    img, mask, annotations = render_and_annotate_plan(
        plan=plan,
        img_size=img_res,
        theme_name=theme,
        include_text=include_text,
        include_dims=include_dims,
        include_grid=include_grid,
    )

    filename = f"{base_name}.png"
    img_path = img_dir / filename
    lbl_path = lbl_dir / f"{base_name}.txt"
    msk_path = msk_dir / filename

    # Save PNG image (optimized)
    img.save(img_path, format="PNG", optimize=True)

    # Save 8-bit semantic mask
    mask.save(msk_path, format="PNG", optimize=True)

    # Save YOLO instance segmentation label
    write_yolo_label(annotations, lbl_path)

    # Return summary for COCO & metadata compilation
    return {
        "id": sample_idx,
        "filename": filename,
        "width": img_res,
        "height": img_res,
        "split": split,
        "theme": theme,
        "rooms_count": len(plan.rooms),
        "annotations": annotations,
        "plan": {
            "name": plan.name,
            "rooms": [r.to_dict() for r in plan.rooms],
            "exterior_wall_thickness": plan.ext_wall_thick,
            "interior_wall_thickness": plan.int_wall_thick,
        },
    }


# ==============================================================================
# 8. MASTER BATCH GENERATION PIPELINE
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="5,000 Floor Plan Dataset Generator")
    parser.add_argument("--count", type=int, default=5000, help="Total number of floor plans to generate")
    parser.add_argument("--output-dir", type=str, default="./dataset_5000", help="Target output directory")
    parser.add_argument("--resolution", type=int, default=1024, help="PNG resolution (square)")
    parser.add_argument("--workers", type=int, default=16, help="Parallel worker processes")
    parser.add_argument("--train-ratio", type=float, default=0.80, help="Train split fraction")
    parser.add_argument("--val-ratio", type=float, default=0.10, help="Validation split fraction")
    parser.add_argument("--test-ratio", type=float, default=0.10, help="Test split fraction")
    args = parser.parse_args()

    total_count = args.count
    out_dir = Path(args.output_dir).resolve()
    print(f"=== Floor Plan Dataset Generator ===")
    print(f"Target count:       {total_count} images")
    print(f"Output directory:   {out_dir}")
    print(f"Resolution:         {args.resolution}x{args.resolution} px")
    print(f"Parallel workers:   {args.workers}")

    # Compute split counts
    train_count = int(total_count * args.train_ratio)
    val_count = int(total_count * args.val_ratio)
    test_count = total_count - train_count - val_count

    print(f"Splits:             Train={train_count}, Val={val_count}, Test={test_count}")

    # Create directory tree
    splits = ["train", "val", "test"]
    dirs = {}
    for s in splits:
        dirs[f"img_{s}"] = out_dir / "images" / s
        dirs[f"lbl_{s}"] = out_dir / "labels" / s
        dirs[f"msk_{s}"] = out_dir / "masks" / s
        dirs[f"img_{s}"].mkdir(parents=True, exist_ok=True)
        dirs[f"lbl_{s}"].mkdir(parents=True, exist_ok=True)
        dirs[f"msk_{s}"].mkdir(parents=True, exist_ok=True)

    ann_dir = out_dir / "annotations"
    ann_dir.mkdir(parents=True, exist_ok=True)

    # Prepare task arguments
    tasks = []
    idx = 1

    for i in range(train_count):
        tasks.append((idx, "train", f"fp_train_{i+1:05d}", dirs["img_train"], dirs["lbl_train"], dirs["msk_train"], args.resolution))
        idx += 1

    for i in range(val_count):
        tasks.append((idx, "val", f"fp_val_{i+1:05d}", dirs["img_val"], dirs["lbl_val"], dirs["msk_val"], args.resolution))
        idx += 1

    for i in range(test_count):
        tasks.append((idx, "test", f"fp_test_{i+1:05d}", dirs["img_test"], dirs["lbl_test"], dirs["msk_test"], args.resolution))
        idx += 1

    start_time = time.time()
    results = []

    print(f"\nStarting parallel generation across {args.workers} cores...")
    completed = 0
    batch_size = max(50, total_count // 20)

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        for res in executor.map(generate_single_sample, tasks, chunksize=16):
            results.append(res)
            completed += 1
            if completed % batch_size == 0 or completed == total_count:
                elapsed = time.time() - start_time
                speed = completed / max(elapsed, 0.001)
                remaining = (total_count - completed) / max(speed, 0.001)
                sys.stdout.write(f"\rProgress: {completed}/{total_count} ({completed*100.0/total_count:.1f}%) | Speed: {speed:.1f} img/s | ETA: {remaining:.1f}s")
                sys.stdout.flush()

    total_time = time.time() - start_time
    print(f"\n\nGeneration complete in {total_time:.2f} seconds ({total_count / max(total_time, 0.001):.1f} img/s)!")

    # Separate results by split
    train_samples = [r for r in results if r["split"] == "train"]
    val_samples = [r for r in results if r["split"] == "val"]
    test_samples = [r for r in results if r["split"] == "test"]

    print("\nWriting COCO instance segmentation JSON files...")
    export_coco_json(train_samples, ann_dir / "instances_train.json")
    export_coco_json(val_samples, ann_dir / "instances_val.json")
    export_coco_json(test_samples, ann_dir / "instances_test.json")

    print("Writing metadata JSON...")
    meta_path = ann_dir / "metadata_all.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump([
            {
                "id": r["id"],
                "filename": r["filename"],
                "split": r["split"],
                "theme": r["theme"],
                "rooms_count": r["rooms_count"],
                "plan": r["plan"],
            }
            for r in results
        ], f, indent=2)

    # Write data.yaml for YOLO training
    print("Writing YOLO data.yaml...")
    yaml_content = f"""# Ultralytics YOLOv8/v11 Floor Plan Dataset
path: {out_dir.as_posix()}
train: images/train
val: images/val
test: images/test

# 10 Architectural Classes
names:
  0: bedroom
  1: living_room
  2: kitchen
  3: bathroom
  4: hallway
  5: balcony
  6: room
  7: door
  8: window
  9: wall
"""
    (out_dir / "data.yaml").write_text(yaml_content, encoding="utf-8")

    # Write summary statistics
    class_counts = {name: 0 for name in CLASSES}
    for r in results:
        for ann in r["annotations"]:
            cname = ann["class_name"]
            if cname in class_counts:
                class_counts[cname] += 1

    summary = {
        "dataset_name": "Architectural 2D Floor Plan 5,000 Dataset",
        "total_images": total_count,
        "image_resolution": f"{args.resolution}x{args.resolution}",
        "splits": {
            "train": len(train_samples),
            "val": len(val_samples),
            "test": len(test_samples),
        },
        "classes": CLASSES,
        "class_instance_counts": class_counts,
        "generation_time_seconds": round(total_time, 2),
    }

    with open(out_dir / "dataset_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Write README.md
    readme_content = f"""# 5,000 Architectural Floor Plan Dataset

Synthetic high-fidelity dataset of {total_count} floor plan PNGs with complete multi-format annotations for training Computer Vision models.

## Dataset Structure
- `images/`: High-resolution {args.resolution}x{args.resolution} PNG floor plan drawings.
  - `train/` ({len(train_samples)} images)
  - `val/` ({len(val_samples)} images)
  - `test/` ({len(test_samples)} images)
- `labels/`: Normalized YOLO instance segmentation polygon annotations (`class_id x1 y1 x2 y2 ... xn yn`).
- `masks/`: 8-bit single-channel semantic segmentation PNG masks.
- `annotations/`: COCO instances format (`instances_train.json`, `instances_val.json`, `instances_test.json`) and architectural metadata.
- `data.yaml`: YOLOv8/v11 dataset configuration.

## Class Index
| ID | Class Name | Description | Total Instances |
|---|---|---|---|
| 0 | bedroom | Master suites, secondary bedrooms, guest rooms | {class_counts['bedroom']} |
| 1 | living_room | Living rooms, lounges, great rooms | {class_counts['living_room']} |
| 2 | kitchen | Kitchens, kitchenettes, open counters | {class_counts['kitchen']} |
| 3 | bathroom | Restrooms, en-suites, powder rooms | {class_counts['bathroom']} |
| 4 | hallway | Corridors, foyers, hallways | {class_counts['hallway']} |
| 5 | balcony | Balconies, terraces, verandas | {class_counts['balcony']} |
| 6 | room | Boardrooms, executive offices, dining rooms, generic | {class_counts['room']} |
| 7 | door | Single/double swing doors with swing arc | {class_counts['door']} |
| 8 | window | Exterior windows with sill & glass panes | {class_counts['window']} |
| 9 | wall | Solid exterior walls and interior partitions | {class_counts['wall']} |

## Quick Training with YOLOv8/v11
```bash
# Instance Segmentation
yolo segment train data={out_dir.as_posix()}/data.yaml model=yolov8m-seg.pt epochs=100 imgsz={args.resolution}

# Object Detection
yolo detect train data={out_dir.as_posix()}/data.yaml model=yolov8m.pt epochs=100 imgsz={args.resolution}
```
"""
    (out_dir / "README.md").write_text(readme_content, encoding="utf-8")

    print("\nSummary:")
    print(f"Total images: {total_count}")
    print(f"Total annotations across {len(CLASSES)} classes: {sum(class_counts.values())}")
    for cname, cnt in class_counts.items():
        print(f"  - {cname:12s}: {cnt:,} instances")
    print(f"\nDataset successfully generated at: {out_dir}")


if __name__ == "__main__":
    main()
