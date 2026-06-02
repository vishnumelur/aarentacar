'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
} from '@/lib/actions/totp-setup';

interface StagedSecret {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

export function Setup2faPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [staged, setStaged] = useState<StagedSecret | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>2FA is enabled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Your account is protected by an authenticator app.
          </p>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await disableTotp();
                if (res.ok) {
                  toast.success('2FA disabled.');
                  router.refresh();
                } else {
                  toast.error('Could not disable 2FA.');
                }
              })
            }
          >
            Disable 2FA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!staged) {
    return (
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await beginTotpSetup();
            if (res.ok) {
              setStaged({
                secret: res.secret,
                otpauthUri: res.otpauthUri,
                recoveryCodes: res.recoveryCodes,
              });
            } else {
              toast.error(
                res.error === 'already_enabled' ? '2FA already enabled.' : 'Forbidden.',
              );
            }
          })
        }
      >
        Set up 2FA
      </Button>
    );
  }

  async function onConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await confirmTotpSetup(fd);
      if (res.ok) {
        toast.success('2FA enabled.');
        router.refresh();
      } else {
        setError('That code did not match. Try again.');
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Add this key to your authenticator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Enter this secret manually, or open the otpauth link on the device
            running your authenticator app:
          </p>
          <code className="bg-muted block rounded px-3 py-2 font-mono text-sm break-all">
            {staged.secret}
          </code>
          <a
            href={staged.otpauthUri}
            className="text-primary text-sm underline break-all"
          >
            {staged.otpauthUri}
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Save your recovery codes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            Store these somewhere safe. Each can be used once if you lose your
            device. They will not be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {staged.recoveryCodes.map((c) => (
              <li key={c} className="bg-muted rounded px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Confirm a code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onConfirm} className="space-y-3">
            <Label htmlFor="code">6-digit code</Label>
            <Input id="code" name="code" inputMode="numeric" placeholder="123456" required />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              Enable 2FA
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
