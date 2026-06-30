import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Single shared model id for the whole system. The plan named `claude-opus-4-6`;
 * we default to the current most-capable Opus tier. Change here only.
 */
export const MODEL = "claude-opus-4-8";

/** Shared client. Reads ANTHROPIC_API_KEY from the environment (.env via dotenv). */
export const client = new Anthropic();
