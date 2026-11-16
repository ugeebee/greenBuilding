import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Upload,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Sparkles,
  RefreshCw,
  Check,
  ArrowRight
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
  const [hasSavedAnalysis, setHasSavedAnalysis] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch samples & check saved analysis on mount
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

    // Check if an existing analysis exists in session
    const stored = sessionStorage.getItem('gb_floorplan_analysis');
    if (stored) {
      setHasSavedAnalysis(true);
    }
  }, []);

  // Handle sample selection
  const handleSelectSample = (sample: SampleItem) => {
    setSelectedSample(sample);
    setUploadedFile(null);
    setPreviewUrl(`/samples/${sample.filename}`);
    setPpm(sample.ppm.toString());
    setErrorMsg(null);
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedSample(null);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMsg(null);
    }
  };

  // Run Floor Plan Analysis & Navigate to Results Page
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

      const data = await res.json();

      // Persist analysis to session storage
      sessionStorage.setItem(
        'gb_floorplan_analysis',
        JSON.stringify({ result: data, previewUrl, ppm })
      );

      // Navigate to dedicated results page
      navigate('/floorplan/reader/results', {
        state: { result: data, previewUrl, ppm },
      });
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
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
              Upload 2D drawings or architectural blueprints to detect, edit, move, and calibrate rooms, doors, and windows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasSavedAnalysis && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/floorplan/reader/results')}
                className="text-xs text-sky-600 border-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              >
                View Latest Analysis
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
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

        {/* Blueprint Selection & Upload Card */}
        <Card className="mb-8 shadow-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Architectural Blueprints & Upload</span>
              <span className="text-xs font-normal text-muted-foreground">
                Select a blueprint or upload a custom 2D plan to analyze
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Samples Gallery */}
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

            {/* Action Bar: Upload & Run Analysis */}
            <div className="mt-5 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
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
                {selectedSample && !uploadedFile && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    Selected: <span className="font-semibold text-slate-700 dark:text-zinc-200">{selectedSample.title}</span>
                  </span>
                )}
              </div>

              {/* Run Analysis Button */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Button
                  className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold h-10 px-8 shadow-sm text-sm"
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
              </div>
            </div>

            {errorMsg && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
