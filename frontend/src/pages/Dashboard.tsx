import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Navbar from '../components/Navbar';
import { 
  Calculator, 
  History, 
  ArrowRight, 
  Compass, 
  FileSearch, 
  Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
      {/* Navbar */}
      <Navbar title="Dashboard" />

      {/* Hero / Header */}
      <main className="container mx-auto px-4 py-10 md:py-14 flex-1">
        <div className="flex flex-col items-center text-center space-y-4 mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Unified Green Building Energy & Blueprint Suite
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-slate-900 dark:text-white">
            Architecture & Energy Studio
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Generate 2D architectural floor plans, extract room dimensions using AI vision, and seamlessly simulate thermal heat loads and building compliance.
          </p>
        </div>

        {/* 4 Main Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {/* 1. Heat Load Calculator */}
          <Card className="flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-zinc-900">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-sm">
                <Calculator className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Heat Load Calculator</CardTitle>
              <CardDescription className="text-sm line-clamp-3">
                Calculate room U-values, envelope solar heat gain, ventilation loads, and HVAC tonnage sizing.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm" 
                onClick={() => navigate('/calculator')}
              >
                Launch Calculator
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* 2. Floor Plan Generator */}
          <Card className="flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-zinc-900">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-sm">
                <Compass className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Floor Plan Generator</CardTitle>
              <CardDescription className="text-sm line-clamp-3">
                Interactive 2D architectural CAD designer. Craft single or multi-room plans, customize doors/windows, and verify daylight ratios.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm" 
                onClick={() => navigate('/floorplan/generator')}
              >
                Open CAD Studio
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* 3. Floor Plan Reader (AI/CV) */}
          <Card className="flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-sky-100 dark:border-sky-900/40 bg-white dark:bg-zinc-900">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 flex items-center justify-center mb-3 shadow-sm">
                <FileSearch className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Floor Plan Reader</CardTitle>
              <CardDescription className="text-sm line-clamp-3">
                AI and CV blueprint extraction. Upload drawings to automatically detect walls, doors, windows, and real-world dimensions.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              <Button 
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-sm" 
                onClick={() => navigate('/floorplan/reader')}
              >
                Analyze Blueprint
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* 4. Calculation History */}
          <Card className="flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-amber-100 dark:border-amber-900/40 bg-white dark:bg-zinc-900">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center mb-3 shadow-sm">
                <History className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Calculation History</CardTitle>
              <CardDescription className="text-sm line-clamp-3">
                Review, download, or edit your saved thermal heat load simulations and room dimension reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              <Button 
                variant="outline" 
                className="w-full border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/50" 
                onClick={() => navigate('/calculator/history')}
              >
                View History
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Showcase Section */}
        <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 p-8 max-w-7xl mx-auto shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Connected Green Building Workflow</h2>
              <p className="text-sm text-muted-foreground mt-1">
                From architectural conception to automated energy analysis in three connected stages.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold">
                Instant Data Transfer
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="flex flex-col p-5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                <h3 className="font-semibold text-base">Plan & Design</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Design custom layouts or pick from 1-BHK, 2-BHK, or office presets. Place doors, windows, and configure exterior/interior wall thicknesses in 2D CAD.
              </p>
            </div>

            <div className="flex flex-col p-5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">2</span>
                <h3 className="font-semibold text-base">Scan & Extract</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Already have blueprints? Upload PNG, JPG, or SVG drawings. The AI YOLO segmenter detects rooms, walls, doors, windows, and scales automatically.
              </p>
            </div>

            <div className="flex flex-col p-5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">3</span>
                <h3 className="font-semibold text-base">Energy & Thermal Sim</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send detected rooms directly to the Heat Load Calculator with 1 click. Wall orientations, opening areas, and dimensions prefill seamlessly!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
