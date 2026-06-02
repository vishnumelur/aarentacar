'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export interface DriverPin {
  userId: string;
  fullName: string;
  lat: number;
  lng: number;
}

interface Props {
  drivers: DriverPin[];
}

/**
 * Lightweight on-duty driver presence. Refreshes the server data every 30s via
 * router.refresh(). Renders a pin list (works with no Mapbox token, so the
 * build never requires one). When a public Mapbox token is present, each pin
 * links to a static map preview.
 */
export function LiveDriverMap({ drivers }: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    setToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
    const interval = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(interval);
  }, [router]);

  if (drivers.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No drivers on duty right now.</p>;
  }

  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {drivers.map((d) => {
        const mapUrl = token
          ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+f43f5e(${d.lng},${d.lat})/${d.lng},${d.lat},12,0/300x160?access_token=${token}`
          : null;
        return (
          <li key={d.userId} className="overflow-hidden rounded-md border text-sm">
            {mapUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mapUrl} alt={`Map for ${d.fullName}`} className="h-32 w-full object-cover" />
            ) : (
              <div className="flex h-32 w-full items-center justify-center bg-muted text-muted-foreground">
                <MapPin className="size-6" />
              </div>
            )}
            <div className="flex items-center justify-between p-2">
              <span className="font-medium">{d.fullName}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {d.lat.toFixed(3)}, {d.lng.toFixed(3)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
