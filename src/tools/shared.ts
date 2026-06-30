import type Anthropic from "@anthropic-ai/sdk";

/**
 * Structured error returned by tools and by the PreToolUse hook.
 * `isError` is always true so it can be discriminated cheaply.
 */
export interface ToolError {
  isError: true;
  reasonCode: string;
  guidance: string;
}

/**
 * Every tool returns this envelope (see CLAUDE.md "Tool Design Rules").
 * On success: { success: true, data }. On failure: { success: false, error }.
 */
export interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: ToolError;
}

/** A specialist tool bundles its wire definition with its (stub) implementation. */
export interface SpecialistTool {
  definition: Anthropic.Tool;
  handler: (input: Record<string, unknown>) => ToolResponse;
}

export function ok(data: unknown): ToolResponse {
  return { success: true, data };
}

export function fail(reasonCode: string, guidance: string): ToolResponse {
  return { success: false, error: { isError: true, reasonCode, guidance } };
}

let ticketCounter = 1000;

/** Deterministic-ish fake ticket id for stub tools. */
export function makeTicketId(prefix: string): string {
  ticketCounter += 1;
  return `${prefix}-${ticketCounter}`;
}

/**
 * Stub "send a notification" used internally by tool handlers. Does not expose
 * a separate agent tool — keeps specialists at <=4 tools (reliability rule).
 */
export function sendNotification(channel: string, summary: string): { delivered: true; channel: string; summary: string } {
  return { delivered: true, channel, summary };
}
