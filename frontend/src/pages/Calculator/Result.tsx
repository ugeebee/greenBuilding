import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Save, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  BarChart2, 
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { 
  calculatePeriodicHeatFlow, 
  generateOrientationSolAirProfile,
  type PeriodicElementInput,
  type PeriodicSimulationResult 
} from '../../lib/periodicHeat';

const API_BASE_URL = '/api';

export default function Result() {
  const [activeTab, setActiveTab] = useState<'steady' | 'periodic'>('steady');
  const [tableData, setTableData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [linkedImageHash, setLinkedImageHash] = useState<string>('');
  const [linkedImageName, setLinkedImageName] = useState<string>('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Periodic Heat Flow State
  const [periodicElements, setPeriodicElements] = useState<PeriodicElementInput[]>([]);
  const [indoorTemp, setIndoorTemp] = useState<number>(24);
  const [dailyMeanTemp, setDailyMeanTemp] = useState<number>(32);
  const [activeHourView, setActiveHourView] = useState<number | 'all'>('all');

  const navigate = useNavigate();

  useEffect(() => {
    try {
      const demoDataStr = localStorage.getItem('demoOutput');
      const uCalcDataStr = localStorage.getItem('Ucalculator');

      if (!demoDataStr || !uCalcDataStr) {
        throw new Error("Missing Local Storage data. Please start from the first page.");
      }

      const demoData = JSON.parse(demoDataStr);
      const uCalcData = JSON.parse(uCalcDataStr);

      let imgHash = sessionStorage.getItem('gb_calculator_image_hash') || '';
      let imgName = sessionStorage.getItem('gb_calculator_image_name') || '';
      if (!imgHash && demoData.image_hash) {
        imgHash = demoData.image_hash;
      }
      if (!imgName && demoData.image_name) {
        imgName = demoData.image_name;
      }
      setLinkedImageHash(imgHash);
      setLinkedImageName(imgName);

      const l = demoData.room.length;
      const b = demoData.room.breadth;
      const h = demoData.room.height;
      const volume = l * b * h;
      const ori = demoData.room.orientation;
      
      let grossAreas = { N: 0, S: 0, E: 0, W: 0 };
      if (ori === 'NS') {
        grossAreas.E = grossAreas.W = l * h;
        grossAreas.N = grossAreas.S = b * h;
      } else {
        grossAreas.N = grossAreas.S = l * h;
        grossAreas.E = grossAreas.W = b * h;
      }

      let openingsArea = { N: 0, S: 0, E: 0, W: 0 };
      (demoData.doors || []).forEach((d: any) => openingsArea[d.wall as keyof typeof openingsArea] += d.area);
      (demoData.windows || []).forEach((w: any) => openingsArea[w.wall as keyof typeof openingsArea] += w.area);

      const tIn = demoData.temperatures.inside || 24;
      setIndoorTemp(tIn);

      const finalTable: any[] = [];
      let totalQci = 0;
      let totalQso = 0;
      let totalQsw = 0;

      function createRow(surfaceName: string, area: number, uValue: number, rso: number, wallKey: string, type: string, customSGF: number | null = null) {
        const qc = area * uValue;
        const params = demoData.surfaceParams[wallKey] || { G: 0, alpha: 0, SGF: 0, e: 0 };
        const tOut = demoData.temperatures.outdoor[wallKey] || tIn;
        const deltaT = tOut - tIn;
        const qci = qc * deltaT;

        totalQci += qci;
        
        let finalRso: any = (type === 'window' || type === 'floor') ? '-' : parseFloat((rso || 0).toFixed(4));
        let finalSGF: any = (type === 'window') ? (customSGF || 0) : '-'; 
        let finalE: any   = (type === 'roof') ? (params.e || 0) : '-';    

        let finalQsoi: any = '-';
        if (type !== 'window' && type !== 'floor') {
          if (type === 'roof') {
            finalQsoi = qc * ((params.G * params.alpha) - params.e) * finalRso;
          } else {
            finalQsoi = qc * params.G * params.alpha * finalRso;
          }
          totalQso += finalQsoi;
          finalQsoi = parseFloat(finalQsoi.toFixed(4));
        }

        let finalQswi: any = '-';
        if (type === 'window') {
          finalQswi = area * params.G * (customSGF || 0);
          totalQsw += finalQswi;
          finalQswi = parseFloat(finalQswi.toFixed(4));
        }

        return {
          Surface: surfaceName,
          A: parseFloat(area.toFixed(3)),
          U: parseFloat(uValue.toFixed(4)),
          qc: parseFloat(qc.toFixed(4)),
          Rso: finalRso,
          G: params.G || 0,
          alpha: params.alpha || 0,
          SGF: finalSGF,
          e: finalE,
          Qsoi: finalQsoi,
          Qswi: finalQswi,
          deltaT: parseFloat(deltaT.toFixed(2)),
          Qci: parseFloat(qci.toFixed(4))
        };
      }

      const walls = ['N', 'E', 'S', 'W'];
      const wallLabels: Record<string, string> = { N: 'Wall 1', E: 'Wall 2', S: 'Wall 3', W: 'Wall 4' };

      // Initialize Periodic Elements from room construction
      const periodicList: PeriodicElementInput[] = [];

      walls.forEach(w => {
        const netArea = grossAreas[w as keyof typeof grossAreas] - openingsArea[w as keyof typeof openingsArea];
        const uData = uCalcData.find((item: any) => item.Wall === wallLabels[w]) || { U: 2.30, Rso: 0.05 };
        finalTable.push(createRow(wallLabels[w], netArea, uData.U, uData.Rso, w, 'wall'));

        // Typical default for 230mm brickwork: phi = 6.2 hours, mu = 0.38
        const solAirProfile = generateOrientationSolAirProfile(w, 32, 10, demoData.surfaceParams[w]?.G || 500, demoData.surfaceParams[w]?.alpha || 0.6, uData.Rso || 0.05);
        periodicList.push({
          name: `${wallLabels[w]} (${w})`,
          orientation: w,
          area: netArea,
          uValue: uData.U > 0 ? uData.U : 2.30,
          timeLag: 6.2,
          decrementFactor: 0.38,
          solAirTemps: solAirProfile
        });
      });

      (demoData.doors || []).forEach((door: any, index: number) => {
        const uValue = door.material.R > 0 ? (1 / door.material.R) : 0;
        const uData = uCalcData.find((item: any) => item.Wall === wallLabels[door.wall]) || { Rso: 0 };
        finalTable.push(createRow(`Door(${index + 1}) [${wallLabels[door.wall]}]`, door.area, uValue, uData.Rso, door.wall, 'door'));
      });

      (demoData.windows || []).forEach((win: any, index: number) => {
        const uValue = win.R > 0 ? (1 / win.R) : 0;
        finalTable.push(createRow(`Window(${index + 1}) [${wallLabels[win.wall]}]`, win.area, uValue, 0, win.wall, 'window', win.SGF));
      });

      const floorArea = l * b;
      const floorU = demoData.floorMaterial?.R > 0 ? (1 / demoData.floorMaterial.R) : 0;
      finalTable.push(createRow(`floor`, floorArea, floorU, 0, 'Floor', 'floor'));

      const roofArea = l * b;
      const roofU = demoData.roofMaterial?.R > 0 ? (1 / demoData.roofMaterial.R) : 2.70;
      const roofRso = demoData.surfaceParams['Roof'] ? demoData.surfaceParams['Roof'].Rso : 0.04; 
      finalTable.push(createRow(`roof`, roofArea, roofU, roofRso, 'Roof', 'roof'));

      // Add roof to periodic simulation: typical 150mm RCC slab with screed: phi = 4.5 hours, mu = 0.62
      const roofProfile = generateOrientationSolAirProfile('Roof', 32, 10, demoData.surfaceParams['Roof']?.G || 650, demoData.surfaceParams['Roof']?.alpha || 0.7, roofRso || 0.04);
      periodicList.push({
        name: 'Roof Slab',
        orientation: 'Roof',
        area: roofArea,
        uValue: roofU > 0 ? roofU : 2.70,
        timeLag: 4.5,
        decrementFactor: 0.62,
        solAirTemps: roofProfile
      });

      setTableData(finalTable);
      setPeriodicElements(periodicList);

      const outTemps = demoData.temperatures.outdoor;
      const tOutAvg = (outTemps.N + outTemps.S + outTemps.E + outTemps.W) / 4;
      setDailyMeanTemp(parseFloat(tOutAvg.toFixed(1)) || 32);

      const deltaTVent = tOutAvg - tIn;
      const qv = (1 / 3) * demoData.ACH * volume * deltaTVent;

      setSummary({
        Qc: parseFloat(totalQci.toFixed(4)),
        Qso: parseFloat(totalQso.toFixed(4)),
        Qsw: parseFloat(totalQsw.toFixed(4)),
        Qv: parseFloat(qv.toFixed(4))
      });

    } catch (err: any) {
      console.error("Error generating final table:", err);
      setError("Error generating table: " + err.message);
    }
  }, []);

  // Compute Periodic Heat Flow in pure client-side TypeScript
  const periodicSimulation: PeriodicSimulationResult = useMemo(() => {
    if (periodicElements.length === 0) {
      return {
        indoorTemp: 24,
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
    return calculatePeriodicHeatFlow(indoorTemp, periodicElements);
  }, [indoorTemp, periodicElements]);

  // Dynamic tuning of Time-lag and Decrement factor by user in UI
  const handleUpdateElementParam = (index: number, field: 'timeLag' | 'decrementFactor', value: number) => {
    const updated = [...periodicElements];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      setPeriodicElements(updated);
    }
  };

  const handleSave = async () => {
    if (!summary || tableData.length === 0) return;
    setSaving(true);
    setSavedSuccess(false);
    
    const authToken = localStorage.getItem('token') || localStorage.getItem('admin_token');
    
    const payload: any = {
      details: tableData,
      totals: summary,
      periodic_totals: {
        daily_avg_heat: periodicSimulation.dailyAvgEnvelopeHeat,
        peak_heat: periodicSimulation.peakEnvelopeHeat,
        peak_hour: periodicSimulation.peakEnvelopeHour,
        steady_peak: periodicSimulation.peakSteadyEnvelope,
        damping_pct: periodicSimulation.envelopeDampingPct,
        daily_energy_kwh: periodicSimulation.dailyEnergyKWh
      },
      periodic_elements: periodicSimulation.elements,
      periodic_hourly: periodicSimulation.hourlySummary
    };

    if (linkedImageHash) {
      payload.image_hash = linkedImageHash;
    }
    if (linkedImageName) {
      payload.image_name = linkedImageName;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok) { 
        setSavedSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      } else { 
        alert("Server Error: " + (result.message || "Failed to save calculation.")); 
      }
    } catch (err) {
      console.error("Error sending data to server:", err);
      alert("Failed to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl pt-12 space-y-6">
      {/* Header and Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            Thermal Heat Gain & Load Simulation
          </h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Analyze building envelope performance via standard steady-state equations or dynamic 24-hour periodic diurnal heat flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setActiveTab('steady')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'steady'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Steady-State Analysis
            </button>
            <button
              onClick={() => setActiveTab('periodic')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'periodic'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Periodic Diurnal (24h)
            </button>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={saving || !!error} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl px-5 h-10 shadow-md"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : savedSuccess ? (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            {savedSuccess ? "Saved!" : "Save Result"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-500/10 border border-rose-500 text-rose-600 dark:text-rose-400 p-5 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      ) : activeTab === 'steady' ? (
        /* ========================================================================= */
        /* TAB 1: STEADY STATE ANALYSIS VIEW */
        /* ========================================================================= */
        <Card className="shadow-lg border-none rounded-3xl overflow-hidden bg-white dark:bg-zinc-900">
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 p-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black">Steady-State Heat Transfer Table</CardTitle>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Evaluates conduction (Qc), sol-air opaque radiation (Qso), solar window gains (Qsw), and air infiltration (Qv).
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {linkedImageHash && (
              <div className="flex items-center gap-3 p-3 rounded-2xl border border-sky-100 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 text-xs text-sky-800 dark:text-sky-300">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-sky-200 bg-white shrink-0">
                  <img src={`/api/uploads/blueprints/${linkedImageHash}.png`} alt="Floor Plan" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="font-bold block">Linked Blueprint: {linkedImageName || 'Floor Plan'}</span>
                  <span className="font-mono text-[10px] text-slate-500">SHA-256: {linkedImageHash.slice(0, 20)}...</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full text-xs text-center border-collapse">
                <thead className="bg-zinc-900 text-white dark:bg-zinc-800 text-[10px] uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5 text-left">Surface</th>
                    <th className="px-3 py-3.5">A (m²)</th>
                    <th className="px-3 py-3.5">U (W/m²K)</th>
                    <th className="px-3 py-3.5">qc (A×U)</th>
                    <th className="px-3 py-3.5">Rso</th>
                    <th className="px-3 py-3.5">G</th>
                    <th className="px-3 py-3.5">α (alpha)</th>
                    <th className="px-3 py-3.5">SGF</th>
                    <th className="px-3 py-3.5">e</th>
                    <th className="px-3 py-3.5">Qsoi</th>
                    <th className="px-3 py-3.5">Qswi</th>
                    <th className="px-3 py-3.5">ΔT</th>
                    <th className="px-4 py-3.5 font-black text-emerald-400">Qci (W)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {tableData.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-left text-zinc-900 dark:text-zinc-100 bg-zinc-50/50 dark:bg-zinc-800/20">{row.Surface}</td>
                      <td className="px-3 py-3 font-mono">{row.A}</td>
                      <td className="px-3 py-3 font-mono">{row.U}</td>
                      <td className="px-3 py-3 font-mono">{row.qc}</td>
                      <td className="px-3 py-3 font-mono text-zinc-400">{row.Rso}</td>
                      <td className="px-3 py-3 font-mono">{row.G}</td>
                      <td className="px-3 py-3 font-mono">{row.alpha}</td>
                      <td className="px-3 py-3 font-mono text-zinc-400">{row.SGF}</td>
                      <td className="px-3 py-3 font-mono text-zinc-400">{row.e}</td>
                      <td className="px-3 py-3 font-mono font-semibold text-emerald-600">{row.Qsoi}</td>
                      <td className="px-3 py-3 font-mono font-semibold text-amber-600">{row.Qswi}</td>
                      <td className="px-3 py-3 font-mono">{row.deltaT}</td>
                      <td className="px-4 py-3 font-mono font-black text-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20">{row.Qci}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Qc (Conduction)</span>
                  <span className="text-2xl font-black text-indigo-600">{summary.Qc.toFixed(1)}</span>
                  <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
                </div>
                <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Qso (Sol-Air Opaque)</span>
                  <span className="text-2xl font-black text-emerald-600">{summary.Qso.toFixed(1)}</span>
                  <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
                </div>
                <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Qsw (Solar Window)</span>
                  <span className="text-2xl font-black text-amber-600">{summary.Qsw.toFixed(1)}</span>
                  <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
                </div>
                <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Qv (Ventilation ACH)</span>
                  <span className="text-2xl font-black text-rose-600">{summary.Qv.toFixed(1)}</span>
                  <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ========================================================================= */
        /* TAB 2: PERIODIC DIURNAL HEAT FLOW (FRONTEND CALCULATION ENGINE) */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Key Periodic Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
              <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Daily Mean Heat (Qa)</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-white">
                {periodicSimulation.dailyAvgEnvelopeHeat.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
              <span className="text-[10px] text-zinc-400 block mt-1">24-hour baseline transfer</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
              <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Peak Periodic Load (Qc)</span>
              <span className="text-2xl font-black text-indigo-600">
                {periodicSimulation.peakEnvelopeHeat.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
              <span className="text-[10px] text-indigo-500 font-semibold block mt-1">
                Delayed to {periodicSimulation.peakEnvelopeHour}:00 hrs
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
              <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Peak Zero-Mass Load</span>
              <span className="text-2xl font-black text-rose-500">
                {periodicSimulation.peakSteadyEnvelope.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-400 font-bold ml-1">Watts</span>
              <span className="text-[10px] text-zinc-400 block mt-1">If walls had zero thermal mass</span>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm text-center">
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                Mass Damping (μ Effect)
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                -{periodicSimulation.envelopeDampingPct}%
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                Peak load smoothed & flattened
              </span>
            </div>
          </div>

          {/* 24-Hour Diurnal Heat Flow Curve Visualization */}
          <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-zinc-900 overflow-hidden">
            <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-500" />
                  24-Hour Diurnal Heat Transfer Cycle [Qc(t)]
                </CardTitle>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  Visualizes how envelope thermal mass attenuates amplitude (decrement factor μ) and delays peak penetration (time-lag ϕ).
                </p>
              </div>
              <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-[10px]">
                {periodicSimulation.dailyEnergyKWh} kWh/day
              </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Hourly Chart Bar Graph */}
              <div className="grid grid-cols-12 md:grid-cols-24 gap-1.5 items-end h-44 pt-6 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                {periodicSimulation.hourlySummary.map((pt) => {
                  const maxVal = Math.max(1, periodicSimulation.peakSteadyEnvelope);
                  const periodicHeight = Math.max(8, (pt.totalPeriodic / maxVal) * 100);
                  const isPeak = pt.hour === periodicSimulation.peakEnvelopeHour;
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

              {/* Legend & Hourly Details */}
              <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3 pt-1">
                <div className="flex items-center gap-4 flex-wrap text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600"></span>
                    <span>Peak Heat Hour ({periodicSimulation.peakEnvelopeHour}:00)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-zinc-300 dark:bg-zinc-700"></span>
                    <span>Periodic Load (Qc)</span>
                  </div>
                </div>
                <div className="text-[11px] font-medium text-zinc-400">
                  Indoor Ti: <strong className="text-zinc-900 dark:text-white">{indoorTemp}°C</strong> | Daily Outdoor Mean: <strong className="text-zinc-900 dark:text-white">{dailyMeanTemp}°C</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Envelope Assemblies Table with Interactive Sliders */}
          <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-zinc-900 overflow-hidden">
            <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  Envelope Elements: Dynamic Properties & Tuning
                </CardTitle>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  Adjust Time-lag (ϕ) and Decrement factor (μ) to instantly test how wall/roof thickness and thermal mass impact cooling loads.
                </p>
              </div>
            </CardHeader>
            <div className="overflow-x-auto p-6">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    <th className="pb-3">Element / Orientation</th>
                    <th className="pb-3">Area (m²)</th>
                    <th className="pb-3">U (W/m²K)</th>
                    <th className="pb-3">Time-Lag ϕ (hours)</th>
                    <th className="pb-3">Decrement Factor μ</th>
                    <th className="pb-3">Daily Avg Qa</th>
                    <th className="pb-3 font-bold text-indigo-600">Peak Load (Qc)</th>
                    <th className="pb-3 text-right">Mass Damping</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {periodicSimulation.elements.map((el, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                        {el.name}
                      </td>
                      <td className="py-3.5 font-mono">{el.area}</td>
                      <td className="py-3.5 font-mono">{el.uValue}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <input 
                            type="range"
                            min="0.5"
                            max="14.0"
                            step="0.1"
                            value={el.timeLag}
                            onChange={(e) => handleUpdateElementParam(idx, 'timeLag', parseFloat(e.target.value))}
                            className="w-20 accent-emerald-500 cursor-pointer"
                          />
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 w-10">
                            {el.timeLag}h
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <input 
                            type="range"
                            min="0.05"
                            max="1.0"
                            step="0.01"
                            value={el.decrementFactor}
                            onChange={(e) => handleUpdateElementParam(idx, 'decrementFactor', parseFloat(e.target.value))}
                            className="w-20 accent-emerald-500 cursor-pointer"
                          />
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 w-10">
                            {el.decrementFactor}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 font-mono text-zinc-600 dark:text-zinc-400">
                        {el.dailyAvgHeat} W
                      </td>
                      <td className="py-3.5 font-mono font-black text-indigo-600">
                        {el.peakHeatFlow} W <span className="text-[10px] text-zinc-400 font-normal">(@{el.peakHour}h)</span>
                      </td>
                      <td className="py-3.5 text-right font-black text-emerald-600">
                        -{el.loadReductionPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
