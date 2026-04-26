import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Save, AlertTriangle, Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

export default function Result() {
  const [tableData, setTableData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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

      const tIn = demoData.temperatures.inside;
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

      walls.forEach(w => {
          const netArea = grossAreas[w as keyof typeof grossAreas] - openingsArea[w as keyof typeof openingsArea];
          const uData = uCalcData.find((item: any) => item.Wall === wallLabels[w]) || { U: 0, Rso: 0 };
          finalTable.push(createRow(wallLabels[w], netArea, uData.U, uData.Rso, w, 'wall'));
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
      const roofU = demoData.roofMaterial?.R > 0 ? (1 / demoData.roofMaterial.R) : 0;
      const roofRso = demoData.surfaceParams['Roof'] ? demoData.surfaceParams['Roof'].Rso : 0; 
      finalTable.push(createRow(`roof`, roofArea, roofU, roofRso, 'Roof', 'roof'));

      setTableData(finalTable);

      const outTemps = demoData.temperatures.outdoor;
      const tOutAvg = (outTemps.N + outTemps.S + outTemps.E + outTemps.W) / 4;
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

  const handleSave = async () => {
    if (!summary || tableData.length === 0) return;
    setSaving(true);
    
    const authToken = localStorage.getItem('token');
    
    const payload = {
      details: tableData,
      totals: summary
    };

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
        alert("Success! History saved.");
        navigate('/dashboard');
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
    <div className="container mx-auto p-6 max-w-7xl pt-12">
      <Card className="shadow-lg border-t-4 border-t-emerald-500">
        <CardHeader className="flex flex-row items-center justify-between pb-6">
          <CardTitle className="text-2xl">Final Heat Calculation Table</CardTitle>
          <Button onClick={handleSave} disabled={saving || !!error} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save to Server
          </Button>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm text-center">
                  <thead className="bg-emerald-600 text-white">
                    <tr>
                      <th className="px-3 py-3 font-medium text-left whitespace-nowrap">Surface</th>
                      <th className="px-3 py-3 font-medium">A (m²)</th>
                      <th className="px-3 py-3 font-medium">U (W/m²K)</th>
                      <th className="px-3 py-3 font-medium">qc (A×U)</th>
                      <th className="px-3 py-3 font-medium">Rso</th>
                      <th className="px-3 py-3 font-medium">G</th>
                      <th className="px-3 py-3 font-medium">α (alpha)</th>
                      <th className="px-3 py-3 font-medium">SGF</th>
                      <th className="px-3 py-3 font-medium">e</th>
                      <th className="px-3 py-3 font-medium">Qsoi</th>
                      <th className="px-3 py-3 font-medium">Qswi</th>
                      <th className="px-3 py-3 font-medium">ΔT</th>
                      <th className="px-3 py-3 font-bold">Qci</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tableData.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-left bg-muted/20 border-r">{row.Surface}</td>
                        <td className="px-3 py-2.5">{row.A}</td>
                        <td className="px-3 py-2.5">{row.U}</td>
                        <td className="px-3 py-2.5">{row.qc}</td>
                        <td className={`px-3 py-2.5 ${row.Rso === '-' ? 'text-muted-foreground bg-muted/10' : ''}`}>{row.Rso}</td>
                        <td className="px-3 py-2.5">{row.G}</td>
                        <td className="px-3 py-2.5">{row.alpha}</td>
                        <td className={`px-3 py-2.5 ${row.SGF === '-' ? 'text-muted-foreground bg-muted/10' : ''}`}>{row.SGF}</td>
                        <td className={`px-3 py-2.5 ${row.e === '-' ? 'text-muted-foreground bg-muted/10' : ''}`}>{row.e}</td>
                        <td className={`px-3 py-2.5 ${row.Qsoi === '-' ? 'text-muted-foreground bg-muted/10' : ''}`}>{row.Qsoi}</td>
                        <td className={`px-3 py-2.5 ${row.Qswi === '-' ? 'text-muted-foreground bg-muted/10' : ''}`}>{row.Qswi}</td>
                        <td className="px-3 py-2.5">{row.deltaT}</td>
                        <td className="px-3 py-2.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">{row.Qci}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                  <Card className="bg-muted/30">
                    <CardHeader className="py-4">
                      <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider text-center">Qc (Total Conduction)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 pb-6 text-center">
                      <span className="text-3xl font-bold text-emerald-600">{summary.Qc.toFixed(2)}</span> W
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardHeader className="py-4">
                      <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider text-center">Qso (Total Solar-Air)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 pb-6 text-center">
                      <span className="text-3xl font-bold text-emerald-600">{summary.Qso.toFixed(2)}</span> W
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardHeader className="py-4">
                      <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider text-center">Qsw (Total Solar Gain)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 pb-6 text-center">
                      <span className="text-3xl font-bold text-emerald-600">{summary.Qsw.toFixed(2)}</span> W
                    </CardContent>
                  </Card>
                  <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                    <CardHeader className="py-4">
                      <CardTitle className="text-xs uppercase text-indigo-600 dark:text-indigo-400 tracking-wider text-center">Qv (Ventilation Load)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 pb-6 text-center">
                      <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{summary.Qv.toFixed(2)}</span> W
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
