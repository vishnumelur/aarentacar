import { isFeatureEnabled } from '@/lib/feature-flags';

/**
 * Site-wide maintenance banner (Plan #11). Rendered in the root layout. Reads
 * the `maintenance-mode` flag (30s cache) and degrades silently on any error so
 * a flag-read failure never blanks the app shell.
 */
export async function MaintenanceBanner() {
  let on = false;
  try {
    on = await isFeatureEnabled('maintenance-mode');
  } catch {
    on = false;
  }
  if (!on) return null;
  return (
    <div
      role="alert"
      className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black"
    >
      We are performing scheduled maintenance. New bookings are temporarily
      unavailable.
    </div>
  );
}
