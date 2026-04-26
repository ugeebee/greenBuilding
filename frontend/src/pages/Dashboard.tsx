import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calculator, History, LogOut, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold">
              GB
            </div>
            <span className="font-semibold text-lg tracking-tight">Green Building Tool</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">Welcome back</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-col items-center text-center space-y-4 mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Your Dashboard
          </h1>
          <p className="text-xl text-muted-foreground max-w-[600px]">
            What would you like to do today? Select an option below to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* New Calculation */}
          <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1 duration-200 border-indigo-100 dark:border-indigo-900/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Calculator className="w-6 h-6" />
              </div>
              <CardTitle>New Calculation</CardTitle>
              <CardDescription>
                Start a new heat load and U-value calculation for a room or building.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-4">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => navigate('/calculator')}>
                Open Calculator
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1 duration-200 border-emerald-100 dark:border-emerald-900/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center mb-4">
                <History className="w-6 h-6" />
              </div>
              <CardTitle>Calculation History</CardTitle>
              <CardDescription>
                View, download, or edit your previously saved room calculations.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-4">
              <Button variant="outline" className="w-full border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950" onClick={() => navigate('/calculator/history')}>
                View History
              </Button>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
