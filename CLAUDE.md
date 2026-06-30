# CLAUDE.md — Frank Says IT Service Desk Agent

## Project Overview

This is an agentic IT service desk intake system built with the Claude Agent SDK (Typescript).
A coordinator agent classifies incoming IT requests and delegates to specialist subagents.

## Architecture Conventions

### Agent Pattern
- **Coordinator** → classifies, enriches context, routes to specialist
- **Specialists** → execute the actual work using their own tool sets
- Specialists do NOT inherit coordinator context — all relevant context is passed explicitly in the Task prompt
- Always pass: `request_id`, `original_request`, `classification`, `confidence`, `impact_level`

### Tool Design Rules
- Every tool returns structured responses: `{ "success": true/false, "data": ..., "error": { "isError": true, "reasonCode": "...", "guidance": "..." } }`
- Tool descriptions MUST include what the tool does NOT do
- Max 4–5 tools per specialist (reliability degrades beyond this)
- Tool names: `snake_case`, descriptive verbs (`lookup_asset`, `reset_password`, `create_ticket`)

### Escalation Schema
```python
{
  "escalate": True,
  "reason": "privileged_account",       # category | confidence_low | c_level | sensitive_data | privileged_account
  "confidence": 0.65,
  "impact_level": "high",               # low | medium | high | critical
  "request_id": "...",
  "summary": "one sentence for human reviewer"
}
```

### PreToolUse Hook
Located in `src/hooks/pretooluse_hook.py`.
- **Hard stops** (block + log, no escalation): bulk access changes, known-bad patterns
- **Escalation triggers** (pause + notify human): admin grant, privileged password reset
- Hook logic must be deterministic — no LLM calls inside the hook

## Code Conventions

- Python 3.11+
- Type hints everywhere
- Pydantic models for all inputs/outputs (`src/models.py`)
- `RequestCategory` enum: `HARDWARE | SOFTWARE | ACCESS | SECURITY | UNKNOWN`
- `ImpactLevel` enum: `LOW | MEDIUM | HIGH | CRITICAL`
- All agents log their reasoning chain, not just the final answer
- Use `structlog` for structured logging (JSON output)

## File Structure

```
src/
  coordinator.py          # Entry point — run with: python -m src.coordinator
  specialists/            # One file per specialist agent
  tools/                  # Tool implementations (not agent logic)
  hooks/                  # PreToolUse hooks
  models.py               # Pydantic models shared across agents
evals/
  dataset.jsonl           # Labeled examples — NEVER delete entries, only append
  run_evals.py            # Runs against full dataset, outputs scorecard
```

## Eval Conventions

- `dataset.jsonl`: one JSON object per line, fields: `id`, `request`, `expected_category`, `expected_escalate`, `adversarial`
- Adversarial examples MUST have `"adversarial": true` and a `"attack_type"` field
- Scorecard output to stdout as JSON — CI reads this

## What Claude Should NOT Do

- Do not call LLMs inside hooks — hooks must be deterministic
- Do not pass raw user input directly to write tools without schema validation
- Do not create new specialists beyond the four defined — extend tools instead
- Do not skip the validation-retry loop on coordinator output
- Do not log PII (employee names, email addresses) — use `request_id` only in logs
