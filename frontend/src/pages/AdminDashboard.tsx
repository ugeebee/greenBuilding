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
  Filter
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function AdminDashboard() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);
  const [userHistory, setUserHistory] = React.useState<any[]>([]);
  const [userActivities, setUserActivities] = React.useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [userDetailTab, setUserDetailTab] = React.useState<'calculations' | 'activities'>('calculations');
  
  // System logs view
  const [mainView, setMainView] = React.useState<'users' | 'logs'>('users');
  const [allActivities, setAllActivities] = React.useState<any[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<string>('ALL');

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

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

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
            <span className="text-[10px] text-zinc-400 block font-semibold">30-Day Audit Trail</span>
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
                  : mainView === 'logs' 
                  ? 'System-Wide Activity Logs' 
                  : 'User Management Directory'}
              </h2>
              <span className="text-[11px] text-zinc-500 font-medium">
                All records stored in database for 30 days
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            {!selectedUser && (
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
                30-Day Retention Active
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
                          <div className="p-4 space-y-2">
                            {(item.data?.details || []).slice(0, 3).map((row: any, ri: number) => (
                              <div key={ri} className="flex justify-between items-center text-[11px] font-semibold border-b border-zinc-50 dark:border-zinc-800 pb-1 last:border-0">
                                <span className="text-zinc-500">{row.Surface}</span>
                                <span className="text-zinc-900 dark:text-zinc-100">Area: {row.A}m²</span>
                              </div>
                            ))}
                            {item.data?.details?.length > 3 && (
                              <p className="text-[10px] text-center font-bold text-zinc-400 pt-1">+ {item.data.details.length - 3} more surfaces</p>
                            )}
                            {item.image_hash && (
                              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="w-8 h-8 rounded border overflow-hidden bg-zinc-100 shrink-0">
                                  <img
                                    src={item.image_url || `/api/uploads/blueprints/${item.image_hash}.png`}
                                    alt="Blueprint"
                                    className="w-full h-full object-cover"
                                    onError={(e: any) => { e.target.style.display = 'none'; }}
                                  />
                                </div>
                                <div className="text-[10px]">
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">{item.image_name || "Blueprint Plan"}</span>
                                  <span className="font-mono text-[9px] text-zinc-400">SHA-256: {item.image_hash.slice(0, 16)}...</span>
                                </div>
                                <a
                                  href={item.image_url || `/api/uploads/blueprints/${item.image_hash}.png`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-emerald-600 hover:underline ml-auto font-medium"
                                >
                                  View
                                </a>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                /* User Activities Tab */
                userActivities.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-400 font-bold">No activity logs recorded for this user in the past 30 days.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userActivities.map((act) => (
                      <div key={act.id} className="p-4 rounded-xl border bg-white dark:bg-zinc-900 flex items-center justify-between shadow-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="text-[10px] font-bold bg-indigo-100 text-indigo-700">
                              {act.activity_type}
                            </Badge>
                            <span className="font-bold text-sm">{act.action_name}</span>
                          </div>
                          <p className="text-xs text-zinc-500">{act.description}</p>
                          {act.image_hash && (
                            <div className="flex items-center gap-2 mt-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                              <div className="w-7 h-7 rounded border overflow-hidden bg-zinc-100 shrink-0">
                                <img
                                  src={act.image_url || `/api/uploads/blueprints/${act.image_hash}.png`}
                                  alt="Blueprint"
                                  className="w-full h-full object-cover"
                                  onError={(e: any) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                              <div className="text-[10px]">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">{act.image_name || "Blueprint"}</span>
                                <span className="font-mono text-[9px] text-zinc-400">SHA-256: {act.image_hash.slice(0, 12)}...</span>
                              </div>
                              <a
                                href={act.image_url || `/api/uploads/blueprints/${act.image_hash}.png`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-emerald-600 hover:underline ml-auto font-medium"
                              >
                                View
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-zinc-600">
                            {new Date(act.created_at).toLocaleString()}
                          </div>
                          {act.ip_address && (
                            <span className="text-[10px] text-zinc-400 font-mono">IP: {act.ip_address}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
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
                              {act.image_hash && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <a
                                    href={act.image_url || `/api/uploads/blueprints/${act.image_hash}.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {act.image_name || "Blueprint Plan"} ({act.image_hash.slice(0, 10)}...)
                                  </a>
                                </div>
                              )}
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
