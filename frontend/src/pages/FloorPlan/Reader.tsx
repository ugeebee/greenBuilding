import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Upload,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  Download,
  Calculator,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Check,
  Plus,
  Trash2,
  Move,
  Undo2,
  Compass,
  DoorClosed,
  Square
} from 'lucide-react';

interface SampleItem {
  id: string;
  filename: string;
  title: string;
  description: string;
  tag: string;
  rooms_count: number;
  ppm: number;
}

interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

interface DetectedRoom {
  id: string;
  name: string;
  box_2d: BoundingBox;
  norm_length?: number;
  norm_width?: number;
  real_length?: number;
  real_width?: number;
  area_percentage?: number;
  detected_label_text?: string;
  unit?: string;
}

interface DetectedOpening {
  id: string;
  door_type?: string;
  window_type?: string;
  wall_side?: string;
  width?: number;
  height?: number;
  box_2d: BoundingBox;
}

interface AnalysisResult {
  status: string;
  method_used: string;
  processing_time_ms?: number;
  overlay_base64?: string;
  analysis: {
    metadata: {
      image_width: number;
      image_height: number;
      source_format: string;
      total_rooms: number;
      total_doors: number;
      total_windows: number;
      pixels_per_meter?: number;
    };
    rooms: DetectedRoom[];
    doors?: DetectedOpening[];
    windows?: DetectedOpening[];
  };
}

interface DragState {
  isDragging: boolean;
  type: 'room' | 'door' | 'window';
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  initialBox: BoundingBox;
}

const ROOM_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  living_room: { bg: '#10b981', border: '#059669', text: 'text-emerald-700 dark:text-emerald-300' },
  living: { bg: '#10b981', border: '#059669', text: 'text-emerald-700 dark:text-emerald-300' },
  master_bedroom: { bg: '#3b82f6', border: '#2563eb', text: 'text-blue-700 dark:text-blue-300' },
  bedroom: { bg: '#8b5cf6', border: '#7c3aed', text: 'text-violet-700 dark:text-violet-300' },
  bedroom_2: { bg: '#8b5cf6', border: '#7c3aed', text: 'text-violet-700 dark:text-violet-300' },
  kitchen: { bg: '#f59e0b', border: '#d97706', text: 'text-amber-700 dark:text-amber-300' },
  dining: { bg: '#ea580c', border: '#c2410c', text: 'text-orange-700 dark:text-orange-300' },
  bathroom: { bg: '#06b6d4', border: '#0891b2', text: 'text-cyan-700 dark:text-cyan-300' },
  balcony: { bg: '#14b8a6', border: '#0d9488', text: 'text-teal-700 dark:text-teal-300' },
  office: { bg: '#6366f1', border: '#4f46e5', text: 'text-indigo-700 dark:text-indigo-300' },
};

function getRoomColor(name?: string, index: number = 0) {
  const key = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  for (const [k, v] of Object.entries(ROOM_PALETTE)) {
    if (key.includes(k)) return v;
  }
  const fallbackKeys = Object.keys(ROOM_PALETTE);
  return ROOM_PALETTE[fallbackKeys[index % fallbackKeys.length]];
}

