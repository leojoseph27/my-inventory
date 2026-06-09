'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInventoryStore } from '@/store/inventory-store';
import { Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AuthScreen() {
  const { isAuthenticated, setAuthenticated, adminExists, setAdminExists } = useInventoryStore();
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Setup form
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupName, setSetupName] = useState('');

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const res = await fetch('/api/auth/check');
      if (res.ok) {
        const data = await res.json();
        setAdminExists(data.exists);
        setIsSetup(!data.exists);
      }
    } catch (error) {
      console.error('Error checking admin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupEmail || !setupPassword) {
      toast.error('Email and password are required');
      return;
    }

    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: setupEmail, password: setupPassword, name: setupName }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true, data);
        setAdminExists(true);
        toast.success('Account created successfully!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create account');
      }
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true, data);
        toast.success('Welcome back!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Invalid credentials');
      }
    } catch (error) {
      toast.error('Login failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">Inventory & Catalog Management</p>
        </div>

        {!adminExists ? (
          /* Setup Form */
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-center">Create Admin Account</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-name">Name (Optional)</Label>
                  <Input
                    id="setup-name"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="Admin"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-email">Email</Label>
                  <Input
                    id="setup-email"
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-password">Password</Label>
                  <Input
                    id="setup-password"
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="Create a password"
                    className="h-11"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11">
                  Create Account
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Login Form */
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-center">Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11">
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
