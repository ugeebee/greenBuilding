import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const surfaces = ['N', 'S', 'E', 'W', 'Roof'];
const walls = ['N', 'S', 'E', 'W'];
const wallLabels: Record<string, string> = {
  N: 'Wall 1',
  E: 'Wall 2',
  S: 'Wall 3',
  W: 'Wall 4',
  Roof: 'Roof',
  Floor: 'Floor'
};

export default function Wizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Databases
  const [materials, setMaterials] = useState<any[]>([]);
  const [sheet2, setSheet2] = useState<any[]>([]);
  const [windowsData, setWindowsData] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // Form State
  const [room, setRoom] = useState({ length: '', breadth: '', height: '', unitLength: 'm', unitBreadth: 'm', unitHeight: 'm' });
  const [wallConfigType, setWallConfigType] = useState<'monolithic' | 'composite'>('monolithic');
  const [monoWall, setMonoWall] = useState({ type: 'standard', name: '', thickness: '', k: '', u: '' });
  const [wallMats, setWallMats] = useState({
    outer: { type: 'standard', name: '', thickness: '', k: '' },
    central: { type: 'standard', name: '', thickness: '', k: '' },
    inner: { type: 'standard', name: '', thickness: '', k: '' },
  });
  const [floorMat, setFloorMat] = useState({ type: 'standard', name: '', thickness: '', k: '', u: '' });
  const [roofMat, setRoofMat] = useState({ type: 'standard', name: '', thickness: '', k: '', u: '' });
  
  const [doors, setDoors] = useState<any[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  
  const [temps, setTemps] = useState({ inside: '', ach: '', outN: '', outS: '', outE: '', outW: '', outRoof: '', outFloor: '' });
  const [surfaceParams, setSurfaceParams] = useState<any>({});

  useEffect(() => {
    const fetchDbs = async () => {
      try {
        const [matRes, sh2Res, winRes] = await Promise.all([
          fetch('/GreenBuildingData_Sheet1.json'),
          fetch('/GreenBuildingData_Sheet2.json'),
          fetch('/GreenBuildingData_Sheet4.json')
        ]);
        if (!matRes.ok) throw new Error("Failed");
        setMaterials(await matRes.json());
        setSheet2(await sh2Res.json());
        setWindowsData(await winRes.json());
        setLoadingDb(false);
      } catch (err) {
        console.error("DB Load Error", err);
      }
    };
    fetchDbs();
  }, []);

  const convertToMeters = (value: string, unit: string) => {
    const num = parseFloat(value) || 0;
    if (unit === 'mm') return num / 1000;
    if (unit === 'ft') return num * 0.3048;
    if (unit === 'in') return num * 0.0254;
    return num;
  };

  const calculateWallAreas = () => {
    const l = convertToMeters(room.length, room.unitLength);
    const b = convertToMeters(room.breadth, room.unitBreadth);
    const h = convertToMeters(room.height, room.unitHeight);
    return { N: l * h, S: l * h, E: b * h, W: b * h };
  };

  const getMaterialData = (matObj: any) => {
    let name = "", rValue = 0;
    const thicknessMeters = (parseFloat(matObj.thickness) || 0) / 1000;
    
    if (matObj.type === 'standard') {
      const opt = materials.find(m => m.Material === matObj.name);
      name = matObj.name;
      const k = opt ? parseFloat(opt['Thermal Conductivity  ']) : 0;
      rValue = (k !== 0) ? (thicknessMeters / k) : 0;
    } else if (matObj.type === 'custom' || matObj.type === 'custom_wk') {
      name = matObj.name || "Custom Material";
      const k = parseFloat(matObj.k) || 0;
      rValue = (k !== 0) ? (thicknessMeters / k) : 0;
    } else if (matObj.type === 'custom_u') {
      name = matObj.name || "Custom Material";
      const u = parseFloat(matObj.u) || 0;
      rValue = (u !== 0) ? (1 / u) : 0;
    }
    return { 
      type: matObj.type.includes('custom') ? "custom" : "standard", 
      name: name, 
      thickness: parseFloat(thicknessMeters.toFixed(4)),
      R: parseFloat(rValue.toFixed(4)) 
    };
  };

  const handleNext = () => {
    if (step === 1) {
      if (!room.length || !room.breadth || !room.height) return alert("Fill Room Geometry");
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (wallConfigType === 'monolithic') {
        if (!monoWall.name && monoWall.type === 'standard') return alert("Select Wall Material");
      }
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      const wa = calculateWallAreas();
      let usedArea = { N: 0, S: 0, E: 0, W: 0 };
      doors.forEach(d => usedArea[d.wall as keyof typeof usedArea] += parseFloat(d.area) || 0);
      windows.forEach(w => usedArea[w.wall as keyof typeof usedArea] += parseFloat(w.area) || 0);
      for (const w of walls) {
        if (usedArea[w as keyof typeof usedArea] > wa[w as keyof typeof wa]) {
          return alert(`Error: Total openings on ${w} wall exceed available area.`);
        }
      }
      setStep(7);
    } else if (step === 7) {
      setStep(8);
    } else if (step === 8) {
      setStep(9);
    } else    if (step === 9) {
      generateJSON();
      return;
    }
    setStep(step + 1);
  };

  const FloorPlanPreview = () => {
    const l = convertToMeters(room.length, room.unitLength);
    const b = convertToMeters(room.breadth, room.unitBreadth);
    
    // Scale for 2D (max size 300px)
    const maxDim = Math.max(l, b) || 1;
    const scale = 300 / maxDim;
    const width = b * scale; 
    const height = l * scale;

    const renderOpenings = (wall: string) => {
      const wallDoors = doors.filter(d => d.wall === wall);
      const wallWins = windows.filter(w => w.wall === wall);
      const total = wallDoors.length + wallWins.length;
      if (total === 0) return null;

      return (
        <div className={`absolute flex items-center justify-center gap-1 ${
          wall === 'N' ? 'top-0 left-0 w-full h-2 -translate-y-full' :
          wall === 'S' ? 'bottom-0 left-0 w-full h-2 translate-y-full' :
          wall === 'E' ? 'top-0 right-0 h-full w-2 translate-x-full flex-col' :
          'top-0 left-0 h-full w-2 -translate-x-full flex-col'
        }`}>
          {wallDoors.map((_, i) => <div key={`d-${i}`} className="bg-amber-600 w-4 h-1 rounded-sm shadow-sm" title="Door"></div>)}
          {wallWins.map((_, i) => <div key={`w-${i}`} className="bg-sky-400 w-4 h-1 rounded-sm shadow-sm" title="Window"></div>)}
        </div>
      );
    };

    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xl border border-slate-100 min-h-[500px]">
        <div className="mb-12 text-center">
          <h3 className="text-2xl font-black text-indigo-950 mb-2">2D Floor Plan</h3>
          <p className="text-slate-500 font-medium">Top-down view with opening assignments</p>
        </div>

        <div className="relative border-4 border-slate-800 bg-slate-50 shadow-2xl transition-all duration-500" style={{ width: `${width}px`, height: `${height}px` }}>
          {/* Wall Labels & Openings */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest">Wall 1</div>
          {renderOpenings('N')}
          
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest rotate-90">Wall 2</div>
          {renderOpenings('E')}

          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest">Wall 3</div>
          {renderOpenings('S')}

          <div className="absolute -left-16 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest -rotate-90">Wall 4</div>
          {renderOpenings('W')}

          {/* Room Center Label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
             <div className="text-4xl font-black text-slate-900">{l}m x {b}m</div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-6 w-full max-w-sm">
           <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-xl border border-amber-100">
             <div className="w-4 h-4 bg-amber-600 rounded-sm"></div>
             <span className="text-sm font-bold text-amber-900">Doors ({doors.length})</span>
           </div>
           <div className="flex items-center gap-3 bg-sky-50 p-3 rounded-xl border border-sky-100">
             <div className="w-4 h-4 bg-sky-400 rounded-sm"></div>
             <span className="text-sm font-bold text-sky-900">Windows ({windows.length})</span>
           </div>
        </div>
      </div>
    );
  };

  const generateJSON = () => {
    const data = {
      room: {
        length: convertToMeters(room.length, room.unitLength),
        breadth: convertToMeters(room.breadth, room.unitBreadth),
        height: convertToMeters(room.height, room.unitHeight)
      },
      wallMaterials: wallConfigType === 'monolithic' ? {
        outer: { type: 'standard', name: 'None', thickness: 0, k: 1, R: 0 },
        central: getMaterialData(monoWall),
        inner: { type: 'standard', name: 'None', thickness: 0, k: 1, R: 0 }
      } : { 
        outer: getMaterialData(wallMats.outer), 
        central: getMaterialData(wallMats.central), 
        inner: getMaterialData(wallMats.inner) 
      },
      floorMaterial: getMaterialData(floorMat),
      roofMaterial: getMaterialData(roofMat),
      doors: doors.map((d, i) => {
        let matR = 0;
        if (d.type === 'wk') {
          const w = parseFloat(d.width) || 0;
          const k = parseFloat(d.k) || 0;
          matR = (k !== 0) ? (w / k) : 0;
        } else {
          const u = parseFloat(d.u) || 0;
          matR = (u !== 0) ? (1 / u) : 0;
        }
        return { 
          id: i + 1, wall: d.wall, area: parseFloat(d.area) || 0,
          material: { name: d.name || "Door", R: parseFloat(matR.toFixed(4)) }
        };
      }),
      windows: windows.map((w, i) => {
        const opt = windowsData.find(wd => 
          wd['Glazing Type'].trim() === w.glazingType && 
          wd['Exposure Condition'] === w.exposure
        );
        const uValue = opt ? parseFloat(opt['U-Value ']) : 0;
        return {
          id: i + 1, wall: w.wall, area: parseFloat(w.area) || 0,
          glazingDetails: `${w.glazingType} (${w.exposure})`,
          R: (uValue !== 0) ? parseFloat((1 / uValue).toFixed(4)) : 0,
          SGF: parseFloat(w.sgf) || 0
        };
      }),
      temperatures: { 
        inside: parseFloat(temps.inside) || 0, 
        outdoor: {
          N: parseFloat(temps.outN) || 0, S: parseFloat(temps.outS) || 0, E: parseFloat(temps.outE) || 0, W: parseFloat(temps.outW) || 0,
          Roof: parseFloat(temps.outRoof) || 0, Floor: parseFloat(temps.outFloor) || 0
        }
      },
      ACH: parseFloat(temps.ach) || 0,
      surfaceParams: {} as any
    };

    surfaces.forEach(s => {
      const sp = surfaceParams[s] || {};
      const sheet2Opt = sheet2.find(x => x['Resistance '].toString() === sp.rso);
      data.surfaceParams[s] = {
        exposureCondition: sheet2Opt ? sheet2Opt.Surface : "Unknown",
        Rso: parseFloat(sp.rso) || 0,
        G: parseFloat(sp.g) || 0,
        alpha: parseFloat(sp.alpha) || 0,
        e: s === 'Roof' ? (parseFloat(sp.e) || 0) : 0
      };
    });

    localStorage.setItem('demoOutput', JSON.stringify(data));
    navigate('/calculator/uvalues');
  };

  const renderMatInput = (mat: any, setMat: any, title: string, hasU: boolean = false) => (
    <div className="border p-4 rounded-md mb-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <Label className="text-lg font-semibold mb-2 block text-indigo-900">{title}</Label>
      <div className="flex flex-wrap gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
          <input type="radio" className="w-4 h-4 text-indigo-600" checked={mat.type === 'standard'} onChange={() => setMat({...mat, type: 'standard'})} /> Standard
        </label>
        {hasU && (
          <>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input type="radio" className="w-4 h-4 text-indigo-600" checked={mat.type === 'custom_wk'} onChange={() => setMat({...mat, type: 'custom_wk'})} /> Custom (W&k)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input type="radio" className="w-4 h-4 text-indigo-600" checked={mat.type === 'custom_u'} onChange={() => setMat({...mat, type: 'custom_u'})} /> Custom (U)
            </label>
          </>
        )}
        {!hasU && (
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="radio" className="w-4 h-4 text-indigo-600" checked={mat.type === 'custom'} onChange={() => setMat({...mat, type: 'custom'})} /> Custom
          </label>
        )}
      </div>
      
      {mat.type === 'standard' && (
        <div className="flex flex-col md:flex-row gap-3">
          <select className="flex-1 border p-2 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" value={mat.name} onChange={e => setMat({...mat, name: e.target.value})}>
            <option value="">Select material...</option>
            {materials.map((m, i) => <option key={i} value={m.Material}>{m.Material} (k={m['Thermal Conductivity  ']})</option>)}
          </select>
          <div className="flex-1">
            <Input placeholder="Thickness (mm)" type="number" value={mat.thickness} onChange={e => setMat({...mat, thickness: e.target.value})} />
          </div>
        </div>
      )}
      {(mat.type === 'custom' || mat.type === 'custom_wk') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Name" value={mat.name} onChange={e => setMat({...mat, name: e.target.value})} />
          <Input placeholder="Thickness (mm)" type="number" value={mat.thickness} onChange={e => setMat({...mat, thickness: e.target.value})} />
          <Input placeholder="k (Thermal Conductivity)" type="number" value={mat.k} onChange={e => setMat({...mat, k: e.target.value})} />
        </div>
      )}
      {mat.type === 'custom_u' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Name" value={mat.name} onChange={e => setMat({...mat, name: e.target.value})} />
          <Input placeholder="U-Value (W/m²K)" type="number" value={mat.u} onChange={e => setMat({...mat, u: e.target.value})} />
        </div>
      )}
    </div>
  );

  const CuboidPreview = () => {
    const [rot, setRot] = useState({ x: -20, y: 45 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    const l = convertToMeters(room.length, room.unitLength);
    const b = convertToMeters(room.breadth, room.unitBreadth);
    const h = convertToMeters(room.height, room.unitHeight);
    
    // Normalize dimensions for display (max size 180px to allow rotation room)
    const maxDim = Math.max(l, b, h) || 1;
    const scale = 180 / maxDim;
    const width = b * scale; 
    const depth = l * scale; 
    const height = h * scale;

    const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - lastPos.x;
      const deltaY = e.clientY - lastPos.y;
      setRot(prev => ({
        x: prev.x - deltaY * 0.5,
        y: prev.y + deltaX * 0.5
      }));
      setLastPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
      <div 
        className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl shadow-inner border border-slate-200 perspective-1000 min-h-[450px] select-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="mb-8 text-center pointer-events-none">
          <h3 className="text-xl font-bold text-indigo-900 mb-1">Room Visualization</h3>
          <p className="text-sm text-indigo-600/70">Click and drag to rotate the room</p>
        </div>
        <div 
          className="relative preserve-3d transition-transform duration-100 ease-out"
          style={{ 
            width: `${width}px`, 
            height: `${height}px`,
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`
          }}
        >
          {/* Back (Wall 1) */}
          <div className="absolute inset-0 bg-indigo-500/30 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-900 backface-hidden shadow-lg" style={{ transform: `translateZ(${-depth/2}px) rotateY(180deg)` }}>Wall 1</div>
          {/* Right (Wall 2) */}
          <div className="absolute inset-0 bg-indigo-400/30 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-900 backface-hidden shadow-lg" style={{ width: `${depth}px`, left: `-${(depth-width)/2}px`, transform: `rotateY(90deg) translateZ(${width/2}px)` }}>Wall 2</div>
          {/* Front (Wall 3) */}
          <div className="absolute inset-0 bg-indigo-500/30 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-900 backface-hidden shadow-lg" style={{ transform: `translateZ(${depth/2}px)` }}>Wall 3</div>
          {/* Left (Wall 4) */}
          <div className="absolute inset-0 bg-indigo-400/30 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-900 backface-hidden shadow-lg" style={{ width: `${depth}px`, left: `-${(depth-width)/2}px`, transform: `rotateY(-90deg) translateZ(${width/2}px)` }}>Wall 4</div>
          {/* Top (Roof) */}
          <div className="absolute inset-0 bg-indigo-300/30 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-900 backface-hidden shadow-lg" style={{ height: `${depth}px`, top: `-${(depth-height)/2}px`, transform: `rotateX(90deg) translateZ(${height/2}px)` }}>Roof</div>
          {/* Bottom (Floor) */}
          <div className="absolute inset-0 bg-slate-400/30 border-2 border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-900 backface-hidden shadow-lg" style={{ height: `${depth}px`, top: `-${(depth-height)/2}px`, transform: `rotateX(-90deg) translateZ(${height/2}px)` }}>Floor</div>
        </div>
        <div className="mt-16 flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="grid grid-cols-3 gap-8 text-center text-sm font-medium text-slate-600 w-full pointer-events-none">
            <div><div className="text-indigo-600 font-bold">{room.length}{room.unitLength}</div>Length</div>
            <div><div className="text-indigo-600 font-bold">{room.breadth}{room.unitBreadth}</div>Breadth</div>
            <div><div className="text-indigo-600 font-bold">{room.height}{room.unitHeight}</div>Height</div>
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setRot({ x: -20, y: 45 }); }} className="text-xs text-indigo-400 hover:text-indigo-600">
            Reset View
          </Button>
        </div>
      </div>
    );
  };

  const SurfaceExposureSelector = ({ currentRso, onSelect }: { currentRso: string, onSelect: (rso: string) => void }) => {
    const [severity, setSeverity] = useState<string>("");

    const getSeverity = (text: string) => {
      if (text.toLowerCase().includes('sheltered')) return 'Sheltered';
      if (text.toLowerCase().includes('normal')) return 'Normal';
      if (text.toLowerCase().includes('severe')) return 'Severe';
      return 'Special';
    };

    const filteredOptions = sheet2.filter(opt => {
      if (!severity) return true;
      return getSeverity(opt.Surface) === severity;
    });

    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['Sheltered', 'Normal', 'Severe', 'Special'].map(s => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${
                severity === s 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {severity && (
          <div className="grid grid-cols-1 gap-2">
            {filteredOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() => onSelect(opt['Resistance '].toString())}
                className={`p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                  currentRso === opt['Resistance '].toString()
                  ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400'
                  : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-indigo-900">{opt.Surface}</div>
                <div className="text-[10px] text-slate-500">Resistance: {opt['Resistance ']} | Conductance: {opt['Conductance ']}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const GlazingSelector = ({ win, windowIdx }: { win: any, windowIdx: number }) => {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['single glazing', 'double glazing, 6 mm space', 'double glazing, 20 mm space'].map(type => (
            <button
              key={type}
              onClick={() => {
                const nw = [...windows];
                nw[windowIdx].glazingType = type;
                // Auto-clear exposure when type changes
                nw[windowIdx].exposure = "";
                setWindows(nw);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${
                win.glazingType === type 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>

        {win.glazingType && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 font-bold uppercase">Select Exposure / Direction</Label>
            <div className="grid grid-cols-1 gap-2">
              {windowsData
                .filter(d => d['Glazing Type'].trim() === win.glazingType)
                .map((d, di) => (
                  <div
                    key={di}
                    onClick={() => {
                      const nw = [...windows];
                      nw[windowIdx].exposure = d['Exposure Condition'];
                      setWindows(nw);
                    }}
                    className={`p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                      win.exposure === d['Exposure Condition']
                      ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400'
                      : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    {d['Exposure Condition']}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loadingDb) return <div className="p-12 text-center text-xl">Loading Material Databases...</div>;

  return (
    <div className="container mx-auto p-6 max-w-4xl pt-8 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Room Data Collector</h1>
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(step / 9) * 100}%` }}></div>
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
          <span>Geometry</span><span>Visual</span><span>Walls</span><span>Areas</span><span>Structure</span><span>Openings</span><span>Plan</span><span>Temps</span><span>Final</span>
        </div>
      </div>

      {step === 1 && (
        <Card className="shadow-lg border-indigo-100">
          <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900">Room Geometry</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Length</Label>
              <div className="flex gap-2">
                <Input className="focus:ring-indigo-500" type="number" value={room.length} onChange={e => setRoom({...room, length: e.target.value})} />
                <select className="border rounded-md px-2 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" value={room.unitLength} onChange={e => setRoom({...room, unitLength: e.target.value})}>
                  <option value="m">m</option><option value="mm">mm</option><option value="ft">ft</option><option value="in">in</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Breadth</Label>
              <div className="flex gap-2">
                <Input className="focus:ring-indigo-500" type="number" value={room.breadth} onChange={e => setRoom({...room, breadth: e.target.value})} />
                <select className="border rounded-md px-2 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" value={room.unitBreadth} onChange={e => setRoom({...room, unitBreadth: e.target.value})}>
                  <option value="m">m</option><option value="mm">mm</option><option value="ft">ft</option><option value="in">in</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Height</Label>
              <div className="flex gap-2">
                <Input className="focus:ring-indigo-500" type="number" value={room.height} onChange={e => setRoom({...room, height: e.target.value})} />
                <select className="border rounded-md px-2 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" value={room.unitHeight} onChange={e => setRoom({...room, unitHeight: e.target.value})}>
                  <option value="m">m</option><option value="mm">mm</option><option value="ft">ft</option><option value="in">in</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && <CuboidPreview />}

      {step === 3 && (
        <Card className="shadow-lg border-indigo-100">
          <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900">Wall Material Configuration</CardTitle></CardHeader>
          <CardContent className="pt-6">
            <div className="flex gap-6 mb-8 p-1 bg-slate-100 rounded-lg w-fit">
              <button 
                onClick={() => setWallConfigType('monolithic')}
                className={`px-6 py-2 rounded-md transition-all font-medium ${wallConfigType === 'monolithic' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Monolithic Wall
              </button>
              <button 
                onClick={() => setWallConfigType('composite')}
                className={`px-6 py-2 rounded-md transition-all font-medium ${wallConfigType === 'composite' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Composite Wall
              </button>
            </div>

            {wallConfigType === 'monolithic' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-4 italic">Monolithic walls consist of a single primary material layer.</p>
                {renderMatInput(monoWall, setMonoWall, "Wall Material", true)}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-4 italic">Composite walls consist of outer, central, and inner layers.</p>
                {renderMatInput(wallMats.outer, (v: any) => setWallMats({...wallMats, outer: v}), "Outer Layer", true)}
                {renderMatInput(wallMats.central, (v: any) => setWallMats({...wallMats, central: v}), "Central Layer", true)}
                {renderMatInput(wallMats.inner, (v: any) => setWallMats({...wallMats, inner: v}), "Inner Layer", true)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="shadow-lg border-indigo-100">
          <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900">Calculated Wall Areas</CardTitle></CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'W1 (North)', area: calculateWallAreas().N },
                { label: 'W2 (East)', area: calculateWallAreas().E },
                { label: 'W3 (South)', area: calculateWallAreas().S },
                { label: 'W4 (West)', area: calculateWallAreas().W }
              ].map((w, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{w.label}</div>
                  <div className="text-2xl font-bold text-indigo-600">{w.area.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Square Meters</div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <p className="text-sm text-indigo-800 font-medium">Note: Areas are calculated based on your room dimensions (Length × Height for N/S, Breadth × Height for E/W).</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="shadow-lg border-indigo-100">
          <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900">Floor & Roof Materials</CardTitle></CardHeader>
          <CardContent className="pt-6">
            {renderMatInput(floorMat, setFloorMat, "Floor Material", true)}
            {renderMatInput(roofMat, setRoofMat, "Roof Material", true)}
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Doors & Windows</CardTitle>
            <div className="text-sm bg-indigo-50 text-indigo-800 p-3 rounded">
              Available Wall Areas (m²) - 
              Wall 1: {calculateWallAreas().N.toFixed(2)}, Wall 2: {calculateWallAreas().E.toFixed(2)}, 
              Wall 3: {calculateWallAreas().S.toFixed(2)}, Wall 4: {calculateWallAreas().W.toFixed(2)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-lg">Doors</h4>
                <Button variant="outline" size="sm" onClick={() => setDoors([...doors, { wall: 'N', area: '', type: 'wk', name: '', width: '', k: '', u: '' }])}>+ Add Door</Button>
              </div>
              {doors.map((door, i) => (
                <div key={i} className="border p-4 rounded mb-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <select className="border rounded p-2" value={door.wall} onChange={e => { const nd = [...doors]; nd[i].wall = e.target.value; setDoors(nd); }}>
                      <option value="N">Wall 1</option><option value="E">Wall 2</option>
                      <option value="S">Wall 3</option><option value="W">Wall 4</option>
                    </select>
                    <Input placeholder="Area (m²)" type="number" value={door.area} onChange={e => { const nd = [...doors]; nd[i].area = e.target.value; setDoors(nd); }} />
                    <Button variant="destructive" onClick={() => setDoors(doors.filter((_, idx) => idx !== i))}>X</Button>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1"><input type="radio" checked={door.type === 'wk'} onChange={() => { const nd = [...doors]; nd[i].type = 'wk'; setDoors(nd); }} /> Width & k</label>
                    <label className="flex items-center gap-1"><input type="radio" checked={door.type === 'u'} onChange={() => { const nd = [...doors]; nd[i].type = 'u'; setDoors(nd); }} /> U-Value</label>
                  </div>
                  <Input placeholder="Material Name" value={door.name} onChange={e => { const nd = [...doors]; nd[i].name = e.target.value; setDoors(nd); }} />
                  {door.type === 'wk' ? (
                    <div className="flex gap-2">
                      <Input placeholder="Width (m)" type="number" value={door.width} onChange={e => { const nd = [...doors]; nd[i].width = e.target.value; setDoors(nd); }} />
                      <Input placeholder="k" type="number" value={door.k} onChange={e => { const nd = [...doors]; nd[i].k = e.target.value; setDoors(nd); }} />
                    </div>
                  ) : (
                    <Input placeholder="U-Value" type="number" value={door.u} onChange={e => { const nd = [...doors]; nd[i].u = e.target.value; setDoors(nd); }} />
                  )}
                </div>
              ))}
            </div>

            <hr />

            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-lg text-indigo-900">Windows</h4>
                <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => setWindows([...windows, { wall: 'N', area: '', glazingType: '', exposure: '', sgf: '' }])}>+ Add Window</Button>
              </div>
              {windows.map((win, i) => (
                <div key={i} className="border border-slate-100 p-6 rounded-2xl mb-6 flex flex-col gap-6 bg-slate-50/30">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Wall Assignment</Label>
                      <select className="w-full border rounded-lg p-2.5 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={win.wall} onChange={e => { const nw = [...windows]; nw[i].wall = e.target.value; setWindows(nw); }}>
                        <option value="N">Wall 1</option><option value="E">Wall 2</option>
                        <option value="S">Wall 3</option><option value="W">Wall 4</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Window Area (m²)</Label>
                      <Input placeholder="Area" type="number" className="bg-white shadow-sm" value={win.area} onChange={e => { const nw = [...windows]; nw[i].area = e.target.value; setWindows(nw); }} />
                    </div>
                    <div className="flex items-end">
                      <Button variant="destructive" className="w-full md:w-auto" onClick={() => setWindows(windows.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <Label className="text-xs font-bold text-slate-500 uppercase mb-3 block text-center">Glazing Configuration</Label>
                    <GlazingSelector win={win} windowIdx={i} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Solar Gain Factor (SGF)</Label>
                    <Input placeholder="SGF Value (0.0 - 1.0)" type="number" className="bg-white shadow-sm" value={win.sgf} onChange={e => { const nw = [...windows]; nw[i].sgf = e.target.value; setWindows(nw); }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 7 && <FloorPlanPreview />}

      {step === 8 && (
        <div className="space-y-6">
          <Card className="shadow-lg border-indigo-100">
            <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900 text-xl font-bold">Temperatures (°C) & Ventilation</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Inside Temperature</Label>
                <Input type="number" className="bg-slate-50 border-slate-200" value={temps.inside} onChange={e => setTemps({...temps, inside: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">ACH (Air Changes/Hour)</Label>
                <Input type="number" className="bg-slate-50 border-slate-200" value={temps.ach} onChange={e => setTemps({...temps, ach: e.target.value})} />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-indigo-100">
            <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900 text-xl font-bold">Outdoor Temperatures</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-6 pt-6">
              <div><Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Wall 1 Temp</Label><Input type="number" className="bg-slate-50 border-slate-200" value={temps.outN} onChange={e => setTemps({...temps, outN: e.target.value})} /></div>
              <div><Label>Wall 2 Temp</Label><Input type="number" value={temps.outE} onChange={e => setTemps({...temps, outE: e.target.value})} /></div>
              <div><Label>Wall 3 Temp</Label><Input type="number" value={temps.outS} onChange={e => setTemps({...temps, outS: e.target.value})} /></div>
              <div><Label>Wall 4 Temp</Label><Input type="number" value={temps.outW} onChange={e => setTemps({...temps, outW: e.target.value})} /></div>
              <div><Label>Roof Temp</Label><Input type="number" value={temps.outRoof} onChange={e => setTemps({...temps, outRoof: e.target.value})} /></div>
              <div><Label>Floor Temp</Label><Input type="number" value={temps.outFloor} onChange={e => setTemps({...temps, outFloor: e.target.value})} /></div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 9 && (
        <Card className="shadow-lg border-indigo-100">
          <CardHeader className="bg-indigo-50/50"><CardTitle className="text-indigo-900 text-xl font-bold">Surface Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-6 pt-6">
            {surfaces.map(s => (
              <div key={s} className="border border-slate-100 p-6 rounded-2xl bg-slate-50/30">
                <h4 className="font-bold text-indigo-900 mb-4 border-b border-indigo-100 pb-2 uppercase text-sm tracking-wider">{wallLabels[s]} Surface</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="col-span-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Exposure Condition</Label>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <SurfaceExposureSelector 
                        currentRso={surfaceParams[s]?.rso || ''} 
                        onSelect={(rso) => setSurfaceParams({...surfaceParams, [s]: {...surfaceParams[s], rso}})} 
                      />
                    </div>
                  </div>
                  <div><Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">G Value</Label><Input type="number" className="bg-white" value={surfaceParams[s]?.g || ''} onChange={e => setSurfaceParams({...surfaceParams, [s]: {...surfaceParams[s], g: e.target.value}})} /></div>
                  <div><Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Alpha</Label><Input type="number" className="bg-white" value={surfaceParams[s]?.alpha || ''} onChange={e => setSurfaceParams({...surfaceParams, [s]: {...surfaceParams[s], alpha: e.target.value}})} /></div>
                  {s === 'Roof' && <div><Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">e Value</Label><Input type="number" className="bg-white" value={surfaceParams[s]?.e || ''} onChange={e => setSurfaceParams({...surfaceParams, [s]: {...surfaceParams[s], e: e.target.value}})} /></div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center z-10 shadow-2xl">
        <div className="container mx-auto flex justify-between max-w-4xl">
          {step > 1 ? <Button variant="ghost" className="text-slate-500 hover:text-indigo-600 font-bold" onClick={() => setStep(step - 1)}>← Previous</Button> : <div></div>}
          <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-6 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95">
            {step === 9 ? "Calculate Final Results" : "Continue to Next Step →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
