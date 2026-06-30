# CLAUDE.md — Frank Says IT Service Desk Agent

## Project Overview

This is an agentic IT service desk intake system built with the Claude Agent SDK (TypeScript).
A coordinator agent classifies incoming IT requests and delegates to specialist subagents.

## Architecture Conventions

### Agent Pattern
- **Coordinator** → classifies, enriches context, routes to specialist
- **Specialists** → execute the actual work using their own tool sets
- Specialists do NOT inherit coordinator context — all relevant context is passed explicitly in the Task prompt
- Always pass: `requestId`, `originalRequest`, `classification`, `confidence`, `impactLevel`

### Tool Design Rules
- Every tool returns structured responses: `{ success: boolean, data?: unknown, error?: { isError: true, reasonCode: string, guidance: string } }`
- Tool descriptions MUST include what the tool does NOT do
- Max 4–5 tools per specialist (reliability degrades beyond this)
- Tool names: `camelCase`, descriptive verbs (`lookupAsset`, `resetPassword`, `createTicket`)

### Escalation Schema
```ts
{
  escalate: true,
  reason: "privileged_account",  // "category" | "confidence_low" | "c_level" | "sensitive_data" | "privileged_account"
  confidence: 0.65,
  impactLevel: "high",           // "low" | "medium" | "high" | "critical"
  requestId: "...",
  summary: "one sentence for human reviewer"
}
```

### PreToolUse Hook
Located in `src/hooks/preToolUseHook.ts`.
- **Hard stops** (block + log, no escalation): bulk access changes, known-bad patterns
- **Escalation triggers** (pause + notify human): admin grant, privileged password reset
- Hook logic must be deterministic — no LLM calls inside the hook

## Code Conventions

- TypeScript (strict mode)
- All inputs/outputs typed via interfaces in `src/models.ts`
- `RequestCategory` enum: `HARDWARE | SOFTWARE | ACCESS | SECURITY | UNKNOWN`
- `ImpactLevel` enum: `LOW | MEDIUM | HIGH | CRITICAL`
- All agents log their reasoning chain, not just the final answer
- Structured JSON logging throughout

## File Structure

```
src/
  coordinator.ts          # Entry point — run with: npx ts-node src/coordinator.ts
  specialists/            # One file per specialist agent
  tools/                  # Tool implementations (not agent logic)
  hooks/                  # PreToolUse hooks
  models.ts               # Shared interfaces and enums
evals/
  dataset.jsonl           # Labeled examples — NEVER delete entries, only append
  runEvals.ts             # Runs against full dataset, outputs scorecard
```

## Eval Conventions

- `dataset.jsonl`: one JSON object per line, fields: `id`, `request`, `expected_category`, `expected_escalate`, `adversarial`
- Adversarial examples MUST have `"adversarial": true` and an `"attack_type"` field
- Scorecard output to stdout as JSON — CI reads this

## What Claude Should NOT Do

- Do not call LLMs inside hooks — hooks must be deterministic
- Do not pass raw user input directly to write tools without schema validation
- Do not create new specialists beyond the four defined — extend tools instead
- Do not skip the validation-retry loop on coordinator output
- Do not log PII (employee names, email addresses) — use `requestId` only in logs
