import { sql } from 'drizzle-orm';
import type { Database } from '@/db';
import type { DateRange } from './revenue';

export interface OccupancyRow {
  vehicleId: string;
  make: string;
  model: string;
  plate: string;
  rentedDays: number;
}

/** Active rental statuses that occupy a vehicle. */
const ACTIVE_STATUSES = sql`('approved','dispatched','in_progress','completed')`;

/**
 * Rented days per vehicle within [from, to). Counts the clipped overlap of each
 * active booking's [pickup_at, return_at) window with the report window, summed
 * per vehicle and rounded up to whole days. Pure SQL builder.
 */
export async function occupancyPerVehicle(db: Database, range: DateRange): Promise<OccupancyRow[]> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const rows = await db.execute<{
    vehicle_id: string;
    make: string;
    model: string;
    plate: string;
    rented_days: string;
  }>(sql`
    SELECT v.id AS vehicle_id,
           v.make AS make,
           v.model AS model,
           v.plate AS plate,
           COALESCE(
             SUM(
               CEIL(
                 EXTRACT(EPOCH FROM (
                   LEAST(b.return_at, ${to}::timestamptz) - GREATEST(b.pickup_at, ${from}::timestamptz)
                 )) / 86400.0
               )
             ),
             0
           ) AS rented_days
    FROM vehicles v
    LEFT JOIN bookings b
      ON b.vehicle_id = v.id
      AND b.status IN ${ACTIVE_STATUSES}
      AND b.pickup_at < ${to}::timestamptz
      AND b.return_at > ${from}::timestamptz
    WHERE v.deleted_at IS NULL
    GROUP BY v.id, v.make, v.model, v.plate
    ORDER BY rented_days DESC, v.make ASC, v.model ASC
  `);
  return rows.map((r) => ({
    vehicleId: r.vehicle_id,
    make: r.make,
    model: r.model,
    plate: r.plate,
    rentedDays: Number(r.rented_days),
  }));
}
