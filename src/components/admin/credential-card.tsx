'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  setCredentialAction,
  testConnectionAction,
} from '@/lib/actions/credentials';
import {
  type CredentialProvider,
  type CredentialFieldDef,
} from '@/lib/credentials/types';

export interface FieldState {
  key: string;
  label: string;
  secret: boolean;
  lastFour: string | null;
}

export interface AuditEntry {
  action: string;
  targetId: string | null;
  at: string;
}

interface Props {
  provider: CredentialProvider;
  label: string;
  fields: FieldState[];
  /** Whether this provider supports a live connection test. */
  testable: boolean;
  recentEvents: AuditEntry[];
}

export function CredentialCard({
  provider,
  label,
  fields,
  testable,
  recentEvents,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  // Track which fields are in "edit" mode and their current input values.
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string | null>>(
    Object.fromEntries(fields.map((f) => [f.key, f.lastFour])),
  );

  function toggleEdit(key: string) {
    setEditing((e) => ({ ...e, [key]: !e[key] }));
  }

  function onSave(field: CredentialFieldDef) {
    const value = values[field.key] ?? '';
    if (value.trim() === '') {
      toast.error('Enter a value first.');
      return;
    }
    const fd = new FormData();
    fd.set('provider', provider);
    fd.set('key', field.key);
    fd.set('value', value);
    start(async () => {
      const res = await setCredentialAction(fd);
      if (res.ok) {
        toast.success(`${field.label} saved.`);
        setSaved((s) => ({ ...s, [field.key]: res.lastFour }));
        setEditing((e) => ({ ...e, [field.key]: false }));
        setValues((v) => ({ ...v, [field.key]: '' }));
        router.refresh();
      } else {
        toast.error(`Save failed: ${res.error}`);
      }
    });
  }

  function onTest() {
    startTest(async () => {
      const res = await testConnectionAction(provider);
      if (res.ok) toast.success(`${label} connection OK.`);
      else toast.error(`${label}: ${res.error}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => {
          const isEditing = editing[field.key] ?? false;
          const current = saved[field.key] ?? null;
          return (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`${provider}-${field.key}`}>{field.label}</Label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    id={`${provider}-${field.key}`}
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={values[field.key] ?? ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                  <Button
                    type="button"
                    onClick={() => onSave(field)}
                    disabled={pending}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toggleEdit(field.key)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-mono">
                    {current ? current : 'Not set'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleEdit(field.key)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {testable ? (
          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onTest}
              disabled={testing}
            >
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        ) : null}

        {recentEvents.length > 0 ? (
          <div className="border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Recent changes
            </div>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {recentEvents.map((e, i) => (
                <li key={i} className="font-mono">
                  {new Date(e.at).toLocaleString()} · {e.action} · {e.targetId}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
