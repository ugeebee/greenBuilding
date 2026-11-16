"""Floor Plan Reader: Multi-format floor plan parsing using fine-tuned Vision-Language Models."""

from floorplan_reader.schema import (
    BoundingBox2D,
    RoomElement,
    DoorElement,
    WindowElement,
    FloorPlanMetadata,
    FloorPlanAnalysis,
)

try:
    from floorplan_reader.detection.hybrid_analyzer import HybridFloorPlanAnalyzer
except ImportError:
    HybridFloorPlanAnalyzer = None

__version__ = "0.1.0"
__all__ = [
    "BoundingBox2D",
    "RoomElement",
    "DoorElement",
    "WindowElement",
    "FloorPlanMetadata",
    "FloorPlanAnalysis",
    "HybridFloorPlanAnalyzer",
]
