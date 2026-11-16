"""Pydantic schemas and geometry helpers for structured floor plan analysis.

Includes lightweight pure-Python fallback when pydantic is not installed.
"""

from __future__ import annotations
from typing import List, Optional, Tuple, Dict, Any

try:
    from pydantic import BaseModel as _PydanticBaseModel, Field, field_validator, model_validator
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False

    def Field(default=None, default_factory=None, **kwargs):
        if default_factory is not None:
            return default_factory()
        return default

    def field_validator(*args, **kwargs):
        def dec(fn):
            return fn
        return dec

    def model_validator(*args, **kwargs):
        def dec(fn):
            return fn
        return dec

    class _PydanticBaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

        def model_dump(self, mode="python", exclude_none=False, **kwargs) -> Dict[str, Any]:
            def _serialize(val):
                if hasattr(val, "model_dump"):
                    return val.model_dump(mode=mode, exclude_none=exclude_none, **kwargs)
                elif isinstance(val, (list, tuple)):
                    return [_serialize(x) for x in val]
                elif isinstance(val, dict):
                    return {k: _serialize(v) for k, v in val.items() if not (exclude_none and v is None)}
                return val

            res = {}
            for k, v in self.__dict__.items():
                if k.startswith("_"):
                    continue
                if exclude_none and v is None:
                    continue
                res[k] = _serialize(v)
            return res

        @classmethod
        def model_validate(cls, data: Any) -> Any:
            if isinstance(data, cls):
                return data
            if isinstance(data, dict):
                return cls(**data)
            return data


class BoundingBox2D(_PydanticBaseModel):
    """Normalized 2D Bounding Box in format [ymin, xmin, ymax, xmax].
    
    Coordinates are normalized to range [0, 1000] where:
    - ymin, ymax: 0 (top) to 1000 (bottom)
    - xmin, xmax: 0 (left) to 1000 (right)
    """
    ymin: float = 0.0
    xmin: float = 0.0
    ymax: float = 1000.0
    xmax: float = 1000.0

    def __init__(self, *args, **kwargs):
        if args and len(args) == 4:
            ymin, xmin, ymax, xmax = float(args[0]), float(args[1]), float(args[2]), float(args[3])
        elif "box" in kwargs and isinstance(kwargs["box"], (list, tuple)) and len(kwargs["box"]) == 4:
            b = kwargs["box"]
            ymin, xmin, ymax, xmax = float(b[0]), float(b[1]), float(b[2]), float(b[3])
        else:
            ymin = float(kwargs.get("ymin", 0.0))
            xmin = float(kwargs.get("xmin", 0.0))
            ymax = float(kwargs.get("ymax", 1000.0))
            xmax = float(kwargs.get("xmax", 1000.0))

        if ymin > ymax:
            ymin, ymax = ymax, ymin
        if xmin > xmax:
            xmin, xmax = xmax, xmin

        super().__init__(ymin=ymin, xmin=xmin, ymax=ymax, xmax=xmax)
        self.ymin = ymin
        self.xmin = xmin
        self.ymax = ymax
        self.xmax = xmax

    @classmethod
    def parse_from_list_or_dict(cls, data: Any) -> BoundingBox2D:
        """Convenience factory method returning a validated BoundingBox2D instance."""
        if isinstance(data, cls):
            return data
        if isinstance(data, (list, tuple)) and len(data) == 4:
            return cls(data[0], data[1], data[2], data[3])
        if isinstance(data, dict):
            return cls(**data)
        raise ValueError(f"Cannot parse BoundingBox2D from {data}")

    @property
    def norm_width(self) -> float:
        """Normalized width in range [0, 1000]."""
        return max(0.0, self.xmax - self.xmin)

    @property
    def norm_height(self) -> float:
        """Normalized height in range [0, 1000]."""
        return max(0.0, self.ymax - self.ymin)

    @property
    def norm_area(self) -> float:
        """Normalized area relative to full floor plan (scale 0 to 1,000,000)."""
        return self.norm_width * self.norm_height

    def to_list(self) -> List[int]:
        """Return integer [ymin, xmin, ymax, xmax]."""
        return [int(round(self.ymin)), int(round(self.xmin)), int(round(self.ymax)), int(round(self.xmax))]

    def to_pixel_xyxy(self, img_width: int, img_height: int) -> Tuple[int, int, int, int]:
        """Convert normalized [0, 1000] to absolute pixel coordinates (xmin, ymin, xmax, ymax)."""
        px_xmin = int(round((self.xmin / 1000.0) * img_width))
        px_ymin = int(round((self.ymin / 1000.0) * img_height))
        px_xmax = int(round((self.xmax / 1000.0) * img_width))
        px_ymax = int(round((self.ymax / 1000.0) * img_height))
        return px_xmin, px_ymin, px_xmax, px_ymax

    def to_pixel_xywh(self, img_width: int, img_height: int) -> Tuple[int, int, int, int]:
        """Convert normalized [0, 1000] to absolute pixel bounding box (x, y, w, h)."""
        xmin, ymin, xmax, ymax = self.to_pixel_xyxy(img_width, img_height)
        return xmin, ymin, max(1, xmax - xmin), max(1, ymax - ymin)

    def iou(self, other: BoundingBox2D) -> float:
        """Calculate Intersection over Union (IoU) with another bounding box."""
        inter_ymin = max(self.ymin, other.ymin)
        inter_xmin = max(self.xmin, other.xmin)
        inter_ymax = min(self.ymax, other.ymax)
        inter_xmax = min(self.xmax, other.xmax)

        inter_w = max(0.0, inter_xmax - inter_xmin)
        inter_h = max(0.0, inter_ymax - inter_ymin)
        inter_area = inter_w * inter_h

        union_area = self.norm_area + other.norm_area - inter_area
        if union_area <= 0:
            return 0.0
        return inter_area / union_area


