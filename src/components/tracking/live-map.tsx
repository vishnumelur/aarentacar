'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crosshair, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  bearing,
  lerp,
  haversineMeters,
  type LatLng,
} from '@/lib/tracking/interpolation';
import { resolveStatus, type StatusResult } from '@/lib/tracking/status';
import { StatusPill } from './status-pill';
import { EtaCard, type DriverInfo } from './eta-card';

interface LiveMapProps {
  code: string;
  pickup: LatLng | null;
  driver: DriverInfo | null;
  locale: 'en' | 'ar';
}

interface PingEvent {
  driverId: string;
  lat: number;
  lng: number;
  heading: number | null;
  recordedAt: string;
}

const PING_INTERVAL_MS = 2000;
const ARRIVED_RADIUS_M = 100;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function LiveMap({ code, pickup, driver, locale }: LiveMapProps): React.ReactElement {
  const t = useTranslations('tracking');
  const reducedMotion = usePrefersReducedMotion();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Ping bookkeeping (refs so the rAF loop reads fresh values without re-binding).
  const prevRef = useRef<LatLng | null>(null);
  const targetRef = useRef<LatLng | null>(null);
  const lastPingAtRef = useRef<number>(0);
  const bearingRef = useRef<number>(0);
  const trailRef = useRef<LatLng[]>([]);
  const nearSinceRef = useRef<number | null>(null);

  const [status, setStatus] = useState<StatusResult>({ key: 'assigned' });
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [hasFix, setHasFix] = useState(false);

  const dark = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 19;
  }, []);

  // --- SSE subscription -----------------------------------------------------
  useEffect(() => {
    const es = new EventSource(`/api/booking/${code}/track`);

    const onMessage = (ev: MessageEvent): void => {
      let ping: PingEvent;
      try {
        ping = JSON.parse(ev.data) as PingEvent;
      } catch {
        return;
      }
      if (typeof ping.lat !== 'number' || typeof ping.lng !== 'number') return;

      const next: LatLng = { lat: ping.lat, lng: ping.lng };
      const prev = targetRef.current;

      prevRef.current = prev ?? next;
      targetRef.current = next;
      lastPingAtRef.current = performance.now();
      if (prev) {
        bearingRef.current = bearing(prev, next);
      } else if (ping.heading !== null) {
        bearingRef.current = ping.heading;
      }
      trailRef.current = [...trailRef.current, next].slice(-200);
      setHasFix(true);

      // Reduced-motion: jump-cut straight to the target.
      if (reducedMotion) {
        prevRef.current = next;
      }

      // Distance to pickup → arrival dwell tracking + a rough ETA estimate
      // (refined by the server fetch below).
      if (pickup) {
        const dist = haversineMeters(next, pickup);
        if (dist < ARRIVED_RADIUS_M) {
          nearSinceRef.current = nearSinceRef.current ?? Date.now();
        } else {
          nearSinceRef.current = null;
        }
      }
    };

    es.addEventListener('message', onMessage);
    es.addEventListener('error', () => {
      // EventSource auto-reconnects; nothing to do.
    });

    return () => {
      es.removeEventListener('message', onMessage);
      es.close();
    };
  }, [code, pickup, reducedMotion]);

  // --- Server ETA: refresh every 30s, tick down every 1s --------------------
  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      const driverPos = targetRef.current;
      if (!driverPos || !pickup) return;
      try {
        const res = await fetch(`/api/booking/${code}/eta`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from: driverPos, to: pickup }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { durationSec: number | null };
        if (!cancelled && typeof data.durationSec === 'number') {
          setSecondsRemaining(data.durationSec);
        }
      } catch {
        // Keep the last known ETA.
      }
    }

    void refresh();
    const refreshTimer = setInterval(() => void refresh(), 30_000);
    const tickTimer = setInterval(() => {
      setSecondsRemaining((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  }, [code, pickup]);

  // --- Status pill derivation ----------------------------------------------
  useEffect(() => {
    const id = setInterval(() => {
      const driverPos = targetRef.current;
      const distance = driverPos && pickup ? haversineMeters(driverPos, pickup) : null;
      setStatus(
        resolveStatus({
          durationSec: secondsRemaining,
          distanceMeters: distance,
          nearSinceMs: nearSinceRef.current,
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [pickup, secondsRemaining]);

  // --- Mapbox map init + animation loop ------------------------------------
  useEffect(() => {
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
      center: pickup ? [pickup.lng, pickup.lat] : [55.27, 25.2],
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;

    const el = document.createElement('div');
    el.className = 'aa-driver-marker';
    markerElRef.current = el;
    markerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([55.27, 25.2]).addTo(map);

    map.on('load', () => {
      if (pickup) {
        new mapboxgl.Marker({ color: '#dc2626' })
          .setLngLat([pickup.lng, pickup.lat])
          .addTo(map);
      }
      // Trail polyline source/layer.
      map.addSource('trail', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: 'trail',
        type: 'line',
        source: 'trail',
        paint: { 'line-color': '#dc2626', 'line-width': 4, 'line-opacity': 0.8 },
      });
    });

    let frame = 0;
    const animate = (): void => {
      const target = targetRef.current;
      const prev = prevRef.current;
      if (target) {
        let display: LatLng;
        if (reducedMotion || !prev) {
          display = target;
        } else {
          const t = Math.min(1, (performance.now() - lastPingAtRef.current) / PING_INTERVAL_MS);
          display = lerp(prev, target, t);
        }
        markerRef.current?.setLngLat([display.lng, display.lat]);
        if (markerElRef.current) {
          markerElRef.current.style.setProperty('--bearing', `${bearingRef.current}deg`);
        }

        // Update trail.
        const src = map.getSource('trail') as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: trailRef.current.map((p) => [p.lng, p.lat]),
            },
            properties: {},
          });
        }

        // Auto-frame driver + pickup occasionally.
        if (pickup && frame % 90 === 0) {
          const b = new mapboxgl.LngLatBounds(
            [target.lng, target.lat],
            [target.lng, target.lat],
          );
          b.extend([pickup.lng, pickup.lat]);
          map.fitBounds(b, { padding: 80, maxZoom: 15, duration: reducedMotion ? 0 : 600 });
        }
      }
      frame += 1;
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [token, pickup, dark, reducedMotion]);

  const recenter = (): void => {
    const map = mapRef.current;
    const target = targetRef.current;
    if (!map) return;
    if (target && pickup) {
      const b = new mapboxgl.LngLatBounds([target.lng, target.lat], [target.lng, target.lat]);
      b.extend([pickup.lng, pickup.lat]);
      map.fitBounds(b, { padding: 80, maxZoom: 15 });
    } else if (target) {
      map.easeTo({ center: [target.lng, target.lat], zoom: 15 });
    }
  };

  // --- No-token fallback ----------------------------------------------------
  if (!token) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
        <MapPin className="h-10 w-10 text-primary" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">{t('mapUnavailable')}</p>
        <div className="w-full max-w-sm">
          <StatusPill status={status} reducedMotion={reducedMotion} />
        </div>
        <div className="w-full max-w-sm">
          <EtaCard driver={driver} secondsRemaining={secondsRemaining} locale={locale} />
        </div>
        <span className="sr-only" data-testid="has-fix">
          {hasFix ? 'live' : 'waiting'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={['relative h-full w-full', reducedMotion ? 'aa-reduced-motion' : ''].join(' ')}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* Status pill, top-center. */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
        <StatusPill status={status} reducedMotion={reducedMotion} />
      </div>

      {/* Recenter FAB. */}
      <button
        type="button"
        onClick={recenter}
        aria-label={t('recenter')}
        className="absolute bottom-44 right-4 z-10 rounded-full bg-card p-3 shadow-lg"
      >
        <Crosshair className="h-5 w-5" aria-hidden />
      </button>

      {/* ETA card, bottom. Drop-and-bounce in on mount. */}
      <motion.div
        className="absolute inset-x-4 bottom-4 z-10"
        initial={reducedMotion ? false : { y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
      >
        <EtaCard driver={driver} secondsRemaining={secondsRemaining} locale={locale} />
      </motion.div>
    </div>
  );
}
