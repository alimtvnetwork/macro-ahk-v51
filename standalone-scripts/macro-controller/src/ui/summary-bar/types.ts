/**
 * Dashboard summary bar — public types (Issue 125 §2.2 / §4).
 */

import type { WorkspaceDisplayKind } from '../../workspace-display-status';

/**
 * The three values rendered by the summary strip below the title row.
 * `proExpiringCount` includes `canceled`, `expire-soon`, `expired`, and
 * `expired-hard` (the spec's "expire / expire-soon / canceled" set,
 * widened to the actual display-kind enum).
 */
export interface DashboardSummary {
    readonly proCount: number;
    readonly proExpiringCount: number;
    readonly proCreditsAvailable: number;
    readonly proCreditsTotal: number;
    readonly freeCreditsAvailable: number;
}

/** Display kinds that count toward `proExpiringCount`. */
export const PRO_EXPIRING_KINDS: ReadonlySet<WorkspaceDisplayKind> = new Set<WorkspaceDisplayKind>([
    'canceled',
    'expired',
    'expired-hard',
    'expire-soon',
    'past-due-expiring',
]);
