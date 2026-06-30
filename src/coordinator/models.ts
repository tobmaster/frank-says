import { z } from "zod";

/**
 * Structured triage output produced by the coordinator. The model is forced to
 * emit exactly this shape via tool-use; the result is then validated with Zod
 * (retry loop) and post-processed by the deterministic escalation rules.
 */
export const TriageResult = z.object({
  category: z.enum(["hardware", "software", "access", "security"]),
  confidence: z.number().min(0).max(1),
  impact: z.enum(["low", "medium", "high", "critical"]),
  affectedUser: z.string(),
  isCLevel: z.boolean(),
  involvesSensitiveSystems: z.boolean(),
  reasoning: z.string(), // full reasoning chain — logged verbatim
  action: z.enum(["route", "escalate", "reject"]),
  specialist: z.enum(["hardware", "software", "access", "security"]).optional(),
  escalationReason: z.string().optional(),
});

export type TriageResult = z.infer<typeof TriageResult>;

export type RequestCategory = TriageResult["category"];
export type ImpactLevel = TriageResult["impact"];
export type TriageAction = TriageResult["action"];
