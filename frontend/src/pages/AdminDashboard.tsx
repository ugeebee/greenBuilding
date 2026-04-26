import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Users, Activity, LayoutDashboard, LogOut, Search, Clock, ChevronRight, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function AdminDashboard() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);
  const [userHistory, setUserHistory] = React.useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  
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

  const fetchUserHistory = async (username: string) => {
    setHistoryLoading(true);
    setSelectedUser(username);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/user-history?username=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserHistory(data);
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

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-zinc-100 flex flex-col hidden md:flex border-r border-zinc-800">
        <div className="h-16 flex items-center px-6 border-b border-zinc-800 bg-zinc-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center mr-3 shadow-lg shadow-emerald-500/20">
            <ShieldIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-black tracking-tight text-white uppercase text-sm">GB Admin</span>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-8 overflow-y-auto">
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 px-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <button onClick={() => setSelectedUser(null)} className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all ${!selectedUser ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                  <LayoutDashboard className="w-4 h-4 mr-3" />
                  <span className="font-semibold text-sm">User Directory</span>
                </button>
              </li>
              <li>
                <a href="#" className="flex items-center px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all">
                  <Activity className="w-4 h-4 mr-3" />
                  <span className="font-semibold text-sm">System Logs</span>
                </a>
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
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">
              {selectedUser ? `User History: ${selectedUser}` : 'User Management'}
            </h2>
          </div>
          <div className="flex items-center space-x-6">
            {!selectedUser && (
              <div className="relative hidden lg:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input 
                  type="text" 
                  placeholder="Search accounts..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-72 bg-zinc-100 dark:bg-zinc-800 border-none h-10 rounded-full text-sm focus-visible:ring-emerald-500"
                />
              </div>
            )}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-zinc-900 dark:text-white leading-none">Utkarsh G.</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Super Admin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-black shadow-lg">
                SA
              </div>
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-8">
          {!selectedUser ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />
                  <CardHeader className="pb-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Registrations</p>
                    <CardTitle className="text-4xl font-black">{users.length}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full w-fit">
                      <Users className="w-3 h-3 mr-1" /> Active Accounts
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Users Table */}
              <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">User Profile</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contact Info</th>
                        <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Joined Date</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-500 uppercase tracking-widest">Actions</th>
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
                              View History
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
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{selectedUser}'s Calculation History</h3>
                    <p className="text-sm text-zinc-400 font-medium">Reviewing all saved results for this user account.</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 px-3 py-1 font-bold">
                  {userHistory.length} Total Records
                </Badge>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                </div>
              ) : userHistory.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-zinc-400 font-bold">This user has no saved calculations yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {userHistory.map((item, idx) => (
                    <Card key={idx} className="border-none shadow-lg overflow-hidden group">
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
                            <p className="text-sm font-black text-indigo-600">{(item.data.totals?.Qc || 0).toFixed(1)}W</p>
                          </div>
                          <div className="p-3 text-center">
                            <p className="text-[10px] font-black text-zinc-400 uppercase">Qso</p>
                            <p className="text-sm font-black text-emerald-600">{(item.data.totals?.Qso || 0).toFixed(1)}W</p>
                          </div>
                          <div className="p-3 text-center">
                            <p className="text-[10px] font-black text-zinc-400 uppercase">Qsw</p>
                            <p className="text-sm font-black text-amber-600">{(item.data.totals?.Qsw || 0).toFixed(1)}W</p>
                          </div>
                          <div className="p-3 text-center">
                            <p className="text-[10px] font-black text-zinc-400 uppercase">Qv</p>
                            <p className="text-sm font-black text-rose-600">{(item.data.totals?.Qv || 0).toFixed(1)}W</p>
                          </div>
                        </div>
                        {/* Summary details */}
                        <div className="p-4 space-y-2">
                          {(item.data.details || []).slice(0, 3).map((row: any, ri: number) => (
                            <div key={ri} className="flex justify-between items-center text-[11px] font-semibold border-b border-zinc-50 dark:border-zinc-800 pb-1 last:border-0">
                              <span className="text-zinc-500">{row.Surface}</span>
                              <span className="text-zinc-900 dark:text-zinc-100">Area: {row.A}m²</span>
                            </div>
                          ))}
                          {item.data.details?.length > 3 && (
                            <p className="text-[10px] text-center font-bold text-zinc-400 pt-1">+ {item.data.details.length - 3} more surfaces</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
