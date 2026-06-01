# AA Rent A Car — Plan #10: Manager Portal Completion

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Fill in everything missing from the Manager Portal beyond the day-to-day inventory + bookings flow: live KPIs on the dashboard, agent permissions, promotions CRUD, reports with CSV export, notifications inbox, full settings page. **After this plan ships:** the manager has no reason to ever touch the database or call a developer.

**Spec reference:** §7.2 (all sections — Dashboard, Customers verification queue, Drivers performance, Promotions, Reports, Notifications inbox, Settings).

---

## File Structure
- `src/app/manager/page.tsx` (full rewrite — real KPIs)
- `src/app/manager/promos/page.tsx`, `[id]/page.tsx`
- `src/app/manager/reports/page.tsx`
- `src/app/manager/settings/page.tsx`
- `src/app/manager/notifications/page.tsx`
- `src/lib/actions/promos.ts`, `reports.ts`, `settings.ts`
- `src/lib/reports/revenue.ts`, `occupancy.ts`, `payment-mix.ts` (pure SQL builders, TDD)
- `src/components/manager/agent-permissions-matrix.tsx`
- Modify Plan #1's `users` queries + `agent_permissions` schema (already in Plan #1 spec) to enforce sub-permissions

## Task 1: Real KPIs on Dashboard
```ts
async function dashboardKpis() {
  const today = startOfDay(new Date());
  const [activeRentals] = await db.execute(sql`SELECT count(*) FROM bookings WHERE status IN ('approved','dispatched','in_progress')`);
  const [pendingApprovals] = await db.execute(sql`SELECT count(*) FROM bookings WHERE status='pending_approval'`);
  const [pendingKyc] = await db.execute(sql`SELECT count(distinct customer_id) FROM customer_documents WHERE status='pending'`);
  const [availableCars] = await db.execute(sql`SELECT count(*) FROM vehicles WHERE status='active' AND deleted_at IS NULL AND id NOT IN (SELECT vehicle_id FROM bookings WHERE status IN ('approved','dispatched','in_progress'))`);
  return { activeRentals, pendingApprovals, pendingKyc, availableCars };
}
```
Today's schedule strip: bookings with pickup or return today, color-coded by status.

## Task 2: Today's attention panel
- Pending Approvals (link → /manager/bookings?status=pending_approval)
- Pending KYC (link → /manager/customers?status=pending)
- Returns due today
- Overdue returns (returnAt < now, status='in_progress')
- Live driver map: all on-duty drivers as pins (Mapbox), refresh every 30s

## Task 3: Promotions CRUD
- promo_codes table (already in Plan #1 spec): code (unique), kind (percent|fixed), value, min_amount_aed, max_uses, used_count, valid_from/to, applies_to_categories (jsonb), active
- Manager creates / edits / deactivates codes
- Usage stats: how many bookings used this code, total discount given
- Apply-side logic: Plan #4's `priceQuote` looks up the code, validates (active, within validity window, used_count < max_uses, amount >= min_amount, category match), applies discount, increments used_count atomically

## Task 4: Reports
Three reports for Phase 1:
- **Revenue by day/week/month**: SUM(total_aed) GROUP BY date_trunc, with sparkline + table.
- **Occupancy per vehicle**: per-vehicle "rented days last 30/90" via overlapping booking math.
- **Top types**: GROUP BY type, sorted by total revenue.
- **Payment method mix**: COUNT + SUM per method.
- CSV export button for each.

Pure SQL builders go in `src/lib/reports/*.ts` with TDD using a small fixture DB.

## Task 5: Agent permissions matrix
- `agent_permissions` schema (per Plan #1 §6.1)
- UI on `/manager/users` (sub-page) — for each user with role=agent, checkboxes for can_approve_bookings, can_review_kyc, can_edit_pricing, can_manage_promos, can_view_revenue, can_manage_drivers, can_edit_settings
- Server actions enforcing canAgent permissions across other modules — wrap `canAccessPortal(user.role, 'manager')` with a finer-grained check `canAgent(user, 'edit_pricing')`. Refactor existing actions to use it.

## Task 6: Notifications inbox
- `notifications` schema (already in Plan #1 §6.9): user_id, kind, title, body, payload, read_at
- pg-boss + the dispatch / approval / payment flows write notifications
- Manager portal notifications page lists them with read/unread filter
- Mark-all-as-read button

## Task 7: Settings page
Tabbed page editing the `settings` table values:
- Business hours
- Default deposits per category
- Advance-book rules per category (already in /manager/categories — link to it)
- Cancellation policy (free_until_hours, half_until_hours)
- Languages enabled
- Bank account details for bank-transfer payments
- Email templates (rich text editor for the templates that go out — Plan #12 provides the renderer)

## Task 8: Bank transfer confirmation
On a booking with `payments.method='bank_transfer' AND status='manual_pending'`, manager has a "Confirm receipt" button. Click → flips payment.status=succeeded, booking status moves forward.

## Acceptance
- Dashboard shows real KPI numbers
- Manager creates a promo code; customer applying it in checkout (Plan #4 booking flow) sees the discount
- Reports CSVs export correctly
- Agent with limited permissions cannot approve KYC if `can_review_kyc=false`
- Settings page changes business hours and the landing page reflects them

## Not in this plan
- Driver performance reports (Phase 2 once we have ratings)
- Email template editor full WYSIWYG (Plan #12 uses simpler textarea + handlebars-style placeholders)
- Multi-currency reports (deferred)
