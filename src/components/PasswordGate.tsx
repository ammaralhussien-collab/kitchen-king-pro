import { useState, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'app_unlocked';

export const lockApp = () => {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('app-lock-changed'));
};

const PasswordGate = ({ children }: { children: ReactNode }) => {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = () => setUnlocked(sessionStorage.getItem(STORAGE_KEY) === '1');
    window.addEventListener('app-lock-changed', handler);
    return () => window.removeEventListener('app-lock-changed', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-app-password', {
        body: { password },
      });
      if (fnErr) throw fnErr;
      if (data?.valid) {
        sessionStorage.setItem(STORAGE_KEY, '1');
        setUnlocked(true);
        setError('');
        setPassword('');
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Incorrect password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Enter Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Please enter the password to access the app.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="app-password">Password</Label>
            <Input
              id="app-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              autoFocus
              required
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Checking…' : 'Unlock'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;