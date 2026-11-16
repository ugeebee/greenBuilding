import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import FloorPlan, {
  getCompassDirection,
  getCompassFullName,
} from './FloorPlan';
import type {
  RoomConfig,
  Opening,
  WallSide,
  FloorPlanTheme,
  UnitSystem,
} from './FloorPlan';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCode,
} from './icons';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { 
  Calculator, 
  ArrowRight, 
  AlertCircle
} from 'lucide-react';

export type MultiRoomPreset = {
  name: string;
  exteriorWallThickness: number;
  interiorWallThickness: number;
  rooms: RoomConfig[];
};

export const SINGLE_ROOM_PRESETS: { name: string; breadth: number; length: number; wallThickness: number; openings: Opening[] }[] = [
  {
    name: 'Master Bedroom Suite',
    breadth: 5.5,
    length: 4.5,
    wallThickness: 0.20,
    openings: [
      { id: 'mb-d1', type: 'door', wall: 'S', position: 0.8, width: 0.9, flipHinge: false, flipSwing: false },
      { id: 'mb-w1', type: 'window', wall: 'N', position: 1.8, width: 1.8 },
      { id: 'mb-w2', type: 'window', wall: 'E', position: 1.2, width: 1.2 },
    ],
  },
  {
    name: 'Studio Living & Work',
    breadth: 6.5,
    length: 5.0,
    wallThickness: 0.20,
    openings: [
      { id: 'st-d1', type: 'door', wall: 'W', position: 0.6, width: 0.95, flipHinge: true, flipSwing: false },
      { id: 'st-w1', type: 'window', wall: 'E', position: 1.0, width: 2.2 },
      { id: 'st-w2', type: 'window', wall: 'N', position: 2.0, width: 1.6 },
    ],
  },
  {
    name: 'Modern Kitchen & Dining',
    breadth: 4.8,
    length: 3.6,
    wallThickness: 0.20,
    openings: [
      { id: 'kd-d1', type: 'door', wall: 'S', position: 0.6, width: 0.9, flipHinge: false, flipSwing: false },
      { id: 'kd-w1', type: 'window', wall: 'N', position: 1.4, width: 2.0 },
    ],
  },
];

