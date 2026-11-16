import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  Activity, 
  LayoutDashboard, 
  LogOut, 
  Search, 
  Clock, 
  ChevronRight, 
  FileText, 
  Loader2, 
  ArrowLeft,
  ShieldCheck,
  Filter,
  Table as TableIcon,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  Sparkles,
  Download,
  X
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { calculatePeriodicHeatFlow } from '../lib/periodicHeat';

interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number';
  unit?: string;
  step?: string;
  placeholder?: string;
  options?: string[];
}

const TABLE_SCHEMAS: Record<string, { title: string; subtitle: string; columns: ColumnDef[] }> = {
  sheet1: {
    title: "Table 1: Material Thermal Properties",
    subtitle: "Raw material density, thermal conductivity, and specific heat capacity (calculates Thermal Diffusivity K)",
    columns: [
      { key: "Material", label: "Material Name", type: "text", placeholder: "e.g. Brickwork (dense red)" },
      { key: "Density  ", label: "Density", type: "number", unit: "kg/m³", step: "1" },
      { key: "Thermal Conductivity  ", label: "Conductivity (k)", type: "number", unit: "W/m·°C", step: "0.001" },
      { key: "Specific Heat Capacity  ", label: "Specific Heat (c)", type: "number", unit: "J/kg·°C", step: "1" },
    ]
  },
  sheet2: {
    title: "Table 2: Surface Resistances & Conductances",
    subtitle: "Interior and exterior surface heat transfer coefficients and boundary resistances",
    columns: [
      { key: "Surface", label: "Surface / Exposure", type: "text", placeholder: "e.g. Walls (Internal)" },
      { key: "Conductance ", label: "Conductance (h)", type: "number", unit: "W/m²°C", step: "0.01" },
      { key: "Resistance ", label: "Resistance (R)", type: "number", unit: "m²°C/W", step: "0.001" },
    ]
  },
  sheet3: {
    title: "Table 3: Construction Assemblies & U-Values",
    subtitle: "Overall thermal transmittance coefficients (U-Values) for standard envelope construction types",
    columns: [
      { key: "Category", label: "Category", type: "text", options: ["Walls", "Roofs", "Floors", "Ceilings", "Partitions"] },
      { key: "Type of Construction", label: "Type of Construction", type: "text", placeholder: "e.g. Solid brick plastered 114 mm" },
      { key: "U-Value ", label: "U-Value", type: "number", unit: "W/m²°C", step: "0.01" },
    ]
  },
  sheet4: {
    title: "Table 4: Window Glazing & Exposure",
    subtitle: "Glazing heat transfer coefficients and solar performance across directional exposures",
    columns: [
      { key: "Exposure Condition", label: "Exposure Condition", type: "text", placeholder: "e.g. Exposure south, severe" },
      { key: "Glazing Type", label: "Glazing Type", type: "text", placeholder: "e.g. double glazing, 6 mm space" },
      { key: "U-Value ", label: "U-Value", type: "number", unit: "W/m²°C", step: "0.01" },
    ]
  },
  periodic: {
    title: "Table 5: Periodic Heat Flow & Thermal Inertia",
    subtitle: "Dynamic thermal properties: thickness (mm), Time-lag ϕ (hours), and Decrement factor μ (amplitude damping)",
    columns: [
      { key: "Category", label: "Category", type: "text", options: ["Walls", "Roofs", "Floors"] },
      { key: "Construction", label: "Construction Assembly", type: "text", placeholder: "e.g. Solid brickwork 230 mm" },
      { key: "Thickness_mm", label: "Thickness", type: "number", unit: "mm", step: "1" },
      { key: "TimeLag_hours", label: "Time-Lag (ϕ)", type: "number", unit: "hours", step: "0.1" },
      { key: "DecrementFactor", label: "Decrement Factor (μ)", type: "number", unit: "0.0 - 1.0", step: "0.01" },
      { key: "U_Value", label: "U-Value", type: "number", unit: "W/m²°C", step: "0.01" },
      { key: "Description", label: "Description / Notes", type: "text", placeholder: "Optional structural / thermal details" },
    ]
  }
};

