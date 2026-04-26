import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export default function UValues() {
  const [uCalculator, setUCalculator] = useState<any[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const demoOutputString = localStorage.getItem('demoOutput');
      
      if (!demoOutputString) {
        throw new Error("Missing Local Storage data. Please start from the first page.");
      }

      const demoOutput = JSON.parse(demoOutputString);
      const walls = ['N', 'E', 'S', 'W'];
      const wallMap: Record<string, string> = { N: 'Wall 1', E: 'Wall 2', S: 'Wall 3', W: 'Wall 4' };
      
      const calcData = walls.map(w => ({
        Wall: wallMap[w], 
        Rso: 0, 
        Rb: 0, 
        Rsi: 0.123, 
        Raa: 0,     
        U: 0
      }));

      const mat = demoOutput.wallMaterials;
      const Rb = (mat.outer?.R || 0) + (mat.central?.R || 0) + (mat.inner?.R || 0);

      calcData.forEach(row => {
        const wallKey = Object.keys(wallMap).find(key => wallMap[key] === row.Wall)!;
        const Rso = demoOutput.surfaceParams[wallKey]?.Rso || 0;

        row.Rso = Rso;
        row.Rb = parseFloat(Rb.toFixed(4));
        row.Raa = parseFloat((row.Rsi + row.Rb + row.Rso).toFixed(4));
        row.U = row.Raa > 0 ? parseFloat((1 / row.Raa).toFixed(4)) : 0;
      });

      localStorage.setItem('Ucalculator', JSON.stringify(calcData));
      setUCalculator(calcData);

    } catch (err: any) {
      console.error("Calculation Error:", err);
      setError("Error calculating intermediate results: " + err.message);
    }
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl pt-12">
      <Card className="border-t-4 border-t-indigo-500 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Wall U-Value Calculations</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto mt-4 rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="px-4 py-3 font-medium">Wall</th>
                    <th className="px-4 py-3 font-medium">Rso (Outside)</th>
                    <th className="px-4 py-3 font-medium">Rb (Body)</th>
                    <th className="px-4 py-3 font-medium">Rsi (Inside)</th>
                    <th className="px-4 py-3 font-medium text-indigo-100">Raa (Total R)</th>
                    <th className="px-4 py-3 font-bold text-white">Total U-Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {uCalculator.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-semibold">{row.Wall}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.Rso}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.Rb}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.Rsi}</td>
                      <td className="px-4 py-3 font-semibold">{row.Raa.toFixed(4)}</td>
                      <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{row.U.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button onClick={() => navigate('/calculator/result')} disabled={!!error} className="bg-indigo-600 hover:bg-indigo-700">
              Next: Final Heat Table <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
