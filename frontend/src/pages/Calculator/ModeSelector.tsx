import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Calculator, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  FileSearch
} from 'lucide-react';

export default function ModeSelector() {
  const [prefillInfo, setPrefillInfo] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('gb_calculator_prefill');
      if (raw) {
        const parsed = JSON.parse(raw);
        setPrefillInfo(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
      <Navbar title="Heat Flow Calculator" />

      <main className="container mx-auto px-4 py-12 md:py-16 flex-1 max-w-6xl space-y-10">
        {/* Title Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-black px-3.5 py-1 text-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Thermal Energy & Envelope Analysis
          </Badge>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Select Heat Flow Method
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-medium">
            Choose whether to calculate static peak heating/cooling loads or simulate dynamic 24-hour periodic diurnal heat waves with envelope thermal mass.
          </p>
        </div>

        {/* CAD / Reader Prefill Notice */}
        {prefillInfo && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl flex items-center justify-between gap-4 max-w-3xl mx-auto animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
                <FileSearch className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-sm text-emerald-900 dark:text-emerald-200 block">
                  Room Blueprint Geometry Loaded
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  {prefillInfo.length}m × {prefillInfo.breadth}m (Height: {prefillInfo.height}m) | {prefillInfo.doors?.length || 0} Doors, {prefillInfo.windows?.length || 0} Windows imported from {prefillInfo.source || 'Studio'}
                </span>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold text-xs shrink-0">
              Ready to Simulate
            </Badge>
          </div>
        )}

        {/* 2 Main Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Option 1: Steady-State */}
          <Card className="flex flex-col rounded-3xl border-2 border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-zinc-900 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all overflow-hidden group">
            <div className="h-3 bg-indigo-600 w-full" />
            <CardHeader className="p-8 pb-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-xs group-hover:scale-105 transition-transform">
                <Calculator className="w-7 h-7" />
              </div>
              <Badge className="w-fit mb-2 text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Constant Temperature Method
              </Badge>
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                Steady-State Heat Load
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400 mt-2">
                Standard building code calculation assuming constant internal and external temperature differentials. Ideal for rapid envelope compliance and HVAC tonnage sizing.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-8 pt-2 flex-1 flex flex-col justify-between space-y-6">
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Envelope Conduction ($Q_c = A \cdot U \cdot \Delta T$)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Sol-Air Solar Radiation (Qso) & Window Gain (Qsw)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Air Infiltration & Ventilation ($Q_v = \frac{1}{3} \cdot ACH \cdot V \cdot \Delta T$)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>9-Step interactive material & glazing wizard</span>
                </li>
              </ul>

              <Button 
                onClick={() => navigate('/calculator/steady')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl h-12 shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2"
              >
                Launch Steady-State Calculator
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: Periodic Heat Flow */}
          <Card className="flex flex-col rounded-3xl border-2 border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-zinc-900 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all overflow-hidden group relative">
            <div className="h-3 bg-emerald-600 w-full" />
            <CardHeader className="p-8 pb-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs group-hover:scale-105 transition-transform">
                <Clock className="w-7 h-7" />
              </div>
              <Badge className="w-fit mb-2 text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                24-Hour Diurnal Cycle Simulation
              </Badge>
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                Periodic Heat Flow
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400 mt-2">
                Models the repetitive 24-hour day/night diurnal cycle. Evaluates material thermal diffusivity ($K$), structural time-lag ($\phi$), and thermal mass amplitude attenuation ($\mu$).
              </CardDescription>
            </CardHeader>

            <CardContent className="p-8 pt-2 flex-1 flex flex-col justify-between space-y-6">
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Time-lag ($\phi$): Hours delay before exterior heat reaches inside</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Decrement Factor ($\mu$): Thermal mass amplitude dampening</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Momentary Heat Flow: Qc(t) = Qa + A · U · μ · (Tsa,t-ϕ - Tsa,m)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>24-Hour hourly progression chart with real-time tuning sliders</span>
                </li>
              </ul>

              <Button 
                onClick={() => navigate('/calculator/periodic')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl h-12 shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2"
              >
                Launch Periodic Calculator
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* History link */}
        <div className="text-center pt-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/calculator/history')}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            Looking for previous simulations? View Saved Calculation History →
          </Button>
        </div>
      </main>
    </div>
  );
}
