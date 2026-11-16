import React, { useState, useEffect, useRef } from 'react';
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
  Check
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

export default function FloorPlanReader() {
  const navigate = useNavigate();

  // State
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Analysis options
  const [method, setMethod] = useState<'segmentation' | 'hybrid'>('segmentation');
  const [ppm, setPpm] = useState<string>('59.45');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<'overlay' | 'original' | 'split'>('overlay');

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
        formData.append('method', method);
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
            method,
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
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  // Send detected room to Green Building Heat Load Calculator
  const handleSendRoomToCalculator = (room: DetectedRoom) => {
    // Determine length & breadth from real dimensions or normalized
    const length = (room.real_length || (room.norm_length ? (room.norm_length * 0.015).toFixed(2) : 4.5)).toString();
    const breadth = (room.real_width || (room.norm_width ? (room.norm_width * 0.015).toFixed(2) : 3.8)).toString();

    // Map any doors/windows near this room's box
    const doors: any[] = [];
    const windows: any[] = [];

    // Find doors intersecting with room bounding box
    if (result?.analysis.doors) {
      result.analysis.doors.forEach((d) => {
        if (
          d.box_2d.xmin <= room.box_2d.xmax + 50 &&
          d.box_2d.xmax >= room.box_2d.xmin - 50 &&
          d.box_2d.ymin <= room.box_2d.ymax + 50 &&
          d.box_2d.ymax >= room.box_2d.ymin - 50
        ) {
          doors.push({
            wall: 'S', // default South orientation
            width: '0.9',
            height: '2.1',
            area: '1.89',
          });
        }
      });
    }

    // Find windows intersecting with room bounding box
    if (result?.analysis.windows) {
      result.analysis.windows.forEach((w) => {
        if (
          w.box_2d.xmin <= room.box_2d.xmax + 50 &&
          w.box_2d.xmax >= room.box_2d.xmin - 50 &&
          w.box_2d.ymin <= room.box_2d.ymax + 50 &&
          w.box_2d.ymax >= room.box_2d.ymin - 50
        ) {
          windows.push({
            wall: 'N', // default North orientation
            width: '1.4',
            height: '1.4',
            area: '1.96',
            shgc: '0.40',
            uValue: '3.0',
          });
        }
      });
    }

    const prefillData = {
      source: 'FloorPlanReader',
      roomName: room.detected_label_text || room.name || 'Detected Room',
      length,
      breadth,
      height: '3.0',
      unitLength: 'm',
      unitBreadth: 'm',
      unitHeight: 'm',
      doors: doors.length > 0 ? doors : [{ wall: 'S', width: '0.9', height: '2.1', area: '1.89' }],
      windows: windows.length > 0 ? windows : [{ wall: 'N', width: '1.4', height: '1.4', area: '1.96', shgc: '0.40', uValue: '3.0' }],
    };

    sessionStorage.setItem('gb_calculator_prefill', JSON.stringify(prefillData));
    navigate('/calculator');
  };

  // Download Analysis JSON
  const handleDownloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint_analysis_${Date.now()}.json`;
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
              Upload 2D drawings or architectural blueprints to detect rooms, walls, doors, windows, and calculate real-world dimensions.
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
                  Supports high-res blueprints, CAD drawings, and SVG vector plans.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 2. Analysis Settings & Execution */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Analysis Engine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Detection Method</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    onClick={() => setMethod('segmentation')}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      method === 'segmentation'
                        ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 font-semibold text-sky-900 dark:text-sky-300'
                        : 'border-slate-200 dark:border-zinc-800 text-muted-foreground'
                    }`}
                  >
                    <div className="font-bold">YOLO Segmentation</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Deep Learning polygon masks</div>
                  </button>

                  <button
                    onClick={() => setMethod('hybrid')}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      method === 'hybrid'
                        ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 font-semibold text-sky-900 dark:text-sky-300'
                        : 'border-slate-200 dark:border-zinc-800 text-muted-foreground'
                    }`}
                  >
                    <div className="font-bold">Hybrid CV & Contours</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Deterministic OpenCV edges</div>
                  </button>
                </div>
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

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900">
                <span className="text-xs text-muted-foreground">Rooms Detected</span>
                <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                  {result.analysis.metadata.total_rooms}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900">
                <span className="text-xs text-muted-foreground">Doors Detected</span>
                <p className="text-2xl font-extrabold text-indigo-600 mt-0.5">
                  {result.analysis.metadata.total_doors}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900">
                <span className="text-xs text-muted-foreground">Windows Detected</span>
                <p className="text-2xl font-extrabold text-sky-600 mt-0.5">
                  {result.analysis.metadata.total_windows}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900">
                <span className="text-xs text-muted-foreground">Resolution</span>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mt-1">
                  {result.analysis.metadata.image_width} × {result.analysis.metadata.image_height}
                </p>
              </div>

              <div className="border rounded-xl p-3 bg-white dark:bg-zinc-900">
                <span className="text-xs text-muted-foreground">Processing Time</span>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mt-1">
                  {result.processing_time_ms ? `${(result.processing_time_ms / 1000).toFixed(2)}s` : 'Fast'}
                </p>
              </div>
            </div>

            {/* Visualizer & Inspector Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Visual Canvas (7 cols) */}
              <div className="lg:col-span-7 border rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs flex flex-col">
                <div className="p-3 border-b flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide">Drawing Visualization</span>
                    <Badge variant="outline" className="text-[10px]">{result.method_used}</Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg border p-0.5 bg-slate-100 dark:bg-zinc-800 text-xs">
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

                <div className="p-4 flex-1 flex items-center justify-center bg-slate-900 min-h-[420px] overflow-auto">
                  {viewMode === 'overlay' && result.overlay_base64 ? (
                    <img
                      src={result.overlay_base64}
                      alt="AI Visual Overlay"
                      className="max-h-[500px] object-contain rounded border border-slate-800 shadow-lg"
                    />
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Original Blueprint"
                      className="max-h-[500px] object-contain rounded border border-slate-800 shadow-lg"
                    />
                  ) : (
                    <div className="text-white text-xs">No image to display</div>
                  )}
                </div>
              </div>

              {/* Right: Detected Rooms & Openings (5 cols) */}
              <div className="lg:col-span-5 border rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <span className="font-bold text-sm">Detected Rooms & Spaces</span>
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

                  {/* Rooms List */}
                  <div className="space-y-2 mt-3 max-h-[380px] overflow-y-auto pr-1">
                    {result.analysis.rooms
                      .filter((r) => r.name !== 'wall') // filter out wall segments from room list
                      .map((room, idx) => {
                        const realL = room.real_length || (room.norm_length ? (room.norm_length * 0.015).toFixed(2) : 4.0);
                        const realW = room.real_width || (room.norm_width ? (room.norm_width * 0.015).toFixed(2) : 3.5);
                        const areaSqm = ((Number(realL) || 0) * (Number(realW) || 0)).toFixed(1);

                        return (
                          <div
                            key={room.id || idx}
                            className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 hover:bg-slate-100/70 transition-all flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="font-semibold text-xs capitalize">
                                  {room.detected_label_text || room.name || `Room ${idx + 1}`}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-[10px]">
                                {areaSqm} m² ({((Number(areaSqm) || 0) * 10.764).toFixed(0)} sq ft)
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                Dim: {realL}m × {realW}m
                              </span>
                              {room.area_percentage && (
                                <span>{room.area_percentage.toFixed(1)}% of plan</span>
                              )}
                            </div>

                            {/* Action: Send to Heat Load Calculator */}
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium mt-1 shadow-xs"
                              onClick={() => handleSendRoomToCalculator(room)}
                            >
                              <Calculator className="w-3 h-3 mr-1.5" />
                              Calculate Heat Load for this Room
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Doors: {result.analysis.doors?.length || 0}</span>
                    <span>Windows: {result.analysis.windows?.length || 0}</span>
                    <span className="text-emerald-600 font-semibold">Ready for Simulation</span>
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
