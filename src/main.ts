import { randomUUID } from "crypto";
import { runCoordinator } from "./coordinator/agent";
import type { TriageResult } from "./coordinator/models";
import type { SpecialistResult, SpecialistTask } from "./specialists/base";
import { runHardwareSpecialist } from "./specialists/hardware";
import { runSoftwareSpecialist } from "./specialists/software";
import { runAccessSpecialist } from "./specialists/access";
import { runSecuritySpecialist } from "./specialists/security";
import { logEvent } from "./logger";

export interface IncomingRequest {
  source: string;
  text: string;
  sender: string;
  timestamp: string;
}

export interface ProcessResult {
  requestId: string;
  action: TriageResult["action"];
  triage: TriageResult;
  specialistResponse?: string;
}

const SPECIALISTS: Record<TriageResult["category"], (task: SpecialistTask) => Promise<SpecialistResult>> = {
  hardware: runHardwareSpecialist,
  software: runSoftwareSpecialist,
  access: runAccessSpecialist,
  security: runSecuritySpecialist,
};

/**
 * Full intake pipeline: coordinator triage → (route) specialist, or hand off to
 * a human (escalate / reject). The PreToolUse hook runs inside the specialist loop.
 */
export async function processRequest(req: IncomingRequest): Promise<ProcessResult> {
  const requestId = randomUUID();

  const triage = await runCoordinator({
    requestId,
    source: req.source,
    text: req.text,
    sender: req.sender,
    timestamp: req.timestamp,
  });

  if (triage.action !== "route") {
    // escalate or reject — no automated action.
    return { requestId, action: triage.action, triage };
  }

  const specialistKey = (triage.specialist ?? triage.category) as TriageResult["category"];
  const runner = SPECIALISTS[specialistKey];
  if (!runner) {
    logEvent({ event: "route_no_specialist", requestId, specialist: specialistKey });
    return { requestId, action: "escalate", triage: { ...triage, action: "escalate", escalationReason: "no_specialist" } };
  }

  const result = await runner({
    requestId,
    originalRequest: req.text,
    classification: triage.category,
    confidence: triage.confidence,
    impactLevel: triage.impact,
    affectedUser: triage.affectedUser,
  });

  return { requestId, action: "route", triage, specialistResponse: result.finalText };
}

// CLI entry: `npx ts-node src/main.ts "<request text>"`
if (require.main === module) {
  (async () => {
    const text = process.argv.slice(2).join(" ") || "Mein Laptop startet nicht mehr nach dem Update.";
    const result = await processRequest({
      source: "email",
      text,
      sender: "max.mueller@company.de",
      timestamp: new Date().toISOString(),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
