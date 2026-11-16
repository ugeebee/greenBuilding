import { Routes, Route, Navigate } from 'react-router-dom';
import ModeSelector from './ModeSelector';
import Wizard from './Wizard';
import UValues from './UValues';
import Result from './Result';
import History from './History';
import PeriodicCalculator from './PeriodicCalculator';

export default function Calculator() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      <Routes>
        <Route path="/" element={<ModeSelector />} />
        <Route path="/steady" element={<Wizard />} />
        <Route path="/wizard" element={<Wizard />} />
        <Route path="/periodic" element={<PeriodicCalculator />} />
        <Route path="/uvalues" element={<UValues />} />
        <Route path="/result" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/calculator" replace />} />
      </Routes>
    </div>
  );
}
