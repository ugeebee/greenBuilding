import { Routes, Route, Navigate } from 'react-router-dom';
import Wizard from './Wizard';
import UValues from './UValues';
import Result from './Result';
import History from './History';

export default function Calculator() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      <Routes>
        <Route path="/" element={<Wizard />} />
        <Route path="/uvalues" element={<UValues />} />
        <Route path="/result" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/calculator" replace />} />
      </Routes>
    </div>
  );
}
