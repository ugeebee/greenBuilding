import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { 
  Save, 
  Loader2, 
  Sliders, 
  BarChart2, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles,
  Layers,
  Thermometer,
  FileSearch
} from 'lucide-react';
import { 
  calculatePeriodicHeatFlow, 
  generateOrientationSolAirProfile,
  type PeriodicElementInput,
  type PeriodicSimulationResult 
} from '../../lib/periodicHeat';

const API_BASE_URL = '/api';

export default function PeriodicCalculator() {
  const navigate = useNavigate();

  // Room geometry
  const [room, setRoom] = useState({ length: 5.0, breadth: 4.0, height: 3.0, orientation: 'NS' });
  const [indoorTemp, setIndoorTemp] = useState<number>(24);
  const [dailyMeanTemp, setDailyMeanTemp] = useState<number>(32);
  const [dailySwing, setDailySwing] = useState<number>(10);
  const [importedSource, setImportedSource] = useState<string | null>(null);
  const [linkedImageHash, setLinkedImageHash] = useState<string>('');
  const [linkedImageName, setLinkedImageName] = useState<string>('');

  // Periodic preset database from public JSON
  const [periodicPresets, setPeriodicPresets] = useState<any[]>([]);

  // Elements: N, E, S, W walls and Roof
  const [elements, setElements] = useState<PeriodicElementInput[]>([]);
  const [activeHourView, setActiveHourView] = useState<number | 'all'>('all');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load Prefill from Floor Plan Studio / Reader & Presets
  useEffect(() => {
    // 1. Fetch Periodic reference presets
    fetch('/GreenBuildingData_Periodic.json')
      .then(res => res.json())
      .then(data => {
        setPeriodicPresets(data || []);
      })
      .catch(err => console.error("Error loading periodic presets:", err));

    // 2. Prefill check
    try {
      const raw = sessionStorage.getItem('gb_calculator_prefill');
      if (raw) {
        const prefill = JSON.parse(raw);
        if (prefill.length) {
          setRoom(r => ({
            ...r,
            length: parseFloat(prefill.length) || 5.0,
            breadth: parseFloat(prefill.breadth) || 4.0,
            height: parseFloat(prefill.height) || 3.0
          }));
        }
        if (prefill.source) {
          setImportedSource(prefill.source);
        }
        if (prefill.image_hash) {
          setLinkedImageHash(prefill.image_hash);
        }
        if (prefill.image_name) {
          setLinkedImageName(prefill.image_name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Compute areas and initialize default envelope elements
  useEffect(() => {
    const l = room.length;
    const b = room.breadth;
    const h = room.height;

    let grossN = b * h;
    let grossS = b * h;
    let grossE = l * h;
    let grossW = l * h;
    if (room.orientation === 'EW') {
      grossN = grossS = l * h;
      grossE = grossW = b * h;
    }
    const roofArea = l * b;

    setElements([
      {
        name: 'Wall 1 (North)',
        orientation: 'N',
        area: parseFloat(grossN.toFixed(2)),
        uValue: 2.30,
        timeLag: 6.2,
        decrementFactor: 0.38,
        solAirTemps: generateOrientationSolAirProfile('N', dailyMeanTemp, dailySwing, 400, 0.6, 0.05)
      },
      {
        name: 'Wall 2 (East)',
        orientation: 'E',
        area: parseFloat(grossE.toFixed(2)),
        uValue: 2.30,
        timeLag: 6.2,
        decrementFactor: 0.38,
        solAirTemps: generateOrientationSolAirProfile('E', dailyMeanTemp, dailySwing, 550, 0.6, 0.05)
      },
      {
        name: 'Wall 3 (South)',
        orientation: 'S',
        area: parseFloat(grossS.toFixed(2)),
        uValue: 2.30,
        timeLag: 6.2,
        decrementFactor: 0.38,
        solAirTemps: generateOrientationSolAirProfile('S', dailyMeanTemp, dailySwing, 600, 0.6, 0.05)
      },
      {
        name: 'Wall 4 (West)',
        orientation: 'W',
        area: parseFloat(grossW.toFixed(2)),
        uValue: 2.30,
        timeLag: 6.2,
        decrementFactor: 0.38,
        solAirTemps: generateOrientationSolAirProfile('W', dailyMeanTemp, dailySwing, 650, 0.6, 0.05)
      },
      {
        name: 'Roof Slab',
        orientation: 'Roof',
        area: parseFloat(roofArea.toFixed(2)),
        uValue: 2.70,
        timeLag: 4.5,
        decrementFactor: 0.62,
        solAirTemps: generateOrientationSolAirProfile('Roof', dailyMeanTemp, dailySwing, 750, 0.7, 0.04)
      }
    ]);
  }, [room.length, room.breadth, room.height, room.orientation, dailyMeanTemp, dailySwing]);

  // Execute Periodic calculation on frontend
  const simulation: PeriodicSimulationResult = useMemo(() => {
    if (elements.length === 0) {
      return {
        indoorTemp,
        dailyAvgEnvelopeHeat: 0,
        peakEnvelopeHeat: 0,
        peakEnvelopeHour: 0,
        peakSteadyEnvelope: 0,
        envelopeDampingPct: 0,
        dailyEnergyKWh: 0,
        hourlySummary: [],
        elements: []
      };
    }
    return calculatePeriodicHeatFlow(indoorTemp, elements);
  }, [indoorTemp, elements]);

  // Handle changing an element parameter (e.g. dragging slider)
  const handleUpdateParam = (index: number, field: keyof PeriodicElementInput, value: any) => {
    const updated = [...elements];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      setElements(updated);
    }
  };

  // Apply preset selection to an element
  const handleApplyPreset = (index: number, constructionName: string) => {
    const preset = periodicPresets.find(p => p.Construction === constructionName);
    if (!preset) return;

    const updated = [...elements];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        uValue: preset.U_Value,
        timeLag: preset.TimeLag_hours,
        decrementFactor: preset.DecrementFactor
      };
      setElements(updated);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);

    const token = localStorage.getItem('token') || localStorage.getItem('admin_token');

    const payload = {
      details: simulation.elements.map(e => ({
        Surface: e.name,
        A: e.area,
        U: e.uValue,
        TimeLag_hours: e.timeLag,
        DecrementFactor: e.decrementFactor,
        DailyAvg_W: e.dailyAvgHeat,
        Peak_W: e.peakHeatFlow,
        Peak_Hour: e.peakHour,
        Damping_pct: e.loadReductionPct
      })),
      totals: {
        Qc: simulation.dailyAvgEnvelopeHeat,
        Qso: 0,
        Qsw: 0,
        Qv: 0
      },
      periodic_totals: {
        daily_avg_heat: simulation.dailyAvgEnvelopeHeat,
        peak_heat: simulation.peakEnvelopeHeat,
        peak_hour: simulation.peakEnvelopeHour,
        steady_peak: simulation.peakSteadyEnvelope,
        damping_pct: simulation.envelopeDampingPct,
        daily_energy_kwh: simulation.dailyEnergyKWh
      },
      periodic_elements: simulation.elements,
      periodic_hourly: simulation.hourlySummary,
      image_hash: linkedImageHash || undefined,
      image_name: linkedImageName || undefined
    };

    try {
      const res = await fetch(`${API_BASE_URL}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => {
          navigate('/calculator/history');
        }, 1200);
      } else {
        alert("Failed to save periodic simulation");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server to save history");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
      <Navbar title="Periodic Heat Flow Calculator" />

      <main className="container mx-auto px-4 py-8 md:py-12 flex-1 max-w-7xl space-y-8">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/calculator')} className="rounded-full">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-black text-[10px]">
                  24-Hour Diurnal Simulation
                </Badge>
                {importedSource && (
                  <Badge variant="outline" className="border-sky-300 text-sky-700 dark:text-sky-400 font-bold text-[10px]">
                    <FileSearch className="w-3 h-3 mr-1" />
                    From {importedSource}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">
                Periodic Heat Flow & Thermal Inertia Calculator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/calculator/steady')}
              className="text-xs font-bold rounded-xl border-zinc-200 dark:border-zinc-700"
            >
              Switch to Steady-State
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedSuccess ? "Saved to History!" : "Save Simulation"}
            </Button>
          </div>
        </div>

        {/* Room Geometry & Diurnal Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Room Geometry */}
          <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-zinc-900">
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                1. Room Dimensions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Length (m)</label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={room.length} 
                    onChange={(e) => setRoom({ ...room, length: parseFloat(e.target.value) || 1 })}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Breadth (m)</label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={room.breadth} 
                    onChange={(e) => setRoom({ ...room, breadth: parseFloat(e.target.value) || 1 })}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Height (m)</label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={room.height} 
                    onChange={(e) => setRoom({ ...room, height: parseFloat(e.target.value) || 1 })}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
              <div className="pt-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Room Orientation</label>
                <select
                  value={room.orientation}
                  onChange={(e) => setRoom({ ...room, orientation: e.target.value })}
                  className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-semibold"
                >
                  <option value="NS">North-South Long Axis</option>
                  <option value="EW">East-West Long Axis</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* 2. Diurnal Temperature Curve */}
          <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-zinc-900">
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-rose-500" />
                2. Diurnal Sol-Air Cycle
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center justify-between">
                  <span>Daily Mean Sol-Air (Tsa,m)</span>
                  <span className="text-zinc-900 dark:text-white font-mono">{dailyMeanTemp}°C</span>
                </label>
                <Input 
                  type="number" 
                  step="0.5" 
                  value={dailyMeanTemp} 
                  onChange={(e) => setDailyMeanTemp(parseFloat(e.target.value) || 30)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center justify-between">
                  <span>Daily Diurnal Swing (±ΔT)</span>
                  <span className="text-zinc-900 dark:text-white font-mono">±{dailySwing}°C</span>
                </label>
                <Input 
                  type="number" 
                  step="0.5" 
                  value={dailySwing} 
                  onChange={(e) => setDailySwing(parseFloat(e.target.value) || 8)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <p className="text-[10px] text-zinc-400 font-medium">
                Day temp swings from {dailyMeanTemp - dailySwing}°C (night) to {dailyMeanTemp + dailySwing}°C (peak solar).
              </p>
            </CardContent>
          </Card>

          {/* 3. Indoor Comfort Target */}
          <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-zinc-900">
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                3. Indoor Target (Ti)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center justify-between">
                  <span>Indoor Setpoint Temp (Ti)</span>
                  <span className="text-zinc-900 dark:text-white font-mono font-bold">{indoorTemp}°C</span>
                </label>
                <Input 
                  type="number" 
                  step="0.5" 
                  value={indoorTemp} 
                  onChange={(e) => setIndoorTemp(parseFloat(e.target.value) || 24)}
                  className="h-9 text-xs rounded-xl mt-1"
                />
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs">
                <span className="font-bold block">Assumed constant indoor temp</span>
                <span className="text-[11px] opacity-80">Baseline gradient: (Tsa,m - Ti) = {(dailyMeanTemp - indoorTemp).toFixed(1)}°C</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Simulation Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
            <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Daily Mean Heat (Qa)</span>
            <span className="text-2xl font-black text-zinc-900 dark:text-white">{simulation.dailyAvgEnvelopeHeat.toFixed(1)}</span>
            <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
            <span className="text-[10px] text-zinc-400 block mt-1">Steady 24h baseline</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
            <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Peak Periodic Load (Qc)</span>
            <span className="text-2xl font-black text-indigo-600">{simulation.peakEnvelopeHeat.toFixed(1)}</span>
            <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
            <span className="text-[10px] text-indigo-500 font-semibold block mt-1">Delayed to {simulation.peakEnvelopeHour}:00 hrs</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
            <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Zero-Mass Peak Load</span>
            <span className="text-2xl font-black text-rose-500">{simulation.peakSteadyEnvelope.toFixed(1)}</span>
            <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
            <span className="text-[10px] text-zinc-400 block mt-1">If walls had no thermal mass</span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm text-center">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block mb-1">Envelope Damping (μ)</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">-{simulation.envelopeDampingPct}%</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">Peak load reduction</span>
          </div>
        </div>

        {/* 24-Hour Diurnal Heat Curve Visualization */}
        <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-zinc-900 overflow-hidden">
          <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-500" />
                24-Hour Diurnal Heat Progression Curve [Qc(t)]
              </CardTitle>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Visualizes the hourly momentary heat flow inside the building, showing the time-lag delay (ϕ) and amplitude damping (μ).
              </p>
            </div>
            <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-[10px]">
              {simulation.dailyEnergyKWh} kWh/day Total Energy
            </Badge>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Chart bars */}
            <div className="grid grid-cols-12 md:grid-cols-24 gap-1.5 items-end h-44 pt-6 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              {simulation.hourlySummary.map((pt) => {
                const maxVal = Math.max(1, simulation.peakSteadyEnvelope);
                const periodicHeight = Math.max(8, (pt.totalPeriodic / maxVal) * 100);
                const isPeak = pt.hour === simulation.peakEnvelopeHour;
                return (
                  <div 
                    key={pt.hour} 
                    onClick={() => setActiveHourView(activeHourView === pt.hour ? 'all' : pt.hour)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    title={`Hour ${pt.hour}:00 - Periodic: ${pt.totalPeriodic} W | Steady: ${pt.totalSteady} W`}
                  >
                    <div className="w-full flex items-end justify-center h-28 relative">
                      <div 
                        style={{ height: `${periodicHeight}%` }} 
                        className={`w-full rounded-t-md transition-all ${
                          isPeak 
                            ? 'bg-indigo-600 shadow-md shadow-indigo-500/30' 
                            : activeHourView === pt.hour
                            ? 'bg-emerald-500'
                            : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-emerald-400'
                        }`}
                      />
                    </div>
                    <span className={`text-[9px] font-mono ${isPeak ? 'font-black text-indigo-600' : 'text-zinc-400'}`}>
                      {pt.hour}h
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend & Details */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3">
              <div className="flex items-center gap-4 flex-wrap text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600"></span>
                  <span>Delayed Peak Load ({simulation.peakEnvelopeHour}:00 hrs)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-zinc-300 dark:bg-zinc-700"></span>
                  <span>Momentary Heat Flow Qc(t)</span>
                </div>
              </div>
              <div className="text-[11px] font-medium text-zinc-400">
                Peak delay: <strong className="text-zinc-900 dark:text-white">{(simulation.peakEnvelopeHour - 14 + 24) % 24} hours</strong> past solar peak
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Envelope Assemblies Table with Interactive Sliders */}
        <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-zinc-900 overflow-hidden">
          <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-500" />
                Structural Envelope Assemblies (Time-Lag ϕ & Decrement Factor μ)
              </CardTitle>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Select construction types from the engineering database or use the sliders to tune Time-lag delay and attenuation.
              </p>
            </div>
          </CardHeader>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  <th className="pb-3">Envelope Surface</th>
                  <th className="pb-3">Construction Assembly Preset</th>
                  <th className="pb-3">Area (m²)</th>
                  <th className="pb-3">U (W/m²K)</th>
                  <th className="pb-3">Time-Lag ϕ (hours)</th>
                  <th className="pb-3">Decrement Factor μ</th>
                  <th className="pb-3">Daily Avg Qa</th>
                  <th className="pb-3 font-bold text-indigo-600">Peak Delayed Qc</th>
                  <th className="pb-3 text-right">Mass Damping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {simulation.elements.map((el, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {el.name}
                    </td>
                    <td className="py-4 pr-3 min-w-[200px]">
                      <select
                        onChange={(e) => handleApplyPreset(idx, e.target.value)}
                        className="w-full text-[11px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 font-semibold"
                        defaultValue=""
                      >
                        <option value="" disabled>Load reference preset...</option>
                        {periodicPresets
                          .filter(p => el.orientation === 'Roof' ? p.Category === 'Roofs' : p.Category === 'Walls')
                          .map((p, i) => (
                            <option key={i} value={p.Construction}>
                              {p.Construction} (ϕ={p.TimeLag_hours}h, μ={p.DecrementFactor})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="py-4 font-mono">{el.area}</td>
                    <td className="py-4 font-mono">{el.uValue}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="range"
                          min="0.5"
                          max="14.0"
                          step="0.1"
                          value={el.timeLag}
                          onChange={(e) => handleUpdateParam(idx, 'timeLag', parseFloat(e.target.value))}
                          className="w-20 accent-emerald-500 cursor-pointer"
                        />
                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 w-10">
                          {el.timeLag}h
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="range"
                          min="0.05"
                          max="1.0"
                          step="0.01"
                          value={el.decrementFactor}
                          onChange={(e) => handleUpdateParam(idx, 'decrementFactor', parseFloat(e.target.value))}
                          className="w-20 accent-emerald-500 cursor-pointer"
                        />
                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 w-10">
                          {el.decrementFactor}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-zinc-600 dark:text-zinc-400">
                      {el.dailyAvgHeat} W
                    </td>
                    <td className="py-4 font-mono font-black text-indigo-600">
                      {el.peakHeatFlow} W <span className="text-[10px] text-zinc-400 font-normal">(@{el.peakHour}h)</span>
                    </td>
                    <td className="py-4 text-right font-black text-emerald-600">
                      -{el.loadReductionPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