export const MULTI_ROOM_PRESETS: MultiRoomPreset[] = [
  {
    name: '1-BHK Urban Residence',
    exteriorWallThickness: 0.20,
    interiorWallThickness: 0.10,
    rooms: [
      {
        id: '1bhk-living',
        name: 'Living & Dining',
        type: 'living',
        x: 0.0,
        y: 0.0,
        breadth: 5.0,
        length: 4.5,
        openings: [
          { id: '1bhk-main-door', type: 'door', wall: 'W', position: 0.6, width: 1.0, flipHinge: false, flipSwing: false },
          { id: '1bhk-liv-w1', type: 'window', wall: 'N', position: 1.5, width: 2.0 },
          { id: '1bhk-liv-bed-door', type: 'door', wall: 'E', position: 1.0, width: 0.9, flipHinge: false, flipSwing: true },
        ],
      },
      {
        id: '1bhk-bed',
        name: 'Master Bedroom',
        type: 'bedroom',
        x: 5.0,
        y: 0.0,
        breadth: 4.0,
        length: 3.5,
        openings: [
          { id: '1bhk-bed-w1', type: 'window', wall: 'N', position: 1.0, width: 1.8 },
          { id: '1bhk-bed-w2', type: 'window', wall: 'E', position: 1.0, width: 1.4 },
        ],
      },
      {
        id: '1bhk-kitchen',
        name: 'Kitchen',
        type: 'kitchen',
        x: 0.0,
        y: 4.5,
        breadth: 3.0,
        length: 2.5,
        openings: [
          { id: '1bhk-k-d1', type: 'door', wall: 'N', position: 0.6, width: 0.85, flipHinge: false, flipSwing: true },
          { id: '1bhk-k-w1', type: 'window', wall: 'S', position: 0.8, width: 1.4 },
        ],
      },
      {
        id: '1bhk-bath',
        name: 'Bathroom',
        type: 'bathroom',
        x: 3.0,
        y: 4.5,
        breadth: 2.0,
        length: 2.5,
        openings: [
          { id: '1bhk-b-d1', type: 'door', wall: 'N', position: 0.5, width: 0.75, flipHinge: false, flipSwing: true },
          { id: '1bhk-b-w1', type: 'window', wall: 'S', position: 0.6, width: 0.8 },
        ],
      },
      {
        id: '1bhk-foyer',
        name: 'Balcony & Foyer',
        type: 'balcony',
        x: 5.0,
        y: 3.5,
        breadth: 4.0,
        length: 2.0,
        openings: [
          { id: '1bhk-f-w1', type: 'window', wall: 'E', position: 0.5, width: 2.5 },
        ],
      },
    ],
  },
  {
    name: '2-BHK Contemporary Apartment',
    exteriorWallThickness: 0.20,
    interiorWallThickness: 0.10,
    rooms: [
      {
        id: '2bhk-living',
        name: 'Living & Dining Room',
        type: 'living',
        x: 0.0,
        y: 0.0,
        breadth: 6.0,
        length: 4.5,
        openings: [
          { id: '2bhk-main', type: 'door', wall: 'W', position: 0.8, width: 1.0, flipHinge: false, flipSwing: false },
          { id: '2bhk-liv-w', type: 'window', wall: 'N', position: 1.5, width: 2.4 },
          { id: '2bhk-d-mb', type: 'door', wall: 'E', position: 1.0, width: 0.9, flipHinge: false, flipSwing: true },
        ],
      },
      {
        id: '2bhk-master',
        name: 'Master Suite',
        type: 'bedroom',
        x: 6.0,
        y: 0.0,
        breadth: 4.5,
        length: 4.5,
        openings: [
          { id: '2bhk-mb-w', type: 'window', wall: 'N', position: 1.2, width: 2.0 },
          { id: '2bhk-mb-e', type: 'window', wall: 'E', position: 1.5, width: 1.6 },
          { id: '2bhk-d-ensuite', type: 'door', wall: 'S', position: 2.8, width: 0.8, flipHinge: false, flipSwing: true },
        ],
      },
      {
        id: '2bhk-kitchen',
        name: 'Kitchen & Utility',
        type: 'kitchen',
        x: 0.0,
        y: 4.5,
        breadth: 3.0,
        length: 3.5,
        openings: [
          { id: '2bhk-k-d', type: 'door', wall: 'N', position: 0.8, width: 0.85, flipHinge: false, flipSwing: true },
          { id: '2bhk-k-w', type: 'window', wall: 'W', position: 1.0, width: 1.4 },
          { id: '2bhk-k-s', type: 'window', wall: 'S', position: 0.8, width: 1.4 },
        ],
      },
      {
        id: '2bhk-bath2',
        name: 'Common Restroom',
        type: 'bathroom',
        x: 3.0,
        y: 4.5,
        breadth: 1.8,
        length: 2.5,
        openings: [
          { id: '2bhk-b2-d', type: 'door', wall: 'N', position: 0.5, width: 0.75, flipHinge: false, flipSwing: true },
          { id: '2bhk-b2-w', type: 'window', wall: 'S', position: 0.5, width: 0.8 },
        ],
      },
      {
        id: '2bhk-bed2',
        name: 'Guest Bedroom',
        type: 'bedroom',
        x: 4.8,
        y: 4.5,
        breadth: 3.7,
        length: 3.5,
        openings: [
          { id: '2bhk-b2-door', type: 'door', wall: 'N', position: 0.2, width: 0.85, flipHinge: false, flipSwing: true },
          { id: '2bhk-b2-w', type: 'window', wall: 'S', position: 1.0, width: 1.8 },
        ],
      },
      {
        id: '2bhk-ensuite',
        name: 'En-Suite Bath',
        type: 'bathroom',
        x: 8.5,
        y: 4.5,
        breadth: 2.0,
        length: 2.5,
        openings: [
          { id: '2bhk-es-w', type: 'window', wall: 'S', position: 0.6, width: 0.8 },
        ],
      },
    ],
  },
  {
    name: 'Executive Office Suite',
    exteriorWallThickness: 0.25,
    interiorWallThickness: 0.10,
    rooms: [
      {
        id: 'off-rec',
        name: 'Reception & Lobby',
        type: 'office',
        x: 0.0,
        y: 0.0,
        breadth: 5.0,
        length: 4.0,
        openings: [
          { id: 'off-main-d', type: 'door', wall: 'W', position: 0.8, width: 1.2, flipHinge: false, flipSwing: false },
          { id: 'off-rec-w', type: 'window', wall: 'N', position: 1.5, width: 2.0 },
        ],
      },
      {
        id: 'off-conf',
        name: 'Conference Room',
        type: 'office',
        x: 5.0,
        y: 0.0,
        breadth: 5.5,
        length: 4.0,
        openings: [
          { id: 'off-conf-d', type: 'door', wall: 'W', position: 0.8, width: 0.95, flipHinge: false, flipSwing: true },
          { id: 'off-conf-w', type: 'window', wall: 'N', position: 1.5, width: 2.4 },
          { id: 'off-conf-w2', type: 'window', wall: 'E', position: 1.0, width: 1.8 },
        ],
      },
      {
        id: 'off-exec',
        name: 'Executive Cabin',
        type: 'office',
        x: 0.0,
        y: 4.0,
        breadth: 4.5,
        length: 3.5,
        openings: [
          { id: 'off-exec-d', type: 'door', wall: 'N', position: 0.6, width: 0.9, flipHinge: false, flipSwing: true },
          { id: 'off-exec-w', type: 'window', wall: 'W', position: 1.0, width: 1.8 },
        ],
      },
      {
        id: 'off-open',
        name: 'Workstation Floor',
        type: 'office',
        x: 4.5,
        y: 4.0,
        breadth: 6.0,
        length: 4.8,
        openings: [
          { id: 'off-work-w1', type: 'window', wall: 'E', position: 1.5, width: 2.6 },
          { id: 'off-work-w2', type: 'window', wall: 'S', position: 1.8, width: 2.4 },
        ],
      },
      {
        id: 'off-bath',
        name: 'Restroom',
        type: 'bathroom',
        x: 0.0,
        y: 7.5,
        breadth: 2.5,
        length: 2.0,
        openings: [
          { id: 'off-bath-d', type: 'door', wall: 'N', position: 0.5, width: 0.75, flipHinge: false, flipSwing: true },
        ],
      },
    ],
  },
];

