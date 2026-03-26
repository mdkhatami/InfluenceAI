'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-black/40">
      <CardContent className="p-8">
        <div className="space-y-2 text-center mb-8">
          <h2 className="text-xl font-semibold text-zinc-50">Welcome back</h2>
          <p className="text-sm text-zinc-400">Sign in to your command center</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="space-y-4"
        >
          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-300">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@influenceai.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-2.5 pl-10 pr-4 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-2.5 pl-10 pr-4 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <button type="button" className="text-xs text-zinc-400 hover:text-blue-400 transition-colors">
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full gap-2">
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500">
            Don&apos;t have an account?{' '}
            <button type="button" className="text-blue-400 hover:text-blue-300 transition-colors">
              Get started
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