class RoomElement(_PydanticBaseModel):
    """Represents an identified room or functional architectural zone."""
    id: str
    name: str
    box_2d: BoundingBox2D
    norm_length: Optional[float] = None
    norm_width: Optional[float] = None
    area_percentage: Optional[float] = None
    detected_label_text: Optional[str] = None
    real_length: Optional[float] = None
    real_width: Optional[float] = None
    unit: Optional[str] = "m"

    def __init__(
        self,
        id: str = "",
        name: str = "",
        box_2d: Any = None,
        norm_length: Optional[float] = None,
        norm_width: Optional[float] = None,
        area_percentage: Optional[float] = None,
        detected_label_text: Optional[str] = None,
        real_length: Optional[float] = None,
        real_width: Optional[float] = None,
        unit: Optional[str] = "m",
        **kwargs
    ):
        if not isinstance(box_2d, BoundingBox2D):
            box_2d = BoundingBox2D.parse_from_list_or_dict(box_2d)

        w = box_2d.norm_width
        h = box_2d.norm_height
        if norm_length is None:
            norm_length = round(max(w, h), 1)
        if norm_width is None:
            norm_width = round(min(w, h), 1)
        if area_percentage is None:
            area_percentage = round((box_2d.norm_area / 1_000_000.0) * 100.0, 2)

        super().__init__(
            id=id,
            name=name,
            box_2d=box_2d,
            norm_length=norm_length,
            norm_width=norm_width,
            area_percentage=area_percentage,
            detected_label_text=detected_label_text,
            real_length=real_length,
            real_width=real_width,
            unit=unit,
            **kwargs
        )
        self.id = id
        self.name = name
        self.box_2d = box_2d
        self.norm_length = norm_length
        self.norm_width = norm_width
        self.area_percentage = area_percentage
        self.detected_label_text = detected_label_text
        self.real_length = real_length
        self.real_width = real_width
        self.unit = unit


class DoorElement(_PydanticBaseModel):
    """Represents an identified door opening or swing symbol."""
    id: str
    box_2d: BoundingBox2D
    door_type: str = "single_swing"
    connects: Optional[List[str]] = None

    def __init__(self, id: str = "", box_2d: Any = None, door_type: str = "single_swing", connects: Optional[List[str]] = None, **kwargs):
        if not isinstance(box_2d, BoundingBox2D):
            box_2d = BoundingBox2D.parse_from_list_or_dict(box_2d)
        connects = connects or []
        super().__init__(id=id, box_2d=box_2d, door_type=door_type, connects=connects, **kwargs)
        self.id = id
        self.box_2d = box_2d
        self.door_type = door_type
        self.connects = connects


class WindowElement(_PydanticBaseModel):
    """Represents an identified window element."""
    id: str
    box_2d: BoundingBox2D
    window_type: str = "standard"
    wall_side: Optional[str] = None

    def __init__(self, id: str = "", box_2d: Any = None, window_type: str = "standard", wall_side: Optional[str] = None, **kwargs):
        if not isinstance(box_2d, BoundingBox2D):
            box_2d = BoundingBox2D.parse_from_list_or_dict(box_2d)
        super().__init__(id=id, box_2d=box_2d, window_type=window_type, wall_side=wall_side, **kwargs)
        self.id = id
        self.box_2d = box_2d
        self.window_type = window_type
        self.wall_side = wall_side