export default function FloorPlanGenerator() {
  const navigate = useNavigate();

  // Mode
  const [studioMode, setStudioMode] = useState<'single' | 'multi'>('multi');

  // Single room state
  const [singleRoom, setSingleRoom] = useState<RoomConfig>(SINGLE_ROOM_PRESETS[0]);

  // Multi-room state
  const [multiPresets, setMultiPresets] = useState<MultiRoomPreset[]>(MULTI_ROOM_PRESETS);
  const [activeMultiIndex, setActiveMultiIndex] = useState<number>(0);
  const [multiRooms, setMultiRooms] = useState<RoomConfig[]>(MULTI_ROOM_PRESETS[0].rooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(MULTI_ROOM_PRESETS[0].rooms[0].id || null);

  // Wall thicknesses
  const [exteriorWallThickness, setExteriorWallThickness] = useState<number>(0.20);
  const [interiorWallThickness, setInteriorWallThickness] = useState<number>(0.10);

  // CAD Studio Controls
  const [unit, setUnit] = useState<UnitSystem>('metric');
  const [theme, setTheme] = useState<FloorPlanTheme>('cad-light');
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  // Viewport Controls
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  // New Opening Form State
  const [newType, setNewType] = useState<'door' | 'window'>('door');
  const [newWall, setNewWall] = useState<WallSide>('N');
  const [newPos, setNewPos] = useState<number>(1.0);
  const [newWidth, setNewWidth] = useState<number>(0.9);

  // Orientation
  const [orientation, setOrientation] = useState<number>(0);

  // Sidebar Tab
  const [activeTab, setActiveTab] = useState<'rooms' | 'walls' | 'openings' | 'analytics'>('rooms');

  // Validation
  const [backendWarnings, setBackendWarnings] = useState<string[]>([]);
  const [backendStatus, setBackendStatus] = useState<string>('idle');

  // Fetch presets from backend if available
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await fetch('/api/floorplan/multi-room-presets');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setMultiPresets(data);
          }
        }
      } catch {
        // Fallback to local MULTI_ROOM_PRESETS
      }
    };
    fetchPresets();
  }, []);

  // Validation hook
  useEffect(() => {
    const runValidation = async () => {
      try {
        setBackendStatus('validating');
        if (studioMode === 'single') {
          const res = await fetch('/api/floorplan/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(singleRoom),
          });
          if (res.ok) {
            const data = await res.json();
            setBackendWarnings(data.metrics?.warnings || []);
            setBackendStatus('success');
          }
        } else {
          const res = await fetch('/api/floorplan/validate-multi-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Multi-Room Plan',
              exteriorWallThickness,
              interiorWallThickness,
              rooms: multiRooms,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setBackendWarnings(data.metrics?.warnings || []);
            setBackendStatus('success');
          }
        }
      } catch {
        setBackendStatus('offline');
      }
    };

    const timer = setTimeout(runValidation, 300);
    return () => clearTimeout(timer);
  }, [studioMode, singleRoom, multiRooms, exteriorWallThickness, interiorWallThickness]);

  // Current active room
  const currentRoom: RoomConfig = useMemo(() => {
    if (studioMode === 'single') return singleRoom;
    const found = multiRooms.find((r) => r.id === selectedRoomId);
    return found || multiRooms[0] || singleRoom;
  }, [studioMode, singleRoom, multiRooms, selectedRoomId]);

  // Update room handler
  const handleUpdateCurrentRoom = (updated: RoomConfig) => {
    if (studioMode === 'single') {
      setSingleRoom(updated);
    } else {
      setMultiRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
  };

  // Add Room
  const handleAddRoom = (type: RoomConfig['type'] = 'bedroom') => {
    const newId = `room-${Date.now().toString(36)}`;
    const refRoom = currentRoom;
    const newX = Math.round(((refRoom.x || 0) + refRoom.breadth) * 10) / 10;
    const newY = Math.round((refRoom.y || 0) * 10) / 10;

    const newRoom: RoomConfig = {
      id: newId,
      name: `${type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Room'} ${multiRooms.length + 1}`,
      type: type || 'bedroom',
      x: newX,
      y: newY,
      breadth: 4.0,
      length: 3.5,
      openings: [
        { id: `op-${newId}-d1`, type: 'door', wall: 'W', position: 0.6, width: 0.9, flipHinge: false, flipSwing: true },
        { id: `op-${newId}-w1`, type: 'window', wall: 'E', position: 1.0, width: 1.4 },
      ],
    };

    setMultiRooms((prev) => [...prev, newRoom]);
    setSelectedRoomId(newId);
  };

  // Delete Room
  const handleDeleteRoom = (id: string) => {
    if (multiRooms.length <= 1) return;
    setMultiRooms((prev) => prev.filter((r) => r.id !== id));
    if (selectedRoomId === id) {
      const remaining = multiRooms.filter((r) => r.id !== id);
      setSelectedRoomId(remaining[0]?.id || null);
    }
  };

  // Add Opening
  const handleAddOpening = () => {
    const newOp: Opening = {
      id: `op-${Date.now().toString(36)}`,
      type: newType,
      wall: newWall,
      position: Number(newPos),
      width: Number(newWidth),
      flipHinge: false,
      flipSwing: false,
    };
    handleUpdateCurrentRoom({
      ...currentRoom,
      openings: [...currentRoom.openings, newOp],
    });
  };

  // Delete Opening
  const handleDeleteOpening = (opId: string) => {
    handleUpdateCurrentRoom({
      ...currentRoom,
      openings: currentRoom.openings.filter((o) => o.id !== opId),
    });
    if (selectedOpeningId === opId) setSelectedOpeningId(null);
  };

  // Metrics
  const activeRoomArea = useMemo(() => {
    return currentRoom.breadth * currentRoom.length;
  }, [currentRoom]);

  const activeRoomWindowArea = useMemo(() => {
    return currentRoom.openings
      .filter((o) => o.type === 'window')
      .reduce((sum, o) => sum + o.width * 1.4, 0);
  }, [currentRoom]);

  const activeDaylightRatio = useMemo(() => {
    if (activeRoomArea <= 0) return 0;
    return (activeRoomWindowArea / activeRoomArea) * 100;
  }, [activeRoomArea, activeRoomWindowArea]);

  const totalCarpetArea = useMemo(() => {
    if (studioMode === 'single') return activeRoomArea;
    return multiRooms.reduce((sum, r) => sum + r.breadth * r.length, 0);
  }, [studioMode, activeRoomArea, multiRooms]);

  // Export Room to Green Building Heat Load Calculator
  const handleSendToCalculator = (targetRoom?: RoomConfig) => {
    const roomToSend = targetRoom || currentRoom;
    // Map openings into doors and windows for Wizard
    const doors = roomToSend.openings
      .filter((o) => o.type === 'door')
      .map((d) => ({
        wall: d.wall,
        width: d.width.toString(),
        height: '2.1', // standard door height in meters
        area: (d.width * 2.1).toFixed(2),
      }));

    const windows = roomToSend.openings
      .filter((o) => o.type === 'window')
      .map((w) => ({
        wall: w.wall,
        width: w.width.toString(),
        height: '1.4', // standard window height in meters
        area: (w.width * 1.4).toFixed(2),
        shgc: '0.40',
        uValue: '3.0',
      }));

    const prefillData = {
      source: 'FloorPlanStudio',
      roomName: roomToSend.name || 'Custom Room',
      length: roomToSend.length.toString(),
      breadth: roomToSend.breadth.toString(),
      height: '3.0', // standard 3m ceiling
      unitLength: 'm',
      unitBreadth: 'm',
      unitHeight: 'm',
      doors,
      windows,
    };

    sessionStorage.setItem('gb_calculator_prefill', JSON.stringify(prefillData));
    navigate('/calculator');
  };

  // Export JSON
  const handleExportJSON = () => {
    const payload = studioMode === 'single' ? singleRoom : { exteriorWallThickness, interiorWallThickness, rooms: multiRooms };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `floorplan_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
      <Navbar title="Floor Plan Studio" />

      {/* Main Studio Container */}
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
        {/* Top Control Bar */}
        <div className="border-b bg-white dark:bg-zinc-900 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          {/* Left Controls: Mode & Preset */}
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border p-0.5 bg-slate-100 dark:bg-zinc-800">
              <button
                onClick={() => setStudioMode('single')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  studioMode === 'single'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Single Room
              </button>
              <button
                onClick={() => setStudioMode('multi')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  studioMode === 'multi'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Multi-Room Plan
              </button>
            </div>

            {studioMode === 'multi' ? (
              <select
                className="text-xs border rounded-md px-2.5 py-1.5 bg-background font-medium"
                value={activeMultiIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setActiveMultiIndex(idx);
                  const selectedPreset = multiPresets[idx];
                  if (selectedPreset) {
                    setExteriorWallThickness(selectedPreset.exteriorWallThickness || 0.20);
                    setInteriorWallThickness(selectedPreset.interiorWallThickness || 0.10);
                    setMultiRooms(JSON.parse(JSON.stringify(selectedPreset.rooms)));
                    setSelectedRoomId(selectedPreset.rooms[0]?.id || null);
                  }
                }}
              >
                {multiPresets.map((p, i) => (
                  <option key={i} value={i}>{p.name}</option>
                ))}
              </select>
            ) : (
              <select
                className="text-xs border rounded-md px-2.5 py-1.5 bg-background font-medium"
                onChange={(e) => {
                  const preset = SINGLE_ROOM_PRESETS.find((p) => p.name === e.target.value);
                  if (preset) setSingleRoom(JSON.parse(JSON.stringify(preset)));
                }}
              >
                {SINGLE_ROOM_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            )}
            {backendStatus === 'validating' && (
              <span className="text-[10px] text-amber-500 font-medium hidden sm:inline">Validating...</span>
            )}
            {backendStatus === 'success' && (
              <span className="text-[10px] text-emerald-500 font-medium hidden sm:inline">Synced</span>
            )}
          </div>

          {/* Center Canvas Tools */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
              title="Reset View"
            >
              <RotateCcw size={15} />
            </Button>
            <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700 mx-1" />
            <Button
              variant={showGrid ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowGrid(!showGrid)}
            >
              <Grid size={13} className="mr-1" />
              Grid
            </Button>
            <Button
              variant={showDimensions ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowDimensions(!showDimensions)}
            >
              Dims
            </Button>
            <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700 mx-1" />
            {/* Theme switcher */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as FloorPlanTheme)}
              className="text-xs bg-transparent border-0 font-medium cursor-pointer"
            >
              <option value="cad-light">CAD Light</option>
              <option value="blueprint">Blueprint Dark</option>
              <option value="dark-studio">Studio Slate</option>
            </select>
            <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700 mx-1" />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as UnitSystem)}
              className="text-xs bg-transparent border-0 font-medium cursor-pointer"
            >
              <option value="metric">Metric (m)</option>
              <option value="imperial">Imperial (ft)</option>
            </select>
          </div>

          {/* Right Action: Send to Calculator & Export */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-slate-300"
              onClick={handleExportJSON}
            >
              <FileCode size={13} className="mr-1.5" />
              Export JSON
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              onClick={() => handleSendToCalculator()}
            >
              <Calculator className="w-3.5 h-3.5 mr-1.5" />
              Send to Heat Load Calc
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Studio Body: Canvas + Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Main 2D Canvas Area */}
          <div className="flex-1 h-full relative overflow-hidden bg-slate-200/50 dark:bg-zinc-900/50">
            {/* Canvas Component */}
            <FloorPlan
              room={studioMode === 'single' ? singleRoom : undefined}
              rooms={studioMode === 'multi' ? multiRooms : undefined}
              exteriorWallThickness={exteriorWallThickness}
              interiorWallThickness={interiorWallThickness}
              selectedRoomId={selectedRoomId}
              onSelectRoom={(id) => setSelectedRoomId(id)}
              onUpdateRoom={handleUpdateCurrentRoom}
              onDeleteRoom={handleDeleteRoom}
              theme={theme}
              unit={unit}
              showDimensions={showDimensions}
              showGrid={showGrid}
              selectedOpeningId={selectedOpeningId}
              onSelectOpening={(id) => setSelectedOpeningId(id)}
              onUpdateOpening={(updatedOp) => {
                handleUpdateCurrentRoom({
                  ...currentRoom,
                  openings: currentRoom.openings.map((o) => (o.id === updatedOp.id ? updatedOp : o)),
                });
              }}
              onDeleteOpening={handleDeleteOpening}
              zoom={zoom}
              onZoomChange={setZoom}
              panOffset={panOffset}
              onPanChange={setPanOffset}
              onCursorMove={setCursorCoords}
              orientation={orientation}
              onOrientationChange={setOrientation}
            />

            {/* Floating Compass Rose and Orientation Indicator */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border rounded-lg p-2.5 shadow-md flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full border border-slate-300 dark:border-zinc-700 flex items-center justify-center relative transition-transform duration-200"
                style={{ transform: `rotate(${-orientation}deg)` }}
              >
                <div className="w-1 h-4 bg-red-500 absolute top-0 rounded-t" />
                <div className="w-1 h-4 bg-slate-400 absolute bottom-0 rounded-b" />
                <span className="text-[9px] font-bold absolute -top-3 text-red-600">N</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">
                  Orientation: {orientation}° ({getCompassDirection(orientation)} - {getCompassFullName(orientation)})
                </span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={orientation}
                  onChange={(e) => setOrientation(Number(e.target.value))}
                  className="w-28 h-1.5 mt-1 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Floating Cursor Coordinate Tag */}
            {cursorCoords && (
              <div className="absolute bottom-4 right-4 z-10 bg-black/75 text-white text-[11px] px-2.5 py-1 rounded font-mono pointer-events-none">
                X: {cursorCoords.x.toFixed(2)}m | Y: {cursorCoords.y.toFixed(2)}m
              </div>
            )}
          </div>

          {/* Right Sidebar Inspector */}
          <div className="w-full lg:w-96 border-l bg-white dark:bg-zinc-900 flex flex-col h-full overflow-hidden shadow-xs">
            {/* Sidebar Tabs */}
            <div className="flex border-b text-xs font-medium bg-slate-50 dark:bg-zinc-800/60">
              <button
                onClick={() => setActiveTab('rooms')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
                  activeTab === 'rooms'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold bg-white dark:bg-zinc-900'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Rooms
              </button>
              <button
                onClick={() => setActiveTab('walls')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
                  activeTab === 'walls'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold bg-white dark:bg-zinc-900'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Walls
              </button>
              <button
                onClick={() => setActiveTab('openings')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
                  activeTab === 'openings'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold bg-white dark:bg-zinc-900'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Openings ({currentRoom.openings.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
                  activeTab === 'analytics'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold bg-white dark:bg-zinc-900'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Energy
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: ROOMS */}
              {activeTab === 'rooms' && (
                <div className="space-y-4">
                  {studioMode === 'multi' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Rooms in Layout ({multiRooms.length})
                        </Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                          onClick={() => handleAddRoom('bedroom')}
                        >
                          <Plus size={13} className="mr-1" />
                          Add Room
                        </Button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {multiRooms.map((rm) => (
                          <div
                            key={rm.id}
                            onClick={() => setSelectedRoomId(rm.id || null)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                              selectedRoomId === rm.id
                                ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 font-semibold'
                                : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span>{rm.name}</span>
                              <span className="text-muted-foreground text-[10px]">
                                ({rm.breadth}m × {rm.length}m)
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {(rm.breadth * rm.length).toFixed(1)} m²
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Room Inspector */}
                  <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
                        Selected Room Properties
                      </span>
                      {studioMode === 'multi' && multiRooms.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteRoom(currentRoom.id || '')}
                          title="Delete Room"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <Label className="text-[11px]">Room Label</Label>
                        <Input
                          value={currentRoom.name || ''}
                          onChange={(e) => handleUpdateCurrentRoom({ ...currentRoom, name: e.target.value })}
                          className="h-8 text-xs mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px]">Breadth (Width X in m)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={currentRoom.breadth}
                            onChange={(e) => handleUpdateCurrentRoom({ ...currentRoom, breadth: Math.max(1.0, Number(e.target.value)) })}
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Length (Height Y in m)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={currentRoom.length}
                            onChange={(e) => handleUpdateCurrentRoom({ ...currentRoom, length: Math.max(1.0, Number(e.target.value)) })}
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                      </div>

                      {studioMode === 'multi' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px]">Position X (m)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={currentRoom.x || 0}
                              onChange={(e) => handleUpdateCurrentRoom({ ...currentRoom, x: Number(e.target.value) })}
                              className="h-8 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Position Y (m)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={currentRoom.y || 0}
                              onChange={(e) => handleUpdateCurrentRoom({ ...currentRoom, y: Number(e.target.value) })}
                              className="h-8 text-xs mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Floor Area:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {activeRoomArea.toFixed(2)} m² ({(activeRoomArea * 10.764).toFixed(1)} sq ft)
                      </span>
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 mt-2"
                      onClick={() => handleSendToCalculator(currentRoom)}
                    >
                      <Calculator className="w-3.5 h-3.5 mr-1.5" />
                      Calculate Heat Load for this Room
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: WALLS */}
              {activeTab === 'walls' && (
                <div className="space-y-4 text-xs">
                  <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wide">Dual Wall Thickness</span>
                    <p className="text-[11px] text-muted-foreground">
                      Green building thermal modeling distinguishes between thick insulated exterior envelope walls and interior partitions.
                    </p>

                    <div>
                      <Label className="text-[11px]">Exterior Envelope Wall (m)</Label>
                      <Input
                        type="number"
                        step="0.02"
                        value={exteriorWallThickness}
                        onChange={(e) => setExteriorWallThickness(Math.max(0.1, Number(e.target.value)))}
                        className="h-8 text-xs mt-1"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">Standard: 0.20m – 0.25m (8–10 in)</span>
                    </div>

                    <div>
                      <Label className="text-[11px]">Interior Partition Wall (m)</Label>
                      <Input
                        type="number"
                        step="0.02"
                        value={interiorWallThickness}
                        onChange={(e) => setInteriorWallThickness(Math.max(0.05, Number(e.target.value)))}
                        className="h-8 text-xs mt-1"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">Standard: 0.10m – 0.12m (4–5 in)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: OPENINGS */}
              {activeTab === 'openings' && (
                <div className="space-y-4 text-xs">
                  {/* Current Openings List */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Doors & Windows ({currentRoom.openings.length})
                    </Label>

                    {currentRoom.openings.length === 0 ? (
                      <div className="p-3 border border-dashed rounded-lg text-center text-muted-foreground text-xs">
                        No openings placed in this room yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {currentRoom.openings.map((op) => (
                          <div
                            key={op.id}
                            className="p-2 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant={op.type === 'door' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                {op.type}
                              </Badge>
                              <span>Wall {op.wall}</span>
                              <span className="text-muted-foreground text-[10px]">
                                Pos: {op.position}m | W: {op.width}m
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteOpening(op.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Opening Form */}
                  <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wide">Add New Opening</span>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Type</Label>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as 'door' | 'window')}
                          className="w-full h-8 border rounded-md px-2 text-xs bg-background mt-1"
                        >
                          <option value="door">Door</option>
                          <option value="window">Window</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-[11px]">Wall</Label>
                        <select
                          value={newWall}
                          onChange={(e) => setNewWall(e.target.value as WallSide)}
                          className="w-full h-8 border rounded-md px-2 text-xs bg-background mt-1"
                        >
                          <option value="N">North Wall</option>
                          <option value="S">South Wall</option>
                          <option value="E">East Wall</option>
                          <option value="W">West Wall</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Position (m from corner)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={newPos}
                          onChange={(e) => setNewPos(Number(e.target.value))}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Width (m)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={newWidth}
                          onChange={(e) => setNewWidth(Number(e.target.value))}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs h-8"
                      onClick={handleAddOpening}
                    >
                      <Plus size={13} className="mr-1" />
                      Place Opening
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 4: ENERGY & DAYLIGHT ANALYTICS */}
              {activeTab === 'analytics' && (
                <div className="space-y-4 text-xs">
                  <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wide">Green Building Daylight Ratio</span>
                    
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-900 border">
                      <span className="text-muted-foreground">Daylight Ratio:</span>
                      <span className="font-bold text-sm">
                        {activeDaylightRatio.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeDaylightRatio >= 10.0 ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                          <CheckCircle2 size={16} />
                          <span>Meets NBC & LEED ≥ 10% Daylight Requirement</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                          <AlertTriangle size={16} />
                          <span>Below 10% recommendation (Add windows or increase width)</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-foreground border-t pt-2">
                      <div className="flex justify-between">
                        <span>Active Room Area:</span>
                        <span className="font-medium text-foreground">{activeRoomArea.toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Window Glazing Area:</span>
                        <span className="font-medium text-foreground">{activeRoomWindowArea.toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Plan Carpet Area:</span>
                        <span className="font-medium text-foreground">{totalCarpetArea.toFixed(2)} m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Code Compliance Warnings */}
                  {backendWarnings.length > 0 && (
                    <div className="border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 bg-amber-50/60 dark:bg-amber-950/20 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                        <AlertCircle size={14} />
                        <span>Building Code Advisory ({backendWarnings.length})</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                        {backendWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 shadow-sm"
                    onClick={() => handleSendToCalculator()}
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Send to Green Building Calculator
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
