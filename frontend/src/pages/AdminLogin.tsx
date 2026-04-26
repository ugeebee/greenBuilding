import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { ShieldCheck, Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, code })
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (response.ok) {
        localStorage.setItem('admin_token', data.token || data);
        navigate('/admin/dashboard');
      } else {
        let errorText = 'Login Failed';
        if (data?.message) errorText = data.message;
        else if (data?.error) errorText = data.error;
        else if (typeof data === 'string' && data.trim() !== '') errorText = data;

        setMessage({
          type: 'error',
          text: errorText
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Connection error.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[bottom_1px_center]"></div>
      <Card className="w-full max-w-md relative z-10 border-zinc-800 bg-zinc-900/50 backdrop-blur-xl text-zinc-100">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="mx-auto bg-emerald-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
            Admin Portal
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Authenticate to access the management console
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-zinc-300">Username</Label>
              <Input 
                id="admin-username" 
                type="text" 
                placeholder="admin" 
                required 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-emerald-500 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-zinc-300">Password</Label>
              <Input 
                id="admin-password" 
                type="password" 
                placeholder="••••••••" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-emerald-500 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-code" className="text-zinc-300">2FA Code</Label>
              <Input 
                id="totp-code" 
                type="text" 
                placeholder="123456" 
                maxLength={6}
                required 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-emerald-500 text-center tracking-[0.5em] text-lg text-emerald-400 font-mono"
              />
            </div>

            {message && (
              <div className={`text-sm p-3 rounded-md border ${message.type === 'error' ? 'bg-red-950/30 border-red-900/50 text-red-400' : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'}`}>
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white border-none mt-2" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
