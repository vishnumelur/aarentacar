'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { toggleFeatureFlag } from '@/lib/actions/feature-flags';

export function FeatureFlagToggle({
  flagKey,
  label,
  description,
  initialEnabled,
}: {
  flagKey: string;
  label: string;
  description: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const next = !enabled;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('key', flagKey);
      fd.set('enabled', String(next));
      const res = await toggleFeatureFlag(fd);
      if (res.ok) {
        setEnabled(res.enabled);
        toast.success(`${label} ${res.enabled ? 'enabled' : 'disabled'}.`);
      } else {
        toast.error('Could not update flag.');
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b py-4 last:border-b-0">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={pending}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary' : 'bg-input'
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