export default function FloorPlanReader() {
  const navigate = useNavigate();

  // State
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Analysis options
  const [ppm, setPpm] = useState<string>('59.45');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result & Editable Elements
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [originalResult, setOriginalResult] = useState<AnalysisResult | null>(null);
  const [rooms, setRooms] = useState<DetectedRoom[]>([]);
  const [doors, setDoors] = useState<DetectedOpening[]>([]);
  const [windows, setWindows] = useState<DetectedOpening[]>([]);

  // Selection & UI Tab
  const [activeTab, setActiveTab] = useState<'rooms' | 'doors' | 'windows'>('rooms');
  const [selectedElement, setSelectedElement] = useState<{ type: 'room' | 'door' | 'window'; id: string } | null>(null);
  const [viewMode, setViewMode] = useState<'interactive' | 'overlay' | 'original'>('interactive');

  // Dragging & Interaction
  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch samples
  useEffect(() => {
    const fetchSamples = async () => {
      try {
        const res = await fetch('/api/floorplan/samples');
        if (res.ok) {
          const data = await res.json();
          setSamples(data);
          if (data.length > 0) {
            handleSelectSample(data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching samples:', err);
      }
    };
    fetchSamples();
  }, []);

  // Handle sample selection
  const handleSelectSample = (sample: SampleItem) => {
    setSelectedSample(sample);
    setUploadedFile(null);
    setPreviewUrl(`/samples/${sample.filename}`);
    setPpm(sample.ppm.toString());
    setResult(null);
    setOriginalResult(null);
    setRooms([]);
    setDoors([]);
    setWindows([]);
    setSelectedElement(null);
    setErrorMsg(null);
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedSample(null);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setOriginalResult(null);
      setRooms([]);
      setDoors([]);
      setWindows([]);
      setSelectedElement(null);
      setErrorMsg(null);
    }
  };

  // Run Floor Plan Analysis
  const handleRunAnalysis = async () => {
    if (!uploadedFile && !selectedSample) {
      setErrorMsg('Please select a sample or upload a floor plan image.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let res: Response;
      const ppmNum = parseFloat(ppm) || 0;

      if (uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('method', 'hybrid');
        if (ppmNum > 0) formData.append('pixels_per_meter', ppmNum.toString());

        res = await fetch('/api/floorplan/analyze', {
          method: 'POST',
          body: formData,
        });
      } else if (selectedSample) {
        res = await fetch('/api/floorplan/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sample: selectedSample.filename,
            method: 'hybrid',
            pixels_per_meter: ppmNum > 0 ? ppmNum : undefined,
          }),
        });
      } else {
        throw new Error('No input provided');
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Analysis failed on server');
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setOriginalResult(JSON.parse(JSON.stringify(data)));

      // Initialize editable collections
      const rawRooms = (data.analysis.rooms || []).filter((r) => r.name !== 'wall');
      const formattedRooms = rawRooms.map((r, idx) => ({
        ...r,
        id: r.id || `room_${idx + 1}`,
        real_length: r.real_length || (r.norm_length ? Number((r.norm_length * 0.015).toFixed(2)) : 4.5),
        real_width: r.real_width || (r.norm_width ? Number((r.norm_width * 0.015).toFixed(2)) : 3.8),
      }));

      const formattedDoors = (data.analysis.doors || []).map((d, idx) => ({
        ...d,
        id: d.id || `door_${idx + 1}`,
        door_type: d.door_type || 'single_swing',
        width: d.width || 0.9,
      }));

      const formattedWindows = (data.analysis.windows || []).map((w, idx) => ({
        ...w,
        id: w.id || `window_${idx + 1}`,
        window_type: w.window_type || 'standard',
        wall_side: w.wall_side || 'north',
        width: w.width || 1.4,
        height: w.height || 1.4,
      }));

      setRooms(formattedRooms);
      setDoors(formattedDoors);
      setWindows(formattedWindows);

      if (formattedRooms.length > 0) {
        setSelectedElement({ type: 'room', id: formattedRooms[0].id });
      }
      setViewMode('interactive');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  // Reset to original AI detection results
  const handleResetToAI = () => {
    if (!originalResult) return;
    const rawRooms = (originalResult.analysis.rooms || []).filter((r) => r.name !== 'wall');
    setRooms(
      rawRooms.map((r, idx) => ({
        ...r,
        id: r.id || `room_${idx + 1}`,
        real_length: r.real_length || (r.norm_length ? Number((r.norm_length * 0.015).toFixed(2)) : 4.5),
        real_width: r.real_width || (r.norm_width ? Number((r.norm_width * 0.015).toFixed(2)) : 3.8),
      }))
    );
    setDoors(
      (originalResult.analysis.doors || []).map((d, idx) => ({
        ...d,
        id: d.id || `door_${idx + 1}`,
        door_type: d.door_type || 'single_swing',
        width: d.width || 0.9,
      }))
    );
    setWindows(
      (originalResult.analysis.windows || []).map((w, idx) => ({
        ...w,
        id: w.id || `window_${idx + 1}`,
        window_type: w.window_type || 'standard',
        wall_side: w.wall_side || 'north',
        width: w.width || 1.4,
        height: w.height || 1.4,
      }))
    );
    if (rawRooms.length > 0) {
      setSelectedElement({ type: 'room', id: rawRooms[0].id });
    }
  };

  // Coordinate helper for SVG canvas
  const getSvgCoordinates = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const screenCTM = svgRef.current.getScreenCTM();
    if (!screenCTM) return { x: 0, y: 0 };
    const svgP = pt.matrixTransform(screenCTM.inverse());
    return { x: Math.round(svgP.x), y: Math.round(svgP.y) };
  };

  // Start dragging or resizing
  const handleStartDrag = (
    e: React.MouseEvent,
    type: 'room' | 'door' | 'window',
    id: string,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    const { x, y } = getSvgCoordinates(e);
    let box: BoundingBox = { xmin: 0, ymin: 0, xmax: 100, ymax: 100 };

    if (type === 'room') {
      const found = rooms.find((r) => r.id === id);
      if (found) box = { ...found.box_2d };
    } else if (type === 'door') {
      const found = doors.find((d) => d.id === id);
      if (found) box = { ...found.box_2d };
    } else if (type === 'window') {
      const found = windows.find((w) => w.id === id);
      if (found) box = { ...found.box_2d };
    }

    setSelectedElement({ type, id });
    setActiveTab(type === 'room' ? 'rooms' : type === 'door' ? 'doors' : 'windows');

    setDragState({
      isDragging: true,
      type,
      id,
      mode,
      startX: x,
      startY: y,
      initialBox: box,
    });
  };

  // Dragging move handler
  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !dragState.isDragging) return;
    const { x, y } = getSvgCoordinates(e);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;

    const init = dragState.initialBox;

    if (dragState.mode === 'move') {
      const width = init.xmax - init.xmin;
      const height = init.ymax - init.ymin;
      const newXmin = Math.max(0, Math.min(1000 - width, init.xmin + dx));
      const newYmin = Math.max(0, Math.min(1000 - height, init.ymin + dy));
      const newBox = {
        xmin: newXmin,
        ymin: newYmin,
        xmax: newXmin + width,
        ymax: newYmin + height,
      };

      if (dragState.type === 'room') {
        setRooms((prev) => prev.map((r) => (r.id === dragState.id ? { ...r, box_2d: newBox } : r)));
      } else if (dragState.type === 'door') {
        setDoors((prev) => prev.map((d) => (d.id === dragState.id ? { ...d, box_2d: newBox } : d)));
      } else if (dragState.type === 'window') {
        setWindows((prev) => prev.map((w) => (w.id === dragState.id ? { ...w, box_2d: newBox } : w)));
      }
    } else if (dragState.mode === 'resize') {
      const newXmax = Math.max(init.xmin + 40, Math.min(1000, init.xmax + dx));
      const newYmax = Math.max(init.ymin + 40, Math.min(1000, init.ymax + dy));
      const newBox = {
        xmin: init.xmin,
        ymin: init.ymin,
        xmax: newXmax,
        ymax: newYmax,
      };

      const ppmNum = parseFloat(ppm) || 50;
      const imgW = result?.analysis.metadata.image_width || 800;
      const imgH = result?.analysis.metadata.image_height || 600;
      const pw = ((newXmax - init.xmin) / 1000) * imgW;
      const ph = ((newYmax - init.ymin) / 1000) * imgH;
      const realL = Number((Math.max(pw, ph) / ppmNum).toFixed(2));
      const realW = Number((Math.min(pw, ph) / ppmNum).toFixed(2));

      if (dragState.type === 'room') {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === dragState.id
              ? {
                  ...r,
                  box_2d: newBox,
                  real_length: realL,
                  real_width: realW,
                }
              : r
          )
        );
      }
    }
  };

  const handleSvgMouseUp = () => {
    setDragState(null);
  };

  // ROOM OPERATIONS
  const handleUpdateRoom = (id: string, updates: Partial<DetectedRoom>) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };

        // If length or width was edited, adjust bounding box proportionally
        const ppmNum = parseFloat(ppm) || 50;
        const imgW = result?.analysis.metadata.image_width || 800;
        const imgH = result?.analysis.metadata.image_height || 600;

        if (updates.real_length !== undefined && updates.real_length > 0) {
          const normW = Math.min(900, Math.round(((updates.real_length * ppmNum) / imgW) * 1000));
          updated.box_2d = { ...updated.box_2d, xmax: Math.min(1000, updated.box_2d.xmin + normW) };
        }
        if (updates.real_width !== undefined && updates.real_width > 0) {
          const normH = Math.min(900, Math.round(((updates.real_width * ppmNum) / imgH) * 1000));
          updated.box_2d = { ...updated.box_2d, ymax: Math.min(1000, updated.box_2d.ymin + normH) };
        }
        return updated;
      })
    );
  };

  const handleMoveRoom = (id: string, dx: number, dy: number) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const width = r.box_2d.xmax - r.box_2d.xmin;
        const height = r.box_2d.ymax - r.box_2d.ymin;
        const newXmin = Math.max(0, Math.min(1000 - width, r.box_2d.xmin + dx));
        const newYmin = Math.max(0, Math.min(1000 - height, r.box_2d.ymin + dy));
        return {
          ...r,
          box_2d: {
            xmin: newXmin,
            ymin: newYmin,
            xmax: newXmin + width,
            ymax: newYmin + height,
          },
        };
      })
    );
  };

  const handleAddRoom = () => {
    const newId = `room_${Date.now() % 10000}`;
    const offset = (rooms.length % 4) * 40;
    const newRoom: DetectedRoom = {
      id: newId,
      name: 'bedroom',
      detected_label_text: `New Room ${rooms.length + 1}`,
      real_length: 4.5,
      real_width: 3.8,
      box_2d: {
        xmin: 200 + offset,
        ymin: 200 + offset,
        xmax: 520 + offset,
        ymax: 460 + offset,
      },
    };
    setRooms((prev) => [...prev, newRoom]);
    setSelectedElement({ type: 'room', id: newId });
    setActiveTab('rooms');
  };

  const handleDeleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (selectedElement?.id === id) {
      setSelectedElement(null);
    }
  };

  // DOOR OPERATIONS
  const handleUpdateDoor = (id: string, updates: Partial<DetectedOpening>) => {
    setDoors((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleMoveDoor = (id: string, dx: number, dy: number) => {
    setDoors((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const width = d.box_2d.xmax - d.box_2d.xmin;
        const height = d.box_2d.ymax - d.box_2d.ymin;
        const newXmin = Math.max(0, Math.min(1000 - width, d.box_2d.xmin + dx));
        const newYmin = Math.max(0, Math.min(1000 - height, d.box_2d.ymin + dy));
        return {
          ...d,
          box_2d: {
            xmin: newXmin,
            ymin: newYmin,
            xmax: newXmin + width,
            ymax: newYmin + height,
          },
        };
      })
    );
  };

  const handleAddDoor = () => {
    const newId = `door_${Date.now() % 10000}`;
    const offset = (doors.length % 4) * 30;
    const newDoor: DetectedOpening = {
      id: newId,
      door_type: 'single_swing',
      width: 0.9,
      box_2d: {
        xmin: 440 + offset,
        ymin: 440 + offset,
        xmax: 500 + offset,
        ymax: 470 + offset,
      },
    };
    setDoors((prev) => [...prev, newDoor]);
    setSelectedElement({ type: 'door', id: newId });
    setActiveTab('doors');
  };

  const handleDeleteDoor = (id: string) => {
    setDoors((prev) => prev.filter((d) => d.id !== id));
    if (selectedElement?.id === id) {
      setSelectedElement(null);
    }
  };

  // WINDOW OPERATIONS
  const handleUpdateWindow = (id: string, updates: Partial<DetectedOpening>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  const handleMoveWindow = (id: string, dx: number, dy: number) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const width = w.box_2d.xmax - w.box_2d.xmin;
        const height = w.box_2d.ymax - w.box_2d.ymin;
        const newXmin = Math.max(0, Math.min(1000 - width, w.box_2d.xmin + dx));
        const newYmin = Math.max(0, Math.min(1000 - height, w.box_2d.ymin + dy));
        return {
          ...w,
          box_2d: {
            xmin: newXmin,
            ymin: newYmin,
            xmax: newXmin + width,
            ymax: newYmin + height,
          },
        };
      })
    );
  };

  const handleAddWindow = () => {
    const newId = `window_${Date.now() % 10000}`;
    const offset = (windows.length % 4) * 35;
    const newWindow: DetectedOpening = {
      id: newId,
      window_type: 'standard',
      wall_side: 'north',
      width: 1.4,
      height: 1.4,
      box_2d: {
        xmin: 320 + offset,
        ymin: 70,
        xmax: 460 + offset,
        ymax: 90,
      },
    };
    setWindows((prev) => [...prev, newWindow]);
    setSelectedElement({ type: 'window', id: newId });
    setActiveTab('windows');
  };

  const handleDeleteWindow = (id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    if (selectedElement?.id === id) {
      setSelectedElement(null);
    }
  };

  // Aggregate Metrics
  const totalCarpetAreaM2 = useMemo(() => {
    return rooms
      .reduce((sum, r) => {
        const l = r.real_length || 4.0;
        const w = r.real_width || 3.5;
        return sum + l * w;
      }, 0)
      .toFixed(1);
  }, [rooms]);

  const totalCarpetAreaSqft = useMemo(() => {
    return (Number(totalCarpetAreaM2) * 10.764).toFixed(0);
  }, [totalCarpetAreaM2]);

  // Send detected & edited room to Heat Load Calculator
  const handleSendRoomToCalculator = (room: DetectedRoom) => {
    const length = (room.real_length || 4.5).toString();
    const breadth = (room.real_width || 3.8).toString();

    // Map any doors near this room's bounding box
    const nearDoors: any[] = [];
    doors.forEach((d) => {
      if (
        d.box_2d.xmin <= room.box_2d.xmax + 60 &&
        d.box_2d.xmax >= room.box_2d.xmin - 60 &&
        d.box_2d.ymin <= room.box_2d.ymax + 60 &&
        d.box_2d.ymax >= room.box_2d.ymin - 60
      ) {
        const dWidth = d.width || 0.9;
        nearDoors.push({
          wall: 'S',
          width: dWidth.toString(),
          height: '2.1',
          area: (dWidth * 2.1).toFixed(2),
        });
      }
    });

    // Map any windows near this room's bounding box
    const nearWindows: any[] = [];
    windows.forEach((w) => {
      if (
        w.box_2d.xmin <= room.box_2d.xmax + 60 &&
        w.box_2d.xmax >= room.box_2d.xmin - 60 &&
        w.box_2d.ymin <= room.box_2d.ymax + 60 &&
        w.box_2d.ymax >= room.box_2d.ymin - 60
      ) {
        const wWidth = w.width || 1.4;
        const wHeight = w.height || 1.4;
        const orientation = (w.wall_side || 'N').toUpperCase().charAt(0);
        nearWindows.push({
          wall: orientation === 'S' || orientation === 'E' || orientation === 'W' ? orientation : 'N',
          width: wWidth.toString(),
          height: wHeight.toString(),
          area: (wWidth * wHeight).toFixed(2),
          shgc: '0.40',
          uValue: '3.0',
        });
      }
    });

    const prefillData = {
      source: 'FloorPlanReader',
      roomName: room.detected_label_text || room.name || 'Detected Room',
      length,
      breadth,
      height: '3.0',
      unitLength: 'm',
      unitBreadth: 'm',
      unitHeight: 'm',
      doors: nearDoors.length > 0 ? nearDoors : [{ wall: 'S', width: '0.9', height: '2.1', area: '1.89' }],
      windows: nearWindows.length > 0 ? nearWindows : [{ wall: 'N', width: '1.4', height: '1.4', area: '1.96', shgc: '0.40', uValue: '3.0' }],
    };

    sessionStorage.setItem('gb_calculator_prefill', JSON.stringify(prefillData));
    navigate('/calculator');
  };

  // Download updated JSON
  const handleDownloadJSON = () => {
    if (!result) return;
    const exportData = {
      ...result,
      analysis: {
        ...result.analysis,
        metadata: {
          ...result.analysis.metadata,
          total_rooms: rooms.length,
          total_doors: doors.length,
          total_windows: windows.length,
        },
        rooms,
        doors,
        windows,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint_analysis_edited_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Overlay PNG
  const handleDownloadOverlay = () => {
    if (!result?.overlay_base64) return;
    const a = document.createElement('a');
    a.href = result.overlay_base64;
    a.download = `blueprint_overlay_${Date.now()}.png`;
    a.click();
  };

  // Find currently selected room, door, or window
  const activeRoom = useMemo(() => {
    if (selectedElement?.type !== 'room') return null;
    return rooms.find((r) => r.id === selectedElement.id) || null;
  }, [selectedElement, rooms]);

  const activeDoor = useMemo(() => {
    if (selectedElement?.type !== 'door') return null;
    return doors.find((d) => d.id === selectedElement.id) || null;
  }, [selectedElement, doors]);

  const activeWindow = useMemo(() => {
    if (selectedElement?.type !== 'window') return null;
    return windows.find((w) => w.id === selectedElement.id) || null;
  }, [selectedElement, windows]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
      <Navbar title="Floor Plan AI Reader" />

      <main className="container mx-auto px-4 py-8 flex-1 max-w-7xl">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Computer Vision & AI Blueprint Extractor
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Floor Plan Reader</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload 2D drawings or architectural blueprints to detect, edit, move, and calibrate rooms, doors, and windows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/floorplan/generator')}
              className="text-xs"
            >
              Floor Plan Studio
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/calculator')}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Calculator className="w-3.5 h-3.5 mr-1.5" />
              Heat Load Calculator
            </Button>
          </div>
        </div>

        {/* Top Configuration & Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 1. Sample Blueprints Gallery */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Sample Architectural Blueprints</span>
                <span className="text-xs font-normal text-muted-foreground">Select to test immediately</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {samples.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSample(s)}
                    className={`cursor-pointer rounded-xl border p-2.5 transition-all text-left flex flex-col justify-between ${
                      selectedSample?.id === s.id
                        ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-1 ring-sky-500 shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="aspect-4/3 rounded-lg bg-slate-100 dark:bg-zinc-800 mb-2 overflow-hidden flex items-center justify-center border">
                      <img
                        src={`/samples/${s.filename}`}
                        alt={s.title}
                        className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs leading-tight line-clamp-1">{s.title}</span>
                        {selectedSample?.id === s.id && (
                          <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{s.tag}</Badge>
                        <span>{s.rooms_count} rooms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Or Upload Custom Image */}
              <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".png,.jpg,.jpeg,.svg"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-dashed border-slate-300 dark:border-zinc-700"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Upload Custom Plan (.png, .jpg, .svg)
                  </Button>
                  {uploadedFile && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {uploadedFile.name}
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-muted-foreground">
                  Supports blueprints, CAD drawings, and SVG vector plans.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 2. Analysis Settings & Execution */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Analysis Engine</span>
                <Badge variant="secondary" className="text-[10px] bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  Hybrid CV
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-xs">
                <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  Hybrid Computer Vision & Edge Contours
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Deterministic architectural wall contour extraction, opening detection, and spatial partitioning.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Scale Calibration (px/meter)</Label>
                  <span className="text-[10px] text-muted-foreground">Auto / calibrated</span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  value={ppm}
                  onChange={(e) => setPpm(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold h-9 shadow-sm"
                onClick={handleRunAnalysis}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Blueprint...
                  </>
                ) : (
                  <>
                    <FileSearch className="w-4 h-4 mr-2" />
                    Run Floor Plan Analysis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results & Interactive Editor Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900 shadow-xs">
                <span className="text-xs text-muted-foreground">Rooms Detected</span>
                <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                  {rooms.length}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900 shadow-xs">
                <span className="text-xs text-muted-foreground">Doors Detected</span>
                <p className="text-2xl font-extrabold text-indigo-600 mt-0.5">
                  {doors.length}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900 shadow-xs">
                <span className="text-xs text-muted-foreground">Windows Detected</span>
                <p className="text-2xl font-extrabold text-sky-600 mt-0.5">
                  {windows.length}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900 shadow-xs">
                <span className="text-xs text-muted-foreground">Carpet Area</span>
                <p className="text-xl font-bold text-slate-800 dark:text-zinc-200 mt-1">
                  {totalCarpetAreaM2} m²
                  <span className="text-xs font-normal text-muted-foreground ml-1">({totalCarpetAreaSqft} sq ft)</span>
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900 shadow-xs">
                <span className="text-xs text-muted-foreground">Processing Time</span>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mt-1">
                  {result.processing_time_ms ? `${(result.processing_time_ms / 1000).toFixed(2)}s` : 'Fast'}
                </p>
              </div>
            </div>

            {/* Visualizer & Inspector Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Interactive Canvas (7 cols) */}
              <div className="lg:col-span-7 border rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs flex flex-col">
                <div className="p-3 border-b flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide">Interactive CAD View</span>
                    <Badge variant="outline" className="text-[10px]">{result.method_used}</Badge>
                    {dragState?.isDragging && (
                      <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">
                        {dragState.mode === 'move' ? 'Moving' : 'Resizing'} {dragState.type}...
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg border p-0.5 bg-slate-100 dark:bg-zinc-800 text-xs">
                      <button
                        onClick={() => setViewMode('interactive')}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          viewMode === 'interactive'
                            ? 'bg-white dark:bg-zinc-900 text-sky-600 shadow-xs font-bold'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Interactive CAD
                      </button>
                      <button
                        onClick={() => setViewMode('overlay')}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          viewMode === 'overlay'
                            ? 'bg-white dark:bg-zinc-900 text-sky-600 shadow-xs'
                            : 'text-muted-foreground'
                        }`}
                      >
                        AI Overlay
                      </button>
                      <button
                        onClick={() => setViewMode('original')}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          viewMode === 'original'
                            ? 'bg-white dark:bg-zinc-900 text-sky-600 shadow-xs'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Original
                      </button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleDownloadOverlay}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PNG
                    </Button>
                  </div>
                </div>

                {/* Drawing Area */}
                <div className="p-4 flex-1 flex items-center justify-center bg-slate-900 min-h-[460px] overflow-hidden relative">
                  {viewMode === 'interactive' ? (
                    <div className="relative w-full h-[460px] flex items-center justify-center">
                      <svg
                        ref={svgRef}
                        viewBox="0 0 1000 1000"
                        className="w-full h-full max-h-[460px] select-none rounded border border-slate-800 shadow-lg cursor-crosshair"
                        onMouseMove={handleSvgMouseMove}
                        onMouseUp={handleSvgMouseUp}
                        onMouseLeave={handleSvgMouseUp}
                      >
                        {/* Background blueprint image */}
                        {(previewUrl || result.overlay_base64) && (
                          <image
                            href={previewUrl || result.overlay_base64}
                            x="0"
                            y="0"
                            width="1000"
                            height="1000"
                            preserveAspectRatio="xMidYMid meet"
                            opacity={0.88}
                          />
                        )}

                        {/* Render Rooms */}
                        {rooms.map((room, idx) => {
                          const rx = room.box_2d.xmin;
                          const ry = room.box_2d.ymin;
                          const rw = Math.max(20, room.box_2d.xmax - room.box_2d.xmin);
                          const rh = Math.max(20, room.box_2d.ymax - room.box_2d.ymin);
                          const isSelected = selectedElement?.type === 'room' && selectedElement.id === room.id;
                          const theme = getRoomColor(room.name, idx);

                          return (
                            <g
                              key={room.id}
                              className="cursor-move"
                              onMouseDown={(e) => handleStartDrag(e, 'room', room.id, 'move')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElement({ type: 'room', id: room.id });
                                setActiveTab('rooms');
                              }}
                            >
                              {/* Room Fill Rectangle */}
                              <rect
                                x={rx}
                                y={ry}
                                width={rw}
                                height={rh}
                                fill={theme.bg}
                                fillOpacity={isSelected ? 0.45 : 0.28}
                                stroke={isSelected ? '#38bdf8' : theme.border}
                                strokeWidth={isSelected ? 3.5 : 2}
                                strokeDasharray={isSelected ? '6,3' : undefined}
                                rx={4}
                              />

                              {/* Room Center Badge */}
                              <g transform={`translate(${rx + rw / 2}, ${ry + rh / 2})`}>
                                <rect
                                  x={-65}
                                  y={-18}
                                  width={130}
                                  height={36}
                                  rx={6}
                                  fill="#ffffff"
                                  fillOpacity={0.94}
                                  stroke={isSelected ? '#38bdf8' : theme.border}
                                  strokeWidth={isSelected ? 2 : 1}
                                />
                                <text
                                  x={0}
                                  y={-3}
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight="bold"
                                  fill="#0f172a"
                                >
                                  {room.detected_label_text || room.name}
                                </text>
                                <text
                                  x={0}
                                  y={11}
                                  textAnchor="middle"
                                  fontSize="9.5"
                                  fontWeight="500"
                                  fill="#475569"
                                >
                                  {room.real_length || 4.5}m × {room.real_width || 3.8}m
                                </text>
                              </g>

                              {/* Corner Resize Handle if Selected */}
                              {isSelected && (
                                <circle
                                  cx={rx + rw}
                                  cy={ry + rh}
                                  r={8}
                                  fill="#0284c7"
                                  stroke="#ffffff"
                                  strokeWidth={2}
                                  className="cursor-nwse-resize"
                                  onMouseDown={(e) => handleStartDrag(e, 'room', room.id, 'resize')}
                                />
                              )}
                            </g>
                          );
                        })}

                        {/* Render Doors */}
                        {doors.map((door) => {
                          const dx = door.box_2d.xmin;
                          const dy = door.box_2d.ymin;
                          const dw = Math.max(14, door.box_2d.xmax - door.box_2d.xmin);
                          const dh = Math.max(14, door.box_2d.ymax - door.box_2d.ymin);
                          const isSelected = selectedElement?.type === 'door' && selectedElement.id === door.id;

                          return (
                            <g
                              key={door.id}
                              className="cursor-move"
                              onMouseDown={(e) => handleStartDrag(e, 'door', door.id, 'move')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElement({ type: 'door', id: door.id });
                                setActiveTab('doors');
                              }}
                            >
                              <rect
                                x={dx}
                                y={dy}
                                width={dw}
                                height={dh}
                                fill="#10b981"
                                fillOpacity={isSelected ? 0.95 : 0.8}
                                stroke={isSelected ? '#ffffff' : '#047857'}
                                strokeWidth={isSelected ? 2.5 : 1.5}
                                rx={2}
                              />
                              <text
                                x={dx + dw / 2}
                                y={dy + dh / 2 + 4}
                                textAnchor="middle"
                                fontSize="10"
                                fontWeight="bold"
                                fill="#ffffff"
                              >
                                🚪
                              </text>
                            </g>
                          );
                        })}

                        {/* Render Windows */}
                        {windows.map((win) => {
                          const wx = win.box_2d.xmin;
                          const wy = win.box_2d.ymin;
                          const ww = Math.max(14, win.box_2d.xmax - win.box_2d.xmin);
                          const wh = Math.max(14, win.box_2d.ymax - win.box_2d.ymin);
                          const isSelected = selectedElement?.type === 'window' && selectedElement.id === win.id;

                          return (
                            <g
                              key={win.id}
                              className="cursor-move"
                              onMouseDown={(e) => handleStartDrag(e, 'window', win.id, 'move')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElement({ type: 'window', id: win.id });
                                setActiveTab('windows');
                              }}
                            >
                              <rect
                                x={wx}
                                y={wy}
                                width={ww}
                                height={wh}
                                fill="#0284c7"
                                fillOpacity={isSelected ? 0.95 : 0.8}
                                stroke={isSelected ? '#ffffff' : '#0369a1'}
                                strokeWidth={isSelected ? 2.5 : 1.5}
                                rx={2}
                              />
                              <text
                                x={wx + ww / 2}
                                y={wy + wh / 2 + 3}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#ffffff"
                              >
                                🪟
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  ) : viewMode === 'overlay' && result.overlay_base64 ? (
                    <img
                      src={result.overlay_base64}
                      alt="AI Visual Overlay"
                      className="max-h-[460px] object-contain rounded border border-slate-800 shadow-lg"
                    />
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Original Blueprint"
                      className="max-h-[460px] object-contain rounded border border-slate-800 shadow-lg"
                    />
                  ) : (
                    <div className="text-white text-xs">No image to display</div>
                  )}
                </div>

                {/* Canvas Footer Hint */}
                <div className="px-4 py-2 border-t bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Rooms (drag or resize handle)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> 🚪 Doors
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 inline-block" /> 🪟 Windows
                    </span>
                  </div>
                  <span>Click any element to select and edit</span>
                </div>
              </div>

              {/* Right: Inspector & Interactive Element Editor (5 cols) */}
              <div className="lg:col-span-5 border rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  {/* Top Header with Tab Switcher */}
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div className="inline-flex rounded-lg border p-0.5 bg-slate-100 dark:bg-zinc-800 text-xs">
                      <button
                        onClick={() => setActiveTab('rooms')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          activeTab === 'rooms'
                            ? 'bg-white dark:bg-zinc-900 text-emerald-600 shadow-xs'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <Square className="w-3.5 h-3.5" />
                        Rooms ({rooms.length})
                      </button>

                      <button
                        onClick={() => setActiveTab('doors')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          activeTab === 'doors'
                            ? 'bg-white dark:bg-zinc-900 text-emerald-600 shadow-xs'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <DoorClosed className="w-3.5 h-3.5" />
                        Doors ({doors.length})
                      </button>

                      <button
                        onClick={() => setActiveTab('windows')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          activeTab === 'windows'
                            ? 'bg-white dark:bg-zinc-900 text-sky-600 shadow-xs'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        Windows ({windows.length})
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleResetToAI}
                        title="Revert all edits to initial AI detection"
                      >
                        <Undo2 className="w-3 h-3 mr-1" />
                        Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleDownloadJSON}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        JSON
                      </Button>
                    </div>
                  </div>

                  {/* TAB 1: ROOMS INSPECTOR */}
                  {activeTab === 'rooms' && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                          Room Dimensions & Placement
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={handleAddRoom}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Room
                        </Button>
                      </div>

                      {/* Active Room Detail Editor (if a room is selected) */}
                      {activeRoom && (
                        <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                              <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                                Editing: {activeRoom.detected_label_text || activeRoom.name}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                              onClick={() => handleDeleteRoom(activeRoom.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px]">Room Label</Label>
                              <Input
                                value={activeRoom.detected_label_text || activeRoom.name}
                                onChange={(e) => handleUpdateRoom(activeRoom.id, { detected_label_text: e.target.value })}
                                className="h-7 text-xs mt-0.5 bg-white dark:bg-zinc-900"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px]">Room Type</Label>
                              <select
                                value={activeRoom.name || 'bedroom'}
                                onChange={(e) => handleUpdateRoom(activeRoom.id, { name: e.target.value })}
                                className="h-7 text-xs mt-0.5 w-full rounded-md border border-input bg-white dark:bg-zinc-900 px-2 py-0 text-xs shadow-xs"
                              >
                                <option value="living_room">Living Room</option>
                                <option value="master_bedroom">Master Bedroom</option>
                                <option value="bedroom">Bedroom</option>
                                <option value="kitchen">Kitchen</option>
                                <option value="dining">Dining</option>
                                <option value="bathroom">Bathroom</option>
                                <option value="balcony">Balcony</option>
                                <option value="office">Office / Study</option>
                              </select>
                            </div>
                          </div>

                          {/* Dimensions in Meters */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <Label className="text-[11px]">Length (meters)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="30.0"
                                value={activeRoom.real_length || 4.5}
                                onChange={(e) => handleUpdateRoom(activeRoom.id, { real_length: parseFloat(e.target.value) || 1.0 })}
                                className="h-7 text-xs mt-0.5 bg-white dark:bg-zinc-900"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px]">Width (meters)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="30.0"
                                value={activeRoom.real_width || 3.8}
                                onChange={(e) => handleUpdateRoom(activeRoom.id, { real_width: parseFloat(e.target.value) || 1.0 })}
                                className="h-7 text-xs mt-0.5 bg-white dark:bg-zinc-900"
                              />
                            </div>
                          </div>

                          {/* Move Nudge Controls */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Move className="w-3 h-3" /> Nudge Position
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveRoom(activeRoom.id, -20, 0)}
                                title="Move Left"
                              >
                                ←
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveRoom(activeRoom.id, 20, 0)}
                                title="Move Right"
                              >
                                →
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveRoom(activeRoom.id, 0, -20)}
                                title="Move Up"
                              >
                                ↑
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveRoom(activeRoom.id, 0, 20)}
                                title="Move Down"
                              >
                                ↓
                              </Button>
                            </div>
                          </div>

                          {/* 1-Click Send to Calculator */}
                          <Button
                            size="sm"
                            className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                            onClick={() => handleSendRoomToCalculator(activeRoom)}
                          >
                            <Calculator className="w-3 h-3 mr-1.5" />
                            Calculate Heat Load for this Room
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      )}

                      {/* All Rooms List */}
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {rooms.map((room, idx) => {
                          const realL = room.real_length || 4.5;
                          const realW = room.real_width || 3.8;
                          const area = (realL * realW).toFixed(1);
                          const isSelected = selectedElement?.type === 'room' && selectedElement.id === room.id;
                          const theme = getRoomColor(room.name, idx);

                          return (
                            <div
                              key={room.id}
                              onClick={() => setSelectedElement({ type: 'room', id: room.id })}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 ring-1 ring-sky-500'
                                  : 'border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 hover:bg-slate-100/70'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: theme.border }}
                                />
                                <div>
                                  <span className="font-semibold text-xs capitalize block">
                                    {room.detected_label_text || room.name || `Room ${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {realL}m × {realW}m ({area} m²)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendRoomToCalculator(room);
                                  }}
                                >
                                  Calculate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoom(room.id);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DOORS INSPECTOR */}
                  {activeTab === 'doors' && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                          Detected & Added Doors
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={handleAddDoor}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Door
                        </Button>
                      </div>

                      {/* Active Door Detail Editor */}
                      {activeDoor && (
                        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                              Editing: {activeDoor.id}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteDoor(activeDoor.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px]">Door Type</Label>
                              <select
                                value={activeDoor.door_type || 'single_swing'}
                                onChange={(e) => handleUpdateDoor(activeDoor.id, { door_type: e.target.value })}
                                className="h-7 text-xs mt-0.5 w-full rounded-md border border-input bg-white dark:bg-zinc-900 px-2 py-0 text-xs shadow-xs"
                              >
                                <option value="single_swing">Single Swing</option>
                                <option value="double_swing">Double Swing</option>
                                <option value="sliding">Sliding Door</option>
                                <option value="opening">Opening / Archway</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-[11px]">Width (meters)</Label>
                              <Input
                                type="number"
                                step="0.05"
                                min="0.6"
                                max="3.0"
                                value={activeDoor.width || 0.9}
                                onChange={(e) => handleUpdateDoor(activeDoor.id, { width: parseFloat(e.target.value) || 0.9 })}
                                className="h-7 text-xs mt-0.5 bg-white dark:bg-zinc-900"
                              />
                            </div>
                          </div>

                          {/* Move Nudge Controls */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Move className="w-3 h-3" /> Move Position
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveDoor(activeDoor.id, -20, 0)}
                                title="Move Left"
                              >
                                ←
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveDoor(activeDoor.id, 20, 0)}
                                title="Move Right"
                              >
                                →
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveDoor(activeDoor.id, 0, -20)}
                                title="Move Up"
                              >
                                ↑
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveDoor(activeDoor.id, 0, 20)}
                                title="Move Down"
                              >
                                ↓
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* All Doors List */}
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {doors.map((door, idx) => {
                          const isSelected = selectedElement?.type === 'door' && selectedElement.id === door.id;
                          return (
                            <div
                              key={door.id}
                              onClick={() => setSelectedElement({ type: 'door', id: door.id })}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                                  : 'border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 hover:bg-slate-100/70'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">🚪</span>
                                <div>
                                  <span className="font-semibold text-xs capitalize block">
                                    {door.id || `Door ${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground capitalize">
                                    {door.door_type?.replace('_', ' ') || 'Single Swing'} · {door.width || 0.9}m
                                  </span>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDoor(door.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: WINDOWS INSPECTOR */}
                  {activeTab === 'windows' && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                          Detected & Added Windows
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-sky-600 border-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          onClick={handleAddWindow}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Window
                        </Button>
                      </div>

                      {/* Active Window Detail Editor */}
                      {activeWindow && (
                        <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                              Editing: {activeWindow.id}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteWindow(activeWindow.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px]">Wall Orientation</Label>
                              <select
                                value={activeWindow.wall_side || 'north'}
                                onChange={(e) => handleUpdateWindow(activeWindow.id, { wall_side: e.target.value })}
                                className="h-7 text-xs mt-0.5 w-full rounded-md border border-input bg-white dark:bg-zinc-900 px-2 py-0 text-xs shadow-xs"
                              >
                                <option value="north">North (N)</option>
                                <option value="south">South (S)</option>
                                <option value="east">East (E)</option>
                                <option value="west">West (W)</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-[11px]">Window Type</Label>
                              <select
                                value={activeWindow.window_type || 'standard'}
                                onChange={(e) => handleUpdateWindow(activeWindow.id, { window_type: e.target.value })}
                                className="h-7 text-xs mt-0.5 w-full rounded-md border border-input bg-white dark:bg-zinc-900 px-2 py-0 text-xs shadow-xs"
                              >
                                <option value="standard">Standard Glass</option>
                                <option value="sliding">Sliding Window</option>
                                <option value="fixed">Fixed Glazing</option>
                                <option value="bay">Bay Window</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <Label className="text-[11px]">Width (meters)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0.5"
                                max="4.0"
                                value={activeWindow.width || 1.4}
                                onChange={(e) => handleUpdateWindow(activeWindow.id, { width: parseFloat(e.target.value) || 1.4 })}
                                className="h-7 text-xs mt-0.5 bg-white dark:bg-zinc-900"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px]">Height (meters)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0.5"
                                max="3.0"
                                value={activeWindow.height || 1.4}
                                onChange={(e) => handleUpdateWindow(activeWindow.id, { height: parseFloat(e.target.value) || 1.4 })}
                                className="h-7 text-xs mt-0.5 bg-white dark:bg-zinc-900"
                              />
                            </div>
                          </div>

                          {/* Move Nudge Controls */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Move className="w-3 h-3" /> Move Position
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveWindow(activeWindow.id, -20, 0)}
                                title="Move Left"
                              >
                                ←
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveWindow(activeWindow.id, 20, 0)}
                                title="Move Right"
                              >
                                →
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveWindow(activeWindow.id, 0, -20)}
                                title="Move Up"
                              >
                                ↑
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => handleMoveWindow(activeWindow.id, 0, 20)}
                                title="Move Down"
                              >
                                ↓
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* All Windows List */}
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {windows.map((win, idx) => {
                          const isSelected = selectedElement?.type === 'window' && selectedElement.id === win.id;
                          const winArea = ((win.width || 1.4) * (win.height || 1.4)).toFixed(2);
                          return (
                            <div
                              key={win.id}
                              onClick={() => setSelectedElement({ type: 'window', id: win.id })}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 ring-1 ring-sky-500'
                                  : 'border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 hover:bg-slate-100/70'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">🪟</span>
                                <div>
                                  <span className="font-semibold text-xs capitalize block">
                                    {win.id || `Window ${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground capitalize">
                                    {(win.wall_side || 'North').toUpperCase()} Wall · {win.width || 1.4}m × {win.height || 1.4}m ({winArea} m²)
                                  </span>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWindow(win.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Ready for Heat Load & Building Simulation</span>
                    <span className="text-emerald-600 font-semibold">{rooms.length} Spaces Calibrated</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => navigate('/floorplan/generator')}
                    >
                      Floor Plan Studio
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                      onClick={() => {
                        if (rooms.length > 0) {
                          handleSendRoomToCalculator(rooms[0]);
                        } else {
                          navigate('/calculator');
                        }
                      }}
                    >
                      <Calculator className="w-3 h-3 mr-1" />
                      Heat Calculator
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
