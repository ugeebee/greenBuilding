import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, ArrowLeft, History as HistoryIcon } from 'lucide-react';

const API_BASE_URL = '/api';

export default function History() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          setError('Unauthorized. Please log in again.');
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        const data = await response.json();
        
        if (!data || data.length === 0) {
          setError('No calculations found in your history.');
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


  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Calculation History</h1>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </div>

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
              </CardHeader>
              
              {expandedIndex === index && (
                <CardContent className="pt-6 animate-in slide-in-from-top duration-300">
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-center border-collapse">
                      <thead className="bg-slate-900 text-white">
                        <tr>
                          <th className="px-3 py-3 text-left">Surface</th>
                          <th className="px-2 py-3">Area</th>
                          <th className="px-2 py-3">U-Val</th>
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
  );
}
