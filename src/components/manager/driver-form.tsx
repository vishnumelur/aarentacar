'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDriver, updateDriver } from '@/lib/actions/drivers';

interface CreateProps {
  mode: 'create';
}

interface EditProps {
  mode: 'edit';
  initial: {
    userId: string;
    fullName: string;
    phone: string;
    licenseNo: string;
    licenseExpiry: string;
  };
}

type Props = CreateProps | EditProps;

export function DriverForm(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    if (props.mode === 'edit') fd.set('userId', props.initial.userId);

    start(async () => {
      if (props.mode === 'create') {
        const res = await createDriver(fd);
        if (res && !res.ok) setErr(res.error);
        // success path redirects via the action
      } else {
        const res = await updateDriver(fd);
        if (!res.ok) setErr(res.error);
        else {
          setOk(true);
          router.refresh();
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
      {props.mode === 'create' && (
        <>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="password">Initial password</Label>
            <Input
              id="password"
              name="password"
              type="text"
              autoComplete="new-password"
              minLength={12}
              required
              placeholder="At least 12 characters"
            />
            <p className="text-xs text-muted-foreground">
              Manager shares this with the driver out-of-band. They can change it after logging in (password reset ships later).
            </p>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={props.mode === 'edit' ? props.initial.fullName : ''}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={props.mode === 'edit' ? props.initial.phone : ''}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="licenseNo">Driving license number</Label>
        <Input
          id="licenseNo"
          name="licenseNo"
          defaultValue={props.mode === 'edit' ? props.initial.licenseNo : ''}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="licenseExpiry">License expiry</Label>
        <Input
          id="licenseExpiry"
          name="licenseExpiry"
          type="date"
          defaultValue={props.mode === 'edit' ? props.initial.licenseExpiry : ''}
          required
        />
      </div>

      {err && (
        <p className="md:col-span-2 text-sm text-destructive">
          {err === 'email_taken'
            ? 'That email is already in use.'
            : err === 'invalid_input'
              ? 'Please check the form values.'
              : `Error: ${err}`}
        </p>
      )}
      {ok && <p className="md:col-span-2 text-sm text-green-600">Saved.</p>}

      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : props.mode === 'create' ? 'Create driver' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
