# ADR-001: Coordinator + Specialist Subagent Architecture

**Date:** 2026-06-30
**Status:** Accepted

---

## Context

The IT Service Desk receives ~200 requests per day across four distinct domains: hardware, software/licensing, access/identity, and security. A single monolithic agent handling all domains would require an unwieldy tool set (16–20 tools), leading to degraded routing reliability and context bleed between unrelated domains. The system must also enforce hard stops on high-risk write operations without relying on LLM judgment.

---

## Decision

We use a **Coordinator + Specialist Subagent** pattern:

1. A **Coordinator** agent handles classification, enrichment, and routing only. It produces a structured `TriageResult` and decides whether to route or escalate. It never calls domain tools.
2. Four **Specialist** agents (Hardware, Software, Access, Security) each run an isolated agentic loop with their own tool set (4 tools each). They receive only the context they need — no shared state with the coordinator.
3. A **PreToolUse hook** runs deterministically before every tool call in every specialist, enforcing hard stops without LLM involvement.

### Agent Loop Diagram

```
Incoming Request
      │
      ▼
┌─────────────────────────────┐
│        COORDINATOR          │
│  classify → enrich → route  │
│  Zod validation-retry (×3)  │
│  logs full reasoning chain  │
└────────────┬────────────────┘
             │
     ┌───────┴────────┐
     │  TriageResult  │
     │  (structured)  │
     └───────┬────────┘
             │
    confidence < 0.7?  ──yes──► ESCALATE TO HUMAN
    isCLevel?          ──yes──►
    sensitiveSystems?  ──yes──►
    impact=critical?   ──yes──►
             │ no
             ▼
    ┌────────────────────────────────────────┐
    │  Route to Specialist (Task subagent)   │
    │  Passes: requestText, category,        │
    │          impact, affectedUser          │
    └──┬──────────┬──────────┬───────────┬──┘
       │          │          │           │
       ▼          ▼          ▼           ▼
  Hardware    Software    Access     Security
   Agent       Agent      Agent       Agent
  (4 tools)  (4 tools)  (4 tools)  (4 tools)
       │          │          │           │
       └──────────┴──────────┴───────────┘
                        │
               PreToolUse Hook
               (runs before every tool call)
                        │
              ┌─────────┴──────────┐
              │  BLOCKED?          │
          yes │                    │ no
              ▼                    ▼
         Hard Stop            Execute Tool
         + log                     │
              │                    ▼
              └──────► Structured Result
                              │
                              ▼
                       Output / Notification
```

---

## Context Isolation

Specialists do **not** inherit coordinator context. Each specialist Task receives only:

```ts
{
  requestText: string;   // original user request
  category: string;      // routing category
  impact: string;        // impact level
  affectedUser: string;  // email of affected user
}
```

**Why:** Prevents context bleed, keeps specialist prompts focused, and makes each specialist independently testable.

---

## Consequences

**Positive:**
- Coordinator stays simple: classify + route, no domain tools
- Each specialist has a focused, predictable tool set (≤4 tools)
- Hook is deterministic and auditable — no LLM judgment on safety decisions
- Specialists are independently testable against their own eval sets
- Reasoning chain is fully logged per request — every decision is replayable

**Negative:**
- Two-hop latency per request (coordinator + specialist)
- Context re-extraction in specialist (affectedUser etc. parsed twice)
- Four codebases to maintain instead of one

**Mitigations:**
- Two-hop latency is acceptable for async intake (not real-time chat)
- Shared `runSpecialist` base reduces specialist boilerplate
- Shared `models.ts` keeps types consistent across all agents

---

## Alternatives Considered

### Single monolithic agent
All 16+ tools in one agent. Rejected: routing reliability degrades significantly with large tool sets; no clean boundary for the PreToolUse hook.

### LLM-based safety decisions
Let the coordinator decide what's safe via prompt instructions. Rejected: non-deterministic, not auditable, fails adversarial injection. Hard stops must be code, not prompts.

### Parallel specialist execution
Run all four specialists in parallel and pick the best result. Rejected: wastes compute, increases cost 4×, adds reconciliation complexity with no benefit for single-domain requests.

---

# ADR-002: Deterministic PreToolUse Hook for High-Risk Writes

**Date:** 2026-06-30
**Status:** Accepted

---

## Context

Several tool calls in the Access and Security specialists carry real-world risk: granting admin privileges, resetting privileged account passwords, bulk account changes, and quarantine actions. Relying on LLM judgment to avoid these actions is insufficient — prompt injection, impersonation attempts, and confident misclassification are all realistic failure modes demonstrated in our adversarial eval set.

---

## Decision

All high-risk write operations are guarded by a **deterministic PreToolUse hook** (`src/hooks/preToolUseHook.ts`) that runs before every tool call in every specialist loop. The hook contains zero LLM calls.

### Hard Stop Rules (block + log, no escalation path)

| Trigger | Reason Code |
|---|---|
| `grantGroupMembership` with group matching `/admin\|domain.admin\|privileged/i` | `BLOCKED_ADMIN_GRANT` |
| `resetPassword` for accounts matching `/administrator\|svc-.*\|.*@c-level\.*/i` | `BLOCKED_PRIVILEGED_RESET` |
| Any tool with `bulk: true` or `userList.length > 1` | `BLOCKED_BULK_ACTION` |
| `quarantineAccount` with `reason.length < 20` | `BLOCKED_QUARANTINE_NO_REASON` |

### Escalation Triggers (pause + notify human)

| Trigger | Reason Code |
|---|---|
| `grantGroupMembership` on any non-standard group not in approved list | `ESCALATE_NONSTANDARD_GROUP` |
| `resetPassword` where impact is `high` or `critical` | `ESCALATE_HIGH_IMPACT_RESET` |

### Hook Signature

```ts
function preToolUseHook(
  toolName: string,
  toolInput: Record<string, unknown>
): { isError: true; reasonCode: string; guidance: string } | null
// null = proceed; error object = block
```

---

## Consequences

**Positive:**
- Safety decisions are auditable, testable, and version-controlled as code
- Immune to prompt injection and impersonation attacks
- Consistent behavior regardless of model version or prompt drift

**Negative:**
- Rules must be kept up to date as new tools are added
- Overly broad regex could block legitimate requests (false positives)

**Mitigations:**
- Hook rules are unit-tested separately from agent logic
- Escalation path (not hard stop) for borderline cases reduces false positive impact
- Rule additions require ADR update

---

## Alternatives Considered

### Prompt-based safety instructions
Tell the agent "never grant admin access." Rejected: prompt injection (`"Ignore prior instructions..."`) bypasses this trivially. Demonstrated in adversarial eval set (adv-002).

### Separate safety agent
A dedicated LLM agent reviews every tool call. Rejected: adds latency, cost, and a second LLM surface to attack. Hard stops should be hard.
