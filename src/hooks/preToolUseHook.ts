import type { ToolError } from "../tools/shared";

/**
 * Deterministic PreToolUse hook ("The Brake"). Runs before EVERY tool call in
 * every specialist loop. NO LLM calls — pure, synchronous, rule-based.
 *
 * Returns `null` to allow the call, or a structured {@link ToolError} to block it.
 * Blocking surfaces the error back to the specialist as a tool_result so the
 * agent can adapt (typically by escalating to a human).
 */
export function preToolUseHook(
  toolName: string,
  toolInput: Record<string, unknown>,
): ToolError | null {
  // --- Hard stop: bulk / mass actions (any tool) ---
  if (toolInput.bulk === true) {
    return block(
      "BLOCKED_BULK_ACTION",
      "Bulk operations are not permitted from the service desk agent. Split into individual, reviewed requests.",
    );
  }
  if (Array.isArray(toolInput.userList) && toolInput.userList.length > 1) {
    return block(
      "BLOCKED_BULK_ACTION",
      "Mass access changes (multiple users in one call) require a human-approved change ticket.",
    );
  }

  switch (toolName) {
    case "grantGroupMembership": {
      const group = asString(toolInput.group);
      if (/\b(admin|domain admin|domain admins|privileged)\b/i.test(group)) {
        return block(
          "BLOCKED_ADMIN_GRANT",
          `Granting membership to a privileged group ("${group}") is blocked. This requires human approval via the access-governance process.`,
        );
      }
      return null;
    }

    case "resetPassword": {
      const account = asString(toolInput.account ?? toolInput.user ?? toolInput.username);
      if (isPrivilegedAccount(account)) {
        return block(
          "BLOCKED_PRIVILEGED_RESET",
          `Password reset for a privileged or C-Level account ("${account}") is blocked. Identity must be verified out-of-band by a human operator.`,
        );
      }
      return null;
    }

    case "quarantineAccount": {
      const reason = asString(toolInput.reason);
      if (reason.trim().length < 20) {
        return block(
          "BLOCKED_QUARANTINE_NO_REASON",
          "Quarantining an account requires a documented reason of at least 20 characters for the audit trail.",
        );
      }
      return null;
    }

    default:
      return null;
  }
}

function block(reasonCode: string, guidance: string): ToolError {
  return { isError: true, reasonCode, guidance };
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const C_LEVEL_LOCALPARTS = ["ceo", "cfo", "cto", "ciso", "coo", "cmo", "chro", "cio"];

/** administrator, svc-* service accounts, or C-Level email local-parts. */
function isPrivilegedAccount(account: string): boolean {
  const a = account.trim().toLowerCase();
  if (a === "administrator" || a === "admin" || a === "root") return true;
  if (a.startsWith("svc-") || a.startsWith("svc_")) return true;
  const localPart = a.includes("@") ? a.split("@")[0] : a;
  return C_LEVEL_LOCALPARTS.includes(localPart);
}
