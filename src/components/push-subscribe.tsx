'use client';

import { useEffect, useState } from 'react';

interface Props {
  vapidPublicKey: string | null;
}

type Status =
  | 'checking'
  | 'not_supported'
  | 'no_key'
  | 'denied'
  | 'enabled'
  | 'disabled'
  | 'error';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushSubscribe({ vapidPublicKey }: Props) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('not_supported');
        return;
      }
      if (!vapidPublicKey) {
        setStatus('no_key');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          setStatus('enabled');
          return;
        }
        if (Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            setStatus('denied');
            return;
          }
        }
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const subJson = sub.toJSON();
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        });
        setStatus(res.ok ? 'enabled' : 'error');
      } catch (err: unknown) {
        console.warn('push subscribe failed', err);
        setStatus('error');
      }
    })();
  }, [vapidPublicKey]);

  const LABELS: Record<Status, string> = {
    checking: 'Checking notifications…',
    not_supported: 'Notifications not supported in this browser',
    no_key: 'Notifications not configured by admin',
    denied: 'Notifications blocked',
    enabled: 'Notifications enabled',
    disabled: 'Notifications disabled',
    error: 'Could not enable notifications',
  };
  const TONES: Record<Status, string> = {
    checking: 'bg-muted text-muted-foreground',
    not_supported: 'bg-muted text-muted-foreground',
    no_key: 'bg-muted text-muted-foreground',
    denied: 'bg-destructive/10 text-destructive',
    enabled: 'bg-green-100 text-green-900',
    disabled: 'bg-muted text-muted-foreground',
    error: 'bg-destructive/10 text-destructive',
  };

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${TONES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
