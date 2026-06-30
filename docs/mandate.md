# Agent Mandate — IT Service Desk Intake

**Audience:** Legal, Compliance, Operations
**Version:** 1.0

---

## What the Agent Decides Alone

- Classifying an incoming request into one of four categories: Hardware, Software/License, Access/Identity, Security
- Routing a classified request to the appropriate specialist subagent
- Closing a request as "duplicate" when an identical open ticket exists (same user, same asset, < 24h)
- Sending a status notification to the requester (read-only communication)

## What the Agent Escalates to a Human

The agent pauses and waits for human approval before proceeding when:

1. **Confidence below threshold** — classification confidence < 0.7
2. **C-Level involved** — requester or affected account is at director level or above
3. **Sensitive system access** — request involves HR, Finance, or Legal systems
4. **Privileged account actions** — any write action targeting accounts with admin, sudo, or service-account roles
5. **Security category** — all Security requests are escalated without exception; the agent only enriches and summarizes, never acts

## What the Agent Must Never Touch

- Bulk access changes affecting more than 5 accounts in a single operation
- Any action on accounts flagged as frozen or under investigation
- Exporting or transmitting PII outside the internal ticketing system
- Modifying audit logs or access history records
- Any action not covered by one of its four tool sets — unknown tool calls are blocked

## What We Are Deliberately Not Automating

- **Final approval for privileged access** — a human must confirm every admin grant, no exceptions
- **Security incident response** — the agent surfaces and summarizes; a human investigates and acts
- **Offboarding** — account deletion and access revocation at termination requires HR sign-off
- **Vendor or third-party provisioning** — any action that crosses the organizational boundary
- **Anything with a dollar amount** — hardware purchases above €0 require manager approval

---

## Governing Rules Summary

| Situation | Agent Action |
|---|---|
| confidence ≥ 0.7, low impact | Route and act |
| confidence < 0.7 | Escalate — do not act |
| C-Level involved | Escalate — do not act |
| Security category | Escalate — enrich only |
| Privileged account write | Block (hook) + escalate |
| Bulk access change | Hard block (hook) |
| Unknown pattern | Hard block (hook) |
