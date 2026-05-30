import type { WorkspaceCredit } from './types/credit-types';

export interface PerWsMembers {
  wsId: string;
  wsName: string;
  members: any[]; // Replace with proper Member type if available
  error?: string;
}

const fetchCache = new Map<string, PerWsMembers>();

/**
 * Sequential fetch with per-workspace caching.
 * Capped at 25 to avoid rate limits / performance issues.
 */
export async function fetchMembersForMany(
  wsIds: string[],
  workspaces: ReadonlyArray<WorkspaceCredit>,
  options: { cap?: number } = {}
): Promise<PerWsMembers[]> {
  const cap = options.cap ?? 25;
  const targetIds = wsIds.slice(0, cap);
  const results: PerWsMembers[] = [];

  for (const id of targetIds) {
    const ws = workspaces.find(w => w.id === id);
    const wsName = ws?.fullName || ws?.name || id;

    if (fetchCache.has(id)) {
      results.push(fetchCache.get(id)!);
      continue;
    }

    try {
      // Mocking the actual fetch for now as I need to see how single ws members are fetched
      // This will be wired to the real API call in a later step
      const members: any[] = []; 
      const res = { wsId: id, wsName, members };
      fetchCache.set(id, res);
      results.push(res);
    } catch (e: any) {
      results.push({ wsId: id, wsName, members: [], error: String(e.message || e) });
    }
  }

  return results;
}

export function invalidateMembersCache(wsId?: string): void {
  if (wsId) fetchCache.delete(wsId);
  else fetchCache.clear();
}
