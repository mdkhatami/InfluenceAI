'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const errorParam = searchParams.get('error');
  const redirect = searchParams.get('redirect') || '/';

  const errorMessages: Record<string, string> = {
    unauthorized: 'Access denied. Your email is not authorized to use this dashboard.',
    auth_failed: 'Authentication failed. Please try again.',
    config: 'Authentication is not configured. Check Supabase settings.',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError('Failed to sign in. Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-black/40 w-full max-w-sm">
      <CardContent className="p-8">
        <div className="space-y-2 text-center mb-8">
          <h2 className="text-xl font-semibold text-zinc-50">Welcome back</h2>
          <p className="text-sm text-zinc-400">Sign in to your command center</p>
        </div>

        {/* Error Messages */}
        {(errorParam || error) && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <p className="text-sm text-red-400">
              {errorParam ? (errorMessages[errorParam] || 'An error occurred.') : error}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-300">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 bg-violet-600 hover:bg-violet-500 h-11 text-sm font-medium mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500">
            Access is restricted to invited accounts only.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
