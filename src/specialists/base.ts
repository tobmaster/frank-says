import type Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "../client";
import { preToolUseHook } from "../hooks/preToolUseHook";
import { SpecialistTool, ToolResponse } from "../tools/shared";
import { logEvent } from "../logger";

/**
 * Context handed to a specialist. The coordinator passes ONLY this — specialists
 * are isolated agentic loops and do not inherit coordinator context. Fields
 * follow CLAUDE.md: requestId, originalRequest, classification, confidence,
 * impactLevel (+ affectedUser for the specialist to act on).
 */
export interface SpecialistTask {
  requestId: string;
  originalRequest: string; // raw user text
  classification: string; // category
  confidence: number;
  impactLevel: string; // impact
  affectedUser: string;
}

export interface ToolCallRecord {
  tool: string;
  blocked: boolean;
  reasonCode?: string;
}

export interface SpecialistResult {
  name: string;
  finalText: string;
  toolCalls: ToolCallRecord[];
  blocked: ToolCallRecord[];
  iterations: number;
}

const MAX_ITERATIONS = 8;

function buildTaskPrompt(task: SpecialistTask): string {
  return [
    "A new IT request has been routed to you. Resolve it end-to-end using your tools, or explain why it must go to a human.",
    "",
    `requestId: ${task.requestId}`,
    `classification: ${task.classification}`,
    `impactLevel: ${task.impactLevel}`,
    `confidence: ${task.confidence}`,
    `affectedUser: ${task.affectedUser}`,
    "",
    "Original request:",
    task.originalRequest,
    "",
    "When you are done, give a short summary of what you did (or what a human must do). If a tool call is blocked by policy, do not retry it — explain and recommend escalation.",
  ].join("\n");
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Shared agentic loop for all specialists. Runs the model with the given tools,
 * executing each tool call through the deterministic PreToolUse hook first.
 */
export async function runSpecialist(
  task: SpecialistTask,
  system: string,
  tools: SpecialistTool[],
  name: string,
): Promise<SpecialistResult> {
  const toolDefs = tools.map((t) => t.definition);
  const handlers = new Map(tools.map((t) => [t.definition.name, t.handler]));
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildTaskPrompt(task) }];

  const toolCalls: ToolCallRecord[] = [];
  const blocked: ToolCallRecord[] = [];
  let finalText = "";
  let iterations = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations = i + 1;
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      tools: toolDefs,
      messages,
    });

    // Preserve full content (incl. thinking blocks) for correct multi-turn replay.
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason !== "tool_use") {
      finalText = textOf(resp.content);
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const blockItem of resp.content) {
      if (blockItem.type !== "tool_use") continue;
      const input = (blockItem.input ?? {}) as Record<string, unknown>;

      const hookError = preToolUseHook(blockItem.name, input);
      let response: ToolResponse;
      if (hookError) {
        response = { success: false, error: hookError };
        const rec = { tool: blockItem.name, blocked: true, reasonCode: hookError.reasonCode };
        toolCalls.push(rec);
        blocked.push(rec);
        logEvent({ event: "hook_block", requestId: task.requestId, specialist: name, tool: blockItem.name, reasonCode: hookError.reasonCode });
      } else {
        const handler = handlers.get(blockItem.name);
        response = handler
          ? handler(input)
          : { success: false, error: { isError: true, reasonCode: "UNKNOWN_TOOL", guidance: `No such tool: ${blockItem.name}` } };
        toolCalls.push({ tool: blockItem.name, blocked: false });
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: blockItem.id,
        content: JSON.stringify(response),
        is_error: !response.success,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  logEvent({ event: "specialist_done", requestId: task.requestId, specialist: name, iterations, toolCalls: toolCalls.length, blocked: blocked.length });
  return { name, finalText, toolCalls, blocked, iterations };
}
