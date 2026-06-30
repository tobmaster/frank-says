import { SpecialistTool, ok, fail, makeTicketId } from "./shared";

const KB: Record<string, string> = {
  phishing: "Do not click links. Report via the Phish-Report button. We quarantine the message and block the sender domain.",
  ransomware: "Disconnect the device from the network immediately, do not power off, and call the SOC hotline.",
  "data loss": "Identify scope, preserve logs, notify the DPO within 1 hour for potential GDPR-reportable incidents.",
  mfa: "Lost MFA device: verify identity out-of-band, then re-enroll. Never disable MFA remotely on request.",
};

export const securityTools: SpecialistTool[] = [
  {
    definition: {
      name: "lookupSecurityKb",
      description:
        "Search the security knowledge base for guidance on a topic (phishing, ransomware, data loss, mfa). Read-only. Does NOT take any containment action.",
      input_schema: {
        type: "object",
        properties: { topic: { type: "string", description: "Security topic / keyword" } },
        required: ["topic"],
      },
    },
    handler: (input) => {
      const t = String(input.topic ?? "").toLowerCase();
      const key = Object.keys(KB).find((k) => t.includes(k));
      if (!key) return fail("KB_NO_MATCH", "No KB article matched. Escalate to the SOC for novel incidents.");
      return ok({ topic: key, guidance: KB[key] });
    },
  },
  {
    definition: {
      name: "getRecentSecurityAlerts",
      description:
        "Return recent SIEM alerts for a user or asset (last 24h). Read-only triage data. Does NOT acknowledge, close, or act on alerts.",
      input_schema: {
        type: "object",
        properties: { subject: { type: "string", description: "User email or asset tag" } },
        required: ["subject"],
      },
    },
    handler: (input) =>
      ok({
        subject: input.subject,
        alerts: [
          { id: makeTicketId("ALERT"), type: "impossible_travel", severity: "medium", at: "2026-06-30T03:14:00Z" },
        ],
      }),
  },
  {
    definition: {
      name: "quarantineAccount",
      description:
        "Quarantine (temporarily disable + revoke sessions for) a compromised account. Requires a documented reason of >=20 chars. Returns containment status. Does NOT delete the account or its data.",
      input_schema: {
        type: "object",
        properties: {
          account: { type: "string" },
          reason: { type: "string", description: "Documented reason, >= 20 chars (audit trail)" },
        },
        required: ["account", "reason"],
      },
    },
    handler: (input) =>
      ok({ account: input.account, status: "quarantined", sessionsRevoked: true, ticketId: makeTicketId("SEC") }),
  },
  {
    definition: {
      name: "createSecurityIncident",
      description:
        "Open a formal security incident record for SOC follow-up. Returns an incident id. Does NOT perform containment itself (use quarantineAccount) and does NOT notify regulators.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        },
        required: ["summary", "severity"],
      },
    },
    handler: (input) =>
      ok({ incidentId: makeTicketId("INC"), summary: input.summary, severity: input.severity, status: "open" }),
  },
];
