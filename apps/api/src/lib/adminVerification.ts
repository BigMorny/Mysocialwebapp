const verifiedSessions = new Map<string, number>();

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

function cleanup(now: number) {
  for (const [sessionId, at] of verifiedSessions.entries()) {
    if (now - at > FIVE_HOURS_MS) verifiedSessions.delete(sessionId);
  }
}

export function setAdminVerified(sessionId: string) {
  const now = Date.now();
  cleanup(now);
  verifiedSessions.set(sessionId, now);
}

export function isAdminVerified(sessionId: string) {
  const now = Date.now();
  cleanup(now);
  const at = verifiedSessions.get(sessionId);
  if (!at) return false;
  if (now - at > FIVE_HOURS_MS) {
    verifiedSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function clearAdminVerified(sessionId: string) {
  verifiedSessions.delete(sessionId);
}
