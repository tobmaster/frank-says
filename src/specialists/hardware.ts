import { runSpecialist, SpecialistTask, SpecialistResult } from "./base";
import { hardwareTools } from "../tools/hardware";

const SYSTEM = `You are the Hardware Specialist on an IT service desk.
You handle laptops/desktops, peripherals, asset inventory and warranty questions.
Use your tools to resolve the request: look up the asset, then create a ticket, order a peripheral, or report warranty status as appropriate.
Be concise. Never invent asset tags or ticket ids — only report what tools return. If you cannot resolve it with your tools, say what a human must do.`;

export function runHardwareSpecialist(task: SpecialistTask): Promise<SpecialistResult> {
  return runSpecialist(task, SYSTEM, hardwareTools, "hardware");
}
