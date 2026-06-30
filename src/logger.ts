/**
 * Structured JSON logging. All logs go to **stderr** so that stdout stays clean
 * for machine-readable output (e.g. the eval scorecard, processRequest result).
 *
 * PII rule (see CLAUDE.md): never log employee names, email addresses or raw
 * request text. Reference requests by `requestId` only. Callers are responsible
 * for not passing PII into the event payload.
 */
export function logEvent(event: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  process.stderr.write(line + "\n");
}
