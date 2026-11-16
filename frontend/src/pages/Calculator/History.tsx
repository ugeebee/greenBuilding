import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Loader2, ArrowLeft, History as HistoryIcon, Activity, Clock, ShieldCheck } from 'lucide-react';

const API_BASE_URL = '/api';

export default function History() {
  const [history, setHistory] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'calculations' | 'activities'>('calculations');
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
        const response = await fetch(`${API_BASE_URL}/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          setError('Unauthorized. Please log in again.');
          localStorage.removeItem('token');
          localStorage.removeItem('admin_token');
          navigate('/login');
          return;
        }

        const data = await response.json();
        
        if (!data || data.length === 0) {
          setError('No calculations found in your 30-day history.');
        } else {
          setHistory(data);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load history. Check server connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [navigate]);

  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE_URL}/user/activities`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleTabChange = (tab: 'calculations' | 'activities') => {
    setActiveTab(tab);
    if (tab === 'activities' && activities.length === 0) {
      fetchActivities();
    }
  };

  const handleReopenAnalysis = (act: any) => {
    try {
      let parsed = act.details;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      if (parsed && (parsed.analysis || parsed.rooms)) {
        const previewUrl = act.image_url || parsed.image_url || (act.image_hash ? `/api/uploads/blueprints/${act.image_hash}.png` : '');
        const ppm = parsed.analysis?.metadata?.pixels_per_meter?.toString() || '59.45';
        sessionStorage.setItem('gb_floorplan_analysis', JSON.stringify({
          result: parsed,
          previewUrl,
          ppm
        }));
        navigate('/floorplan/reader/results', {
          state: {
            result: parsed,
            previewUrl,
            ppm
          }
        });
      }
    } catch (err) {
      console.error("Failed to reopen floor plan analysis", err);
    }
  };

  const handleReopenStudio = (act: any) => {
    try {
      let parsed = act.details;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      if (parsed) {
        if (parsed.FloorPlan) {
          sessionStorage.setItem('gb_studio_restore_multi', JSON.stringify(parsed.FloorPlan));
        } else if (parsed.Room) {
          sessionStorage.setItem('gb_studio_restore_single', JSON.stringify(parsed.Room));
        }
        navigate('/floorplan/generator');
      }
    } catch (err) {
      console.error("Failed to reopen studio design", err);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">History & Activity Log</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Retained for 30 Days in Database
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b mb-6 pb-2">
        <Button
          variant={activeTab === 'calculations' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleTabChange('calculations')}
          className="text-xs font-semibold"
        >
          <HistoryIcon className="w-3.5 h-3.5 mr-1.5" />
          Saved Calculations ({history.length})
        </Button>
        <Button
          variant={activeTab === 'activities' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleTabChange('activities')}
          className="text-xs font-semibold"
        >
          <Activity className="w-3.5 h-3.5 mr-1.5" />
          Activity Trail ({activities.length > 0 ? activities.length : '30 Days'})
        </Button>
      </div>

      {activeTab === 'activities' ? (
        <div>
          {activitiesLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-card">
              <p>No activity logs recorded in the past 30 days.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-xl border bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {act.activity_type}
                      </Badge>
                      <span className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                        {act.action_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      {act.description}
                    </p>
                    {act.image_hash && (
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                        <div className="w-8 h-8 rounded border overflow-hidden bg-slate-100 shrink-0">
                          <img
                            src={act.image_url || `/api/uploads/blueprints/${act.image_hash}.png`}
                            alt="Blueprint"
                            className="w-full h-full object-cover"
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <div className="text-[11px]">
                          <span className="font-semibold text-slate-700 dark:text-zinc-300 block">{act.image_name || "Blueprint Plan"}</span>
                          <span className="font-mono text-[9px] text-slate-400">SHA-256: {act.image_hash.slice(0, 16)}...</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <a
                            href={act.image_url || `/api/uploads/blueprints/${act.image_hash}.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-indigo-600 hover:underline font-medium"
                          >
                            View Image
                          </a>
                          {act.activity_type === 'FLOORPLAN_ANALYZED' && act.details && (
                            <button
                              onClick={() => handleReopenAnalysis(act)}
                              className="text-[11px] bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 hover:bg-sky-100 font-semibold transition-colors cursor-pointer"
                            >
                              Open in Reader
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {act.activity_type === 'FLOORPLAN_VALIDATED' && act.details && (
                      <div className="pt-1.5 flex items-center">
                        <button
                          onClick={() => handleReopenStudio(act)}
                          className="text-[11px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-semibold transition-colors cursor-pointer"
                        >
                          Open in Studio
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center sm:justify-end gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(act.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {act.ip_address && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        IP: {act.ip_address}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error && history.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-card">
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((item, index) => (
                <Card key={index} className={`overflow-hidden transition-all duration-300 border-l-4 ${expandedIndex === index ? 'border-l-indigo-500 shadow-xl' : 'border-l-slate-200 shadow-sm hover:shadow-md'}`}>
                  <CardHeader className="bg-slate-50/50 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-900 mb-1">Calculation History Item</CardTitle>
                        <p className="text-sm font-medium text-slate-500">
                          {new Date(item.timestamp).toLocaleString('en-IN', { 
                            day: '2-digit', month: 'short', year: 'numeric', 
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                            hour12: true 
                          })}
                        </p>
                      </div>
                      <Button 
                        variant={expandedIndex === index ? "default" : "outline"}
                        onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                        className={expandedIndex === index ? "bg-indigo-600" : "text-indigo-600 border-indigo-200"}
                      >
                        {expandedIndex === index ? 'Close Table' : 'View Full Table'}
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Total Qc</div>
                        <div className="text-lg font-black text-indigo-600">{(item.data.totals?.Qc || 0).toFixed(2)}W</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Total Qso</div>
                        <div className="text-lg font-black text-emerald-600">{(item.data.totals?.Qso || 0).toFixed(2)}W</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Total Qsw</div>
                        <div className="text-lg font-black text-amber-600">{(item.data.totals?.Qsw || 0).toFixed(2)}W</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Total Qv</div>
                        <div className="text-lg font-black text-rose-600">{(item.data.totals?.Qv || 0).toFixed(2)}W</div>
                      </div>
                    </div>

                    {item.data.periodic_totals && (
                      <div className="mt-4 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Periodic Diurnal Thermal Inertia Analysis
                          </span>
                          <Badge className="text-[10px] bg-emerald-600 text-white font-bold">
                            -{item.data.periodic_totals.damping_pct}% Mass Damping
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-indigo-50 dark:border-indigo-900/30">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase">Daily Mean Qa</span>
                            <span className="font-black text-slate-800 dark:text-zinc-200">{(item.data.periodic_totals.daily_avg_heat || 0).toFixed(1)}W</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-indigo-50 dark:border-indigo-900/30">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase">Peak Delayed Qc</span>
                            <span className="font-black text-indigo-600">{(item.data.periodic_totals.peak_heat || 0).toFixed(1)}W</span>
                            <span className="text-[9px] text-slate-400 block">(@{item.data.periodic_totals.peak_hour}h)</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-indigo-50 dark:border-indigo-900/30">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase">Daily Total Energy</span>
                            <span className="font-black text-emerald-600">{(item.data.periodic_totals.daily_energy_kwh || 0).toFixed(1)} kWh/d</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {item.image_hash && (
                      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                        <div className="w-10 h-10 rounded border overflow-hidden bg-slate-100 shrink-0">
                          <img
                            src={item.image_url || `/api/uploads/blueprints/${item.image_hash}.png`}
                            alt="Blueprint"
                            className="w-full h-full object-cover"
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800 block">{item.image_name || "Floor Plan Blueprint"}</span>
                          <span className="font-mono text-[10px] text-slate-400">SHA-256: {item.image_hash.slice(0, 20)}...</span>
                        </div>
                        <a
                          href={item.image_url || `/api/uploads/blueprints/${item.image_hash}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-600 hover:underline ml-auto font-medium"
                        >
                          View Blueprint
                        </a>
                      </div>
                    )}
                  </CardHeader>

                  {expandedIndex === index && (
                    <CardContent className="p-6">
                      <div className="rounded-xl border border-slate-100 overflow-x-auto shadow-sm">
                        <table className="w-full text-xs text-center border-collapse">
                          <thead className="bg-indigo-600 text-white uppercase text-[10px] tracking-wider font-semibold">
                            <tr>
                              <th className="px-3 py-3 text-left">Surface</th>
                              <th className="px-2 py-3">A (m²)</th>
                              <th className="px-2 py-3">U</th>
                              <th className="px-2 py-3">qc</th>
                              <th className="px-2 py-3">Rso</th>
                              <th className="px-2 py-3">G</th>
                              <th className="px-2 py-3">α</th>
                              <th className="px-2 py-3">SGF</th>
                              <th className="px-2 py-3">Qsoi</th>
                              <th className="px-2 py-3">Qswi</th>
                              <th className="px-2 py-3">ΔT</th>
                              <th className="px-3 py-3 font-bold bg-indigo-700">Qci</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(item.data.details || []).map((row: any, ri: number) => (
                              <tr key={ri} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2.5 font-bold text-left bg-slate-50/50 border-r">{row.Surface}</td>
                                <td className="px-2 py-2.5">{row.A}</td>
                                <td className="px-2 py-2.5">{row.U}</td>
                                <td className="px-2 py-2.5">{row.qc}</td>
                                <td className="px-2 py-2.5 text-slate-400">{row.Rso}</td>
                                <td className="px-2 py-2.5">{row.G}</td>
                                <td className="px-2 py-2.5">{row.alpha}</td>
                                <td className="px-2 py-2.5 text-slate-400">{row.SGF}</td>
                                <td className="px-2 py-2.5 text-emerald-600 font-medium">{row.Qsoi}</td>
                                <td className="px-2 py-2.5 text-amber-600 font-medium">{row.Qswi}</td>
                                <td className="px-2 py-2.5">{row.deltaT}</td>
                                <td className="px-3 py-2.5 font-black text-indigo-600 bg-indigo-50/30">{row.Qci}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