export default function AdminDashboard() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);
  const [userHistory, setUserHistory] = React.useState<any[]>([]);
  const [userActivities, setUserActivities] = React.useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [userDetailTab, setUserDetailTab] = React.useState<'calculations' | 'activities'>('calculations');
  
  // System views: users | logs | tables
  const [mainView, setMainView] = React.useState<'users' | 'logs' | 'tables'>('users');
  const [allActivities, setAllActivities] = React.useState<any[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<string>('ALL');

  // Value Tables State
  const [tablesMeta, setTablesMeta] = React.useState<any[]>([]);
  const [selectedTableKey, setSelectedTableKey] = React.useState<string>('sheet1');
  const [activeTableData, setActiveTableData] = React.useState<any[]>([]);
  const [tablesLoading, setTablesLoading] = React.useState(false);
  const [tableSaving, setTableSaving] = React.useState(false);
  const [tableSaveMessage, setTableSaveMessage] = React.useState<string | null>(null);
  const [tableError, setTableError] = React.useState<string | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = React.useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Edit / Add Row Modal State
  const [rowModalOpen, setRowModalOpen] = React.useState(false);
  const [isAddingNew, setIsAddingNew] = React.useState(false);
  const [editingRowIndex, setEditingRowIndex] = React.useState<number | null>(null);
  const [editFormData, setEditFormData] = React.useState<Record<string, any>>({});

  // Simulation Preview State
  const [simModalOpen, setSimModalOpen] = React.useState(false);
  const [simLoading, setSimLoading] = React.useState(false);
  const [simResult, setSimResult] = React.useState<any | null>(null);

  const navigate = useNavigate();

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else if (response.status === 401) {
        navigate('/admin');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllActivities = async () => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/activities?limit=300', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllActivities(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchUserHistory = async (username: string) => {
    setHistoryLoading(true);
    setSelectedUser(username);
    setUserDetailTab('calculations');
    try {
      const token = localStorage.getItem('admin_token');
      const [histRes, actRes] = await Promise.all([
        fetch(`/api/admin/user-history?username=${username}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/admin/activities?username=${username}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (histRes.ok) {
        const data = await histRes.json();
        setUserHistory(data || []);
      }
      if (actRes.ok) {
        const actData = await actRes.json();
        setUserActivities(actData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Tables Manager API Methods
  const fetchTablesMeta = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/tables', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTablesMeta(data || []);
      }
    } catch (err) {
      console.error("Error fetching tables meta:", err);
    }
  };

  const fetchTableData = async (tableKey: string) => {
    setTablesLoading(true);
    setTableError(null);
    setTableSaveMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/tables/data?key=${tableKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setActiveTableData(result.data || []);
        setSelectedTableKey(tableKey);
        setHasUnsavedChanges(false);
      } else {
        setTableError("Failed to load table data");
      }
    } catch (err: any) {
      setTableError(err.message || "Network error loading table");
    } finally {
      setTablesLoading(false);
    }
  };

  const handleSelectTable = (key: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes in the current table. Switching will discard them. Continue?")) {
        return;
      }
    }
    setTableSearchQuery('');
    fetchTableData(key);
  };

  const handleOpenAddRow = () => {
    const schema = TABLE_SCHEMAS[selectedTableKey];
    if (!schema) return;
    const initial: Record<string, any> = {};
    schema.columns.forEach(col => {
      initial[col.key] = col.type === 'number' ? (col.step && col.step.includes('.') ? 0.0 : 0) : (col.options ? col.options[0] : '');
    });
    setEditFormData(initial);
    setIsAddingNew(true);
    setEditingRowIndex(null);
    setRowModalOpen(true);
  };

  const handleOpenEditRow = (index: number) => {
    const row = activeTableData[index];
    if (!row) return;
    setEditFormData({ ...row });
    setIsAddingNew(false);
    setEditingRowIndex(index);
    setRowModalOpen(true);
  };

  const handleSaveRow = () => {
    const schema = TABLE_SCHEMAS[selectedTableKey];
    if (!schema) return;

    // Type coercion
    const normalizedRow: Record<string, any> = { ...editFormData };
    schema.columns.forEach(col => {
      if (col.type === 'number') {
        normalizedRow[col.key] = parseFloat(normalizedRow[col.key]) || 0;
      }
    });

    let updatedList: any[] = [];
    if (isAddingNew) {
      updatedList = [normalizedRow, ...activeTableData];
    } else if (editingRowIndex !== null) {
      updatedList = [...activeTableData];
      updatedList[editingRowIndex] = normalizedRow;
    }

    setActiveTableData(updatedList);
    setHasUnsavedChanges(true);
    setRowModalOpen(false);
  };

  const handleDeleteRow = (index: number) => {
    if (!window.confirm("Are you sure you want to delete this row?")) return;
    const updated = activeTableData.filter((_, i) => i !== index);
    setActiveTableData(updated);
    setHasUnsavedChanges(true);
  };

  const handleSaveTableChanges = async () => {
    setTableSaving(true);
    setTableError(null);
    setTableSaveMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/tables/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          table_key: selectedTableKey,
          data: activeTableData
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTableSaveMessage(data.message || "Table saved successfully!");
        setHasUnsavedChanges(false);
        fetchTablesMeta();
        setTimeout(() => setTableSaveMessage(null), 4000);
      } else {
        setTableError(data.error || data.message || "Failed to save table");
      }
    } catch (err: any) {
      setTableError(err.message || "Network error while saving");
    } finally {
      setTableSaving(false);
    }
  };

  const handleResetTable = async () => {
    if (!window.confirm(`Are you sure you want to restore ${TABLE_SCHEMAS[selectedTableKey]?.title || 'this table'} to original system defaults? Any customizations will be replaced.`)) {
      return;
    }

    setTablesLoading(true);
    setTableError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/tables/reset?key=${selectedTableKey}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Table restored to factory defaults successfully!");
        fetchTableData(selectedTableKey);
        fetchTablesMeta();
      } else {
        const data = await res.json();
        setTableError(data.error || "Failed to reset table");
      }
    } catch (err: any) {
      setTableError(err.message || "Error resetting table");
    } finally {
      setTablesLoading(false);
    }
  };

  const handleRunPeriodicSimulation = () => {
    setSimLoading(true);
    setSimModalOpen(true);
    try {
      // Pick elements from current periodic table data
      const wallElements = activeTableData.filter(x => x.Category === 'Walls');
      const roofElements = activeTableData.filter(x => x.Category === 'Roofs');

      const defaultWall = wallElements[0] || {
        Construction: "Standard Brickwork 230 mm",
        U_Value: 2.30,
        TimeLag_hours: 6.2,
        DecrementFactor: 0.38
      };
      const defaultRoof = roofElements[0] || {
        Construction: "Standard RCC Roof 150 mm",
        U_Value: 2.70,
        TimeLag_hours: 4.5,
        DecrementFactor: 0.62
      };

      const elements = [
        {
          name: "North Wall - " + defaultWall.Construction,
          orientation: "N",
          area: 18.0,
          uValue: defaultWall.U_Value,
          timeLag: defaultWall.TimeLag_hours,
          decrementFactor: defaultWall.DecrementFactor
        },
        {
          name: "South Wall - " + defaultWall.Construction,
          orientation: "S",
          area: 18.0,
          uValue: defaultWall.U_Value,
          timeLag: defaultWall.TimeLag_hours,
          decrementFactor: defaultWall.DecrementFactor
        },
        {
          name: "East Wall - " + defaultWall.Construction,
          orientation: "E",
          area: 15.0,
          uValue: defaultWall.U_Value,
          timeLag: defaultWall.TimeLag_hours,
          decrementFactor: defaultWall.DecrementFactor
        },
        {
          name: "West Wall - " + defaultWall.Construction,
          orientation: "W",
          area: 15.0,
          uValue: defaultWall.U_Value,
          timeLag: defaultWall.TimeLag_hours,
          decrementFactor: defaultWall.DecrementFactor
        },
        {
          name: "Roof - " + defaultRoof.Construction,
          orientation: "Roof",
          area: 30.0,
          uValue: defaultRoof.U_Value,
          timeLag: defaultRoof.TimeLag_hours,
          decrementFactor: defaultRoof.DecrementFactor
        }
      ];

      // Pure client-side periodic simulation calculation
      const data = calculatePeriodicHeatFlow(24.0, elements);
      setSimResult({
        indoor_temp: data.indoorTemp,
        daily_avg_envelope_heat: data.dailyAvgEnvelopeHeat,
        peak_envelope_heat: data.peakEnvelopeHeat,
        peak_envelope_hour: data.peakEnvelopeHour,
        peak_steady_envelope: data.peakSteadyEnvelope,
        envelope_damping_pct: data.envelopeDampingPct,
        daily_energy_kwh: data.dailyEnergyKWh,
        hourly_summary: data.hourlySummary.map(h => ({
          hour: h.hour,
          total_periodic: h.totalPeriodic,
          total_steady: h.totalSteady
        })),
        elements: data.elements.map(e => ({
          name: e.name,
          area: e.area,
          u_value: e.uValue,
          time_lag: e.timeLag,
          decrement_factor: e.decrementFactor,
          peak_heat_flow: e.peakHeatFlow,
          peak_hour: e.peakHour,
          load_reduction_pct: e.loadReductionPct
        }))
      });
    } catch (err: any) {
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleExportTableJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeTableData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${selectedTableKey}_export.json`);
    dlAnchorElem.click();
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

  // Filtering
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredActivities = allActivities.filter(a => {
    const matchesSearch = 
      a.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.activity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.action_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedTypeFilter === 'ALL' || a.activity_type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredTableRows = activeTableData.filter(row => {
    if (!tableSearchQuery) return true;
    const q = tableSearchQuery.toLowerCase();
    return Object.values(row).some(val => String(val).toLowerCase().includes(q));
  });

  // Calculate Diffusivity for Table 1 preview
  const getDiffusivity = (row: any) => {
    const k = parseFloat(row['Thermal Conductivity  '] || 0);
    const d = parseFloat(row['Density  '] || 0);
    const c = parseFloat(row['Specific Heat Capacity  '] || 0);
    if (d > 0 && c > 0) {
      const K = k / (d * c);
      return (K * 1e7).toFixed(2) + ' × 10⁻⁷';
    }
    return '—';
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-zinc-100 flex flex-col hidden md:flex border-r border-zinc-800">
        <div className="h-16 flex items-center px-6 border-b border-zinc-800 bg-zinc-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center mr-3 shadow-lg shadow-emerald-500/20">
            <ShieldIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-black tracking-tight text-white uppercase text-sm block">GB Admin</span>
            <span className="text-[10px] text-zinc-400 block font-semibold">Engineering Suite</span>
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-8 overflow-y-auto">
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 px-2">Navigation</p>
            <ul className="space-y-1">
              <li>
                <button 
                  onClick={() => { setSelectedUser(null); setMainView('users'); }} 
                  className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all ${
                    mainView === 'users' && !selectedUser 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 mr-3" />
                  <span className="font-semibold text-sm">User Directory</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setSelectedUser(null); 
                    setMainView('tables'); 
                    if (tablesMeta.length === 0) fetchTablesMeta();
                    if (activeTableData.length === 0) fetchTableData('sheet1');
                  }} 
                  className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all ${
                    mainView === 'tables' && !selectedUser 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <TableIcon className="w-4 h-4 mr-3" />
                  <div className="text-left">
                    <span className="font-semibold text-sm block">Value Tables Manager</span>
                    <span className="text-[10px] text-emerald-400 font-bold block">Tables 1-4 & Periodic</span>
                  </div>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setSelectedUser(null); 
                    setMainView('logs'); 
                    if (allActivities.length === 0) fetchAllActivities(); 
                  }} 
                  className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all ${
                    mainView === 'logs' && !selectedUser 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Activity className="w-4 h-4 mr-3" />
                  <span className="font-semibold text-sm">Activity Logs (30d)</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <Button variant="ghost" className="w-full text-zinc-400 hover:text-white hover:bg-red-500/10 hover:text-red-500" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            {selectedUser && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">
                {selectedUser 
                  ? `User Record: ${selectedUser}` 
                  : mainView === 'tables'
                  ? 'Engineering Value Tables & Periodic Database'
                  : mainView === 'logs' 
                  ? 'System-Wide Activity Logs' 
                  : 'User Management Directory'}
              </h2>
              <span className="text-[11px] text-zinc-500 font-medium">
                {mainView === 'tables' 
                  ? 'Real-time database editor for materials, assemblies, U-values & periodic parameters' 
                  : 'All records stored in database with 30-day retention'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            {!selectedUser && mainView !== 'tables' && (
              <div className="relative hidden lg:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input 
                  type="text" 
                  placeholder={mainView === 'logs' ? 'Search activities or users...' : 'Search accounts...'} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-72 bg-zinc-100 dark:bg-zinc-800 border-none h-10 rounded-full text-sm focus-visible:ring-emerald-500"
                />
              </div>
            )}
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Admin Certified
              </Badge>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 overflow-y-auto p-8">
          {selectedUser ? (
            /* Individual User History & Activity Detail */
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-100 dark:border-zinc-800 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{selectedUser}'s History & Audit Trail</h3>
                    <p className="text-sm text-zinc-400 font-medium">Reviewing calculations and user activities from the last 30 days.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={userDetailTab === 'calculations' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserDetailTab('calculations')}
                    className="font-bold text-xs"
                  >
                    Calculations ({userHistory.length})
                  </Button>
                  <Button
                    variant={userDetailTab === 'activities' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserDetailTab('activities')}
                    className="font-bold text-xs"
                  >
                    Activity Trail ({userActivities.length})
                  </Button>
                </div>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                </div>
              ) : userDetailTab === 'calculations' ? (
                userHistory.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-400 font-bold">This user has no saved calculations in the past 30 days.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {userHistory.map((item, idx) => (
                      <Card key={idx} className="border-none shadow-md overflow-hidden group">
                        <CardHeader className="bg-zinc-900 text-white p-4">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              {new Date(item.timestamp).toLocaleString()}
                            </CardTitle>
                            <span className="text-[10px] font-bold text-zinc-500">ID: {item.id}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="grid grid-cols-4 divide-x divide-zinc-100 dark:divide-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                            <div className="p-3 text-center">
                              <p className="text-[10px] font-black text-zinc-400 uppercase">Qc</p>
                              <p className="text-sm font-black text-indigo-600">{(item.data?.totals?.Qc || 0).toFixed(1)}W</p>
                            </div>
                            <div className="p-3 text-center">
                              <p className="text-[10px] font-black text-zinc-400 uppercase">Qso</p>
                              <p className="text-sm font-black text-emerald-600">{(item.data?.totals?.Qso || 0).toFixed(1)}W</p>
                            </div>
                            <div className="p-3 text-center">
                              <p className="text-[10px] font-black text-zinc-400 uppercase">Qsw</p>
                              <p className="text-sm font-black text-amber-600">{(item.data?.totals?.Qsw || 0).toFixed(1)}W</p>
                            </div>
                            <div className="p-3 text-center">
                              <p className="text-[10px] font-black text-zinc-400 uppercase">Qv</p>
                              <p className="text-sm font-black text-rose-600">{(item.data?.totals?.Qv || 0).toFixed(1)}W</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                /* Activity Trail View */
                <div className="space-y-4">
                  {userActivities.map((act) => (
                    <div key={act.id} className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm block">{act.action_name}</span>
                        <span className="text-xs text-zinc-400">{act.description}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{new Date(act.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : mainView === 'tables' ? (
            /* ========================================================================= */
            /* VALUE TABLES & PERIODIC DATABASE EDITOR VIEW */
            /* ========================================================================= */
            <div className="space-y-6">
              {/* Header Status & Save Alerts */}
              {tableSaveMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-sm">{tableSaveMessage}</span>
                </div>
              )}
              {tableError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-600 dark:text-rose-400 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-sm">{tableError}</span>
                </div>
              )}

              {/* Table Selector Tabs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { key: 'sheet1', label: 'Table 1: Materials', icon: Layers, badge: 'k, d, c → K' },
                  { key: 'sheet2', label: 'Table 2: Surfaces', icon: Flame, badge: 'Rso, Rsi' },
                  { key: 'sheet3', label: 'Table 3: Assemblies', icon: LayoutDashboard, badge: 'U-Values' },
                  { key: 'sheet4', label: 'Table 4: Glazing', icon: FileText, badge: 'Windows' },
                  { key: 'periodic', label: 'Periodic Table', icon: Clock, badge: 'ϕ & μ Inertia' },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = selectedTableKey === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleSelectTable(tab.key)}
                      className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-zinc-900 text-white dark:bg-emerald-600 border-zinc-900 dark:border-emerald-500 shadow-lg' 
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-400 dark:text-white' : 'text-zinc-400'}`} />
                        <Badge className={`text-[9px] font-black ${isSelected ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                          {tab.badge}
                        </Badge>
                      </div>
                      <span className="font-black text-xs block leading-tight">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action Toolbar */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input 
                      placeholder="Search across this table..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className="pl-9 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-xs border-zinc-200 dark:border-zinc-700"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTableKey === 'periodic' && (
                    <Button 
                      onClick={handleRunPeriodicSimulation}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Test Periodic Simulation
                    </Button>
                  )}

                  <Button 
                    onClick={handleOpenAddRow}
                    variant="outline"
                    className="text-xs font-bold rounded-xl border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                    Add Row
                  </Button>

                  <Button 
                    onClick={handleExportTableJSON}
                    variant="outline"
                    className="text-xs font-bold rounded-xl border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    JSON
                  </Button>

                  <Button 
                    onClick={handleResetTable}
                    variant="ghost"
                    className="text-xs font-semibold text-zinc-500 hover:text-rose-500 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Defaults
                  </Button>

                  <Button 
                    onClick={handleSaveTableChanges}
                    disabled={tableSaving || !hasUnsavedChanges}
                    className={`text-xs font-black rounded-xl px-5 transition-all shadow-md flex items-center gap-2 ${
                      hasUnsavedChanges 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 animate-pulse' 
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    {tableSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {hasUnsavedChanges ? 'Save Changes *' : 'Saved'}
                  </Button>
                </div>
              </div>

              {/* Table Data Card */}
              <Card className="border-none shadow-md overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl">
                <CardHeader className="bg-zinc-50/70 dark:bg-zinc-800/40 p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>{TABLE_SCHEMAS[selectedTableKey]?.title}</span>
                      <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/20 text-emerald-600">
                        {filteredTableRows.length} Records
                      </Badge>
                      {hasUnsavedChanges && (
                        <Badge className="bg-amber-500 text-white text-[9px] font-bold">Unsaved Edits</Badge>
                      )}
                    </CardTitle>
                    <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                      {TABLE_SCHEMAS[selectedTableKey]?.subtitle}
                    </p>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                  {tablesLoading ? (
                    <div className="flex justify-center py-24">
                      <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                    </div>
                  ) : filteredTableRows.length === 0 ? (
                    <div className="text-center py-20 text-zinc-400">
                      <p className="font-semibold text-sm">No records found matching your search.</p>
                      <Button variant="link" onClick={() => setTableSearchQuery('')} className="text-emerald-500 text-xs">
                        Clear filter
                      </Button>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur z-10 border-b border-zinc-200 dark:border-zinc-700">
                        <tr className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                          <th className="px-5 py-3 w-12 text-center">#</th>
                          {TABLE_SCHEMAS[selectedTableKey]?.columns.map((col) => (
                            <th key={col.key} className="px-5 py-3 font-black">
                              {col.label} {col.unit && <span className="text-[9px] text-zinc-400 lowercase">({col.unit})</span>}
                            </th>
                          ))}
                          {selectedTableKey === 'sheet1' && (
                            <th className="px-5 py-3 font-black text-emerald-600 dark:text-emerald-400">
                              Diffusivity K <span className="text-[9px] lowercase">(m²/s)</span>
                            </th>
                          )}
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredTableRows.map((row, index) => {
                          const originalIndex = activeTableData.indexOf(row);
                          return (
                            <tr key={index} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group">
                              <td className="px-5 py-3.5 text-center text-zinc-400 font-mono text-[10px]">
                                {index + 1}
                              </td>

                              {TABLE_SCHEMAS[selectedTableKey]?.columns.map((col) => {
                                const val = row[col.key];
                                return (
                                  <td key={col.key} className="px-5 py-3.5">
                                    {col.key === 'Category' ? (
                                      <Badge className={`text-[10px] font-bold ${
                                        val === 'Walls' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' :
                                        val === 'Roofs' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                                        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      }`}>
                                        {val}
                                      </Badge>
                                    ) : col.type === 'number' ? (
                                      <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                                        {typeof val === 'number' ? val : parseFloat(val) || 0}
                                      </span>
                                    ) : (
                                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {val || '—'}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}

                              {selectedTableKey === 'sheet1' && (
                                <td className="px-5 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {getDiffusivity(row)}
                                </td>
                              )}

                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenEditRow(originalIndex)}
                                    className="h-7 w-7 p-0 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                    title="Edit Row"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteRow(originalIndex)}
                                    className="h-7 w-7 p-0 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                                    title="Delete Row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            </div>
          ) : mainView === 'logs' ? (
            /* System-Wide Activity Logs View */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-black">All User Activities (Last 30 Days)</h3>
                  <p className="text-sm text-zinc-400 font-medium">Live audit trail tracking all actions performed across the entire system.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-4 h-4 text-zinc-400" />
                  <select
                    value={selectedTypeFilter}
                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                    className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 font-semibold cursor-pointer"
                  >
                    <option value="ALL">All Activity Types</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="LOGOUT">LOGOUT</option>
                    <option value="SIGNUP">SIGNUP</option>
                    <option value="TABLE_UPDATE">TABLE_UPDATE</option>
                    <option value="TABLE_RESET">TABLE_RESET</option>
                    <option value="CALCULATION_SAVED">CALCULATION_SAVED</option>
                    <option value="FLOORPLAN_ANALYZED">FLOORPLAN_ANALYZED</option>
                    <option value="FLOORPLAN_VALIDATED">FLOORPLAN_VALIDATED</option>
                    <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={fetchAllActivities} className="text-xs">
                    Refresh Logs
                  </Button>
                </div>
              </div>

              {logsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-zinc-400 font-bold">No activity matching your search criteria found in the past 30 days.</p>
                </div>
              ) : (
                <Card className="border-none shadow-md overflow-hidden bg-white dark:bg-zinc-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Activity Type</th>
                          <th className="px-6 py-4">Description</th>
                          <th className="px-6 py-4">IP Address</th>
                          <th className="px-6 py-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                        {filteredActivities.map((act) => (
                          <tr key={act.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              @{act.username}
                            </td>
                            <td className="px-6 py-3.5">
                              <Badge className={`text-[10px] font-bold ${
                                act.activity_type.includes('TABLE') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                act.activity_type.includes('LOGIN') ? 'bg-emerald-100 text-emerald-800' :
                                act.activity_type.includes('CALCULATION') ? 'bg-indigo-100 text-indigo-800' :
                                act.activity_type.includes('FLOORPLAN') ? 'bg-sky-100 text-sky-800' :
                                'bg-zinc-100 text-zinc-800'
                              }`}>
                                {act.activity_type}
                              </Badge>
                            </td>
                            <td className="px-6 py-3.5 text-zinc-600 dark:text-zinc-300">
                              <span className="font-semibold block">{act.action_name}</span>
                              <span className="text-[11px] text-zinc-400">{act.description}</span>
                            </td>
                            <td className="px-6 py-3.5 font-mono text-[11px] text-zinc-400">
                              {act.ip_address || '—'}
                            </td>
                            <td className="px-6 py-3.5 text-right font-medium text-zinc-500">
                              {new Date(act.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            /* User Directory View */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">Registered User Accounts</h3>
                  <p className="text-sm text-zinc-400 font-medium">Select any user to inspect their 30-day calculations and activity trail.</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 px-3 py-1 font-bold">
                  {users.length} Active Accounts
                </Badge>
              </div>

              <Card className="border-none shadow-md overflow-hidden bg-white dark:bg-zinc-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Contact</th>
                        <th className="px-6 py-4">Joined</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center text-zinc-500 font-medium">
                            No users found matching your search.
                          </td>
                        </tr>
                      ) : filteredUsers.map((user, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                {user.username.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-white">{user.full_name || 'No Name'}</p>
                                <p className="text-xs font-semibold text-zinc-400 italic">@{user.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{user.email || 'No Email'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-xs font-semibold">{new Date(user.created_at).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => fetchUserHistory(user.username)}
                              className="rounded-full font-bold text-[11px] uppercase border-zinc-200 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                            >
                              View History & Trail
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* ROW EDIT / ADD MODAL */}
      {/* ========================================================================= */}
      {rowModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h4 className="font-black text-base text-zinc-900 dark:text-white">
                  {isAddingNew ? "Add New Table Record" : "Edit Table Record"}
                </h4>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {TABLE_SCHEMAS[selectedTableKey]?.title}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setRowModalOpen(false)} className="rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
              {TABLE_SCHEMAS[selectedTableKey]?.columns.map((col) => (
                <div key={col.key} className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>{col.label}</span>
                    {col.unit && <span className="text-[10px] text-zinc-400 font-normal">({col.unit})</span>}
                  </label>
                  {col.options ? (
                    <select
                      value={editFormData[col.key] || col.options[0]}
                      onChange={(e) => setEditFormData({ ...editFormData, [col.key]: e.target.value })}
                      className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-semibold text-zinc-900 dark:text-white"
                    >
                      {col.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={col.type}
                      step={col.step || 'any'}
                      placeholder={col.placeholder || ''}
                      value={editFormData[col.key] ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, [col.key]: e.target.value })}
                      className="text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setRowModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveRow} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl px-4">
                {isAddingNew ? "Add Row" : "Apply Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERIODIC HEAT SIMULATION TEST MODAL */}
      {/* ========================================================================= */}
      {simModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-zinc-900 dark:text-white">
                    24-Hour Periodic Heat Flow Simulation Test
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    Testing dynamic diurnal heat transfer using current Time-lag (ϕ) and Decrement factors (μ)
                  </p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSimModalOpen(false)} className="rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {simLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                <p className="text-xs font-bold text-zinc-400">Computing 24-hr harmonic diurnal heat balance...</p>
              </div>
            ) : simResult ? (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Daily Mean Heat (Qa)</p>
                    <p className="text-lg font-black text-zinc-900 dark:text-white">{simResult.daily_avg_envelope_heat} W</p>
                  </div>
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Peak Periodic Load</p>
                    <p className="text-lg font-black text-indigo-600">{simResult.peak_envelope_heat} W</p>
                    <span className="text-[9px] text-zinc-400">at Hour {simResult.peak_envelope_hour}:00</span>
                  </div>
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Steady State Peak</p>
                    <p className="text-lg font-black text-rose-500">{simResult.peak_steady_envelope} W</p>
                    <span className="text-[9px] text-zinc-400">without thermal mass</span>
                  </div>
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Mass Damping (μ)</p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">-{simResult.envelope_damping_pct}%</p>
                    <span className="text-[9px] text-emerald-500 font-semibold">Peak load reduction</span>
                  </div>
                </div>

                {/* Elements Breakdown */}
                <div className="space-y-3">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Envelope Assemblies Analyzed</h5>
                  <div className="space-y-2">
                    {simResult.elements.map((el: any, i: number) => (
                      <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-zinc-900 dark:text-white block">{el.name}</span>
                          <span className="text-[10px] text-zinc-400">
                            Area: {el.area} m² | U: {el.u_value} W/m²°C | Delay (ϕ): {el.time_lag}h | Attenuation (μ): {el.decrement_factor}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-indigo-600 block">Peak: {el.peak_heat_flow} W (hr {el.peak_hour})</span>
                          <span className="text-[10px] text-emerald-600 font-bold">-{el.load_reduction_pct}% reduction</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 24-Hour Diurnal Progression Sample */}
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-zinc-400 mb-2">Diurnal Hourly Profile (00:00 - 23:00)</h5>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 text-center">
                    {simResult.hourly_summary.map((pt: any) => (
                      <div key={pt.hour} className={`p-1.5 rounded-lg border text-[10px] ${
                        pt.hour === simResult.peak_envelope_hour 
                          ? 'bg-indigo-600 text-white border-indigo-700 font-bold' 
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                      }`}>
                        <div className="text-[9px] opacity-75">{pt.hour}:00</div>
                        <div className="font-bold">{Math.round(pt.total_periodic)}W</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
