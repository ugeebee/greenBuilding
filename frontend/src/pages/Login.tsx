import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Building2, Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

export default function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const endpoint = isLoginMode ? '/login' : '/signup';

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          full_name: isLoginMode ? undefined : fullName,
          email: isLoginMode ? undefined : email
        })
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        let errorText = 'An error occurred';
        if (data?.message) errorText = data.message;
        else if (data?.error) errorText = data.error;
        else if (typeof data === 'string' && data.trim() !== '') errorText = data;
        
        setMessage({
          type: 'error',
          text: errorText
        });
        setLoading(false);
        return;
      }

      if (isLoginMode) {
        localStorage.setItem('token', data.token || data);
        navigate('/dashboard');
      } else {
        setMessage({
          type: 'success',
          text: 'Signup successful! Please log in.'
        });
        setIsLoginMode(true); // Switch to login view
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setMessage({
        type: 'error',
        text: 'Failed to connect to the server. Check the connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom dark:border-b dark:border-slate-100/5"></div>
      <Card className="w-full max-w-md relative z-10 shadow-xl border-t-4 border-t-primary backdrop-blur-sm bg-background/95">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isLoginMode ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLoginMode 
              ? 'Enter your credentials to access your account' 
              : 'Enter your details below to create your account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-indigo-600 font-bold">Full Name</Label>
                  <Input 
                    id="fullName" 
                    type="text" 
                    placeholder="Enter your full name" 
                    required 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="border-indigo-200 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-indigo-600 font-bold">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-indigo-200 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="johndoe" 
                required 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {message && (
              <div className={`text-sm p-3 rounded-md ${message.type === 'error' ? 'bg-destructive/15 text-destructive' : 'bg-emerald-500/15 text-emerald-600'}`}>
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoginMode ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-4 border-t">
          <div className="text-sm text-center text-muted-foreground w-full">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setMessage(null);
                setFullName('');
                setEmail('');
                setUsername('');
                setPassword('');
              }}
              className="font-semibold text-primary hover:underline transition-all"
            >
              {isLoginMode ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
