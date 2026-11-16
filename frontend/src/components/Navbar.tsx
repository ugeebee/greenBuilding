import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  Building2, 
  Calculator, 
  Compass, 
  FileSearch, 
  History, 
  LogOut, 
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';

interface NavbarProps {
  title?: string;
}

export default function Navbar({ title }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Calculator', path: '/calculator', icon: Calculator },
    { label: 'Floor Plan Studio', path: '/floorplan/generator', icon: Compass },
    { label: 'Floor Plan Reader', path: '/floorplan/reader', icon: FileSearch },
    { label: 'History', path: '/calculator/history', icon: History },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between mx-auto px-4 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 group-hover:bg-emerald-700 transition-colors text-white flex items-center justify-center font-bold shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none text-slate-900 dark:text-zinc-100">
                GreenBuilding
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                Energy & CAD Studio
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-slate-100/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {title && (
            <span className="hidden md:inline-flex text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-muted-foreground font-medium">
              {title}
            </span>
          )}

          <Link
            to="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Portal
          </Link>

          <Button variant="outline" size="sm" onClick={handleLogout} className="border-slate-200 dark:border-zinc-800">
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile Submenu Bar */}
      <div className="lg:hidden flex items-center gap-1 px-4 py-2 border-t overflow-x-auto bg-slate-50/50 dark:bg-zinc-900/50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-slate-200/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