class FloorPlanMetadata(_PydanticBaseModel):
    """Metadata regarding the input floor plan drawing."""
    image_width: int
    image_height: int
    source_format: str = "png"
    total_rooms: int = 0
    total_doors: int = 0
    total_windows: int = 0
    pixels_per_meter: Optional[float] = None

    def __init__(
        self,
        image_width: int = 0,
        image_height: int = 0,
        source_format: str = "png",
        total_rooms: int = 0,
        total_doors: int = 0,
        total_windows: int = 0,
        pixels_per_meter: Optional[float] = None,
        **kwargs
    ):
        super().__init__(
            image_width=image_width,
            image_height=image_height,
            source_format=source_format,
            total_rooms=total_rooms,
            total_doors=total_doors,
            total_windows=total_windows,
            pixels_per_meter=pixels_per_meter,
            **kwargs
        )
        self.image_width = image_width
        self.image_height = image_height
        self.source_format = source_format
        self.total_rooms = total_rooms
        self.total_doors = total_doors
        self.total_windows = total_windows
        self.pixels_per_meter = pixels_per_meter


class FloorPlanAnalysis(_PydanticBaseModel):
    """Top-level structured output of the floor plan reader analysis."""
    metadata: FloorPlanMetadata
    rooms: List[RoomElement]
    doors: List[DoorElement]
    windows: List[WindowElement]

    def __init__(
        self,
        metadata: Any = None,
        rooms: Optional[List[RoomElement]] = None,
        doors: Optional[List[DoorElement]] = None,
        windows: Optional[List[WindowElement]] = None,
        **kwargs
    ):
        if metadata is not None and not isinstance(metadata, FloorPlanMetadata):
            metadata = FloorPlanMetadata(**metadata)
        rooms = rooms or []
        doors = doors or []
        windows = windows or []
        super().__init__(metadata=metadata, rooms=rooms, doors=doors, windows=windows, **kwargs)
        self.metadata = metadata
        self.rooms = rooms
        self.doors = doors
        self.windows = windows

    @classmethod
    def from_model_prediction(
        cls,
        raw_dict: Dict[str, Any],
        image_width: int,
        image_height: int,
        source_format: str = "png",
        pixels_per_meter: Optional[float] = None,
    ) -> FloorPlanAnalysis:
        """Instantiate and enrich FloorPlanAnalysis from model JSON dictionary."""
        rooms_data = raw_dict.get("rooms", [])
        doors_data = raw_dict.get("doors", [])
        windows_data = raw_dict.get("windows", [])

        parsed_rooms: List[RoomElement] = []
        for idx, r in enumerate(rooms_data):
            r_id = r.get("id", f"room_{idx + 1}")
            box = r.get("box_2d") or r.get("bbox") or r.get("coordinates")
            if not box:
                continue
            name = r.get("name") or r.get("type") or r.get("label", "room")
            label_text = r.get("detected_label_text") or r.get("text")

            # Real world scaling if pixels_per_meter is provided
            real_l, real_w = None, None
            if pixels_per_meter and pixels_per_meter > 0:
                box_obj = BoundingBox2D.parse_from_list_or_dict(box)
                _, _, pw, ph = box_obj.to_pixel_xywh(image_width, image_height)
                real_l = round(max(pw, ph) / pixels_per_meter, 2)
                real_w = round(min(pw, ph) / pixels_per_meter, 2)
            else:
                real_l = r.get("length") or r.get("real_length")
                real_w = r.get("width") or r.get("real_width")

            parsed_rooms.append(
                RoomElement(
                    id=r_id,
                    name=name.lower().replace(" ", "_"),
                    box_2d=box,
                    detected_label_text=label_text,
                    real_length=real_l,
                    real_width=real_w,
                    unit=r.get("unit", "m"),
                )
            )

        parsed_doors: List[DoorElement] = []
        for idx, d in enumerate(doors_data):
            d_id = d.get("id", f"door_{idx + 1}")
            box = d.get("box_2d") or d.get("bbox") or d.get("coordinates")
            if not box:
                continue
            door_type = d.get("door_type") or d.get("type", "single_swing")
            connects = d.get("connects", [])
            parsed_doors.append(DoorElement(id=d_id, box_2d=box, door_type=door_type, connects=connects))

        parsed_windows: List[WindowElement] = []
        for idx, w in enumerate(windows_data):
            w_id = w.get("id", f"window_{idx + 1}")
            box = w.get("box_2d") or w.get("bbox") or w.get("coordinates")
            if not box:
                continue
            win_type = w.get("window_type") or w.get("type", "standard")
            wall = w.get("wall_side") or w.get("wall")
            parsed_windows.append(WindowElement(id=w_id, box_2d=box, window_type=win_type, wall_side=wall))

        metadata = FloorPlanMetadata(
            image_width=image_width,
            image_height=image_height,
            source_format=source_format,
            total_rooms=len(parsed_rooms),
            total_doors=len(parsed_doors),
            total_windows=len(parsed_windows),
            pixels_per_meter=pixels_per_meter,
        )

        return cls(metadata=metadata, rooms=parsed_rooms, doors=parsed_doors, windows=parsed_windows)

    def to_clean_dict(self) -> Dict[str, Any]:
        """Serialize into clean dictionary for API or downstream export."""
        return self.model_dump(exclude_none=True)
