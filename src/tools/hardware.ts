import { SpecialistTool, ok, fail, makeTicketId } from "./shared";

const ASSET_DB: Record<string, { model: string; status: string; assignedTo: string }> = {
  "LT-4471": { model: "Dell Latitude 7440", status: "active", assignedTo: "employee" },
  "LT-9920": { model: "Lenovo ThinkPad X1", status: "rma_pending", assignedTo: "employee" },
};

export const hardwareTools: SpecialistTool[] = [
  {
    definition: {
      name: "lookupAssetInventory",
      description:
        "Look up a hardware asset by its asset tag (e.g. 'LT-4471') or by the affected user. Returns model, status and assignment. Does NOT order, repair, or modify assets — read-only.",
      input_schema: {
        type: "object",
        properties: {
          assetTag: { type: "string", description: "Asset tag, e.g. LT-4471" },
          user: { type: "string", description: "Affected user (email or name) if asset tag unknown" },
        },
      },
    },
    handler: (input) => {
      const tag = String(input.assetTag ?? "");
      const asset = ASSET_DB[tag];
      if (!asset) {
        return fail(
          "ASSET_NOT_FOUND",
          "No asset matched. Ask the user for the asset tag printed on the device, or look up by user in the HR directory.",
        );
      }
      return ok({ assetTag: tag, ...asset });
    },
  },
  {
    definition: {
      name: "createHardwareTicket",
      description:
        "Create a hardware service ticket (repair, replacement, defect). Returns a ticket id. Does NOT order new peripherals (use orderPeripheral) and does NOT reset accounts.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-line summary of the hardware issue" },
          assetTag: { type: "string", description: "Affected asset tag if known" },
          impact: { type: "string", enum: ["low", "medium", "high", "critical"] },
        },
        required: ["summary"],
      },
    },
    handler: (input) =>
      ok({ ticketId: makeTicketId("HW"), summary: input.summary ?? "", status: "open" }),
  },
  {
    definition: {
      name: "orderPeripheral",
      description:
        "Order a standard catalog peripheral (mouse, keyboard, dock, monitor, headset). Returns an order id. Does NOT order laptops/phones (those need a hardware ticket + approval) and does NOT handle returns.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Catalog item name" },
          quantity: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["item"],
      },
    },
    handler: (input) => {
      const item = String(input.item ?? "").toLowerCase();
      const catalog = ["mouse", "keyboard", "dock", "monitor", "headset", "webcam"];
      if (!catalog.some((c) => item.includes(c))) {
        return fail(
          "ITEM_NOT_IN_CATALOG",
          `"${input.item}" is not a standard peripheral. Restricted/expensive items require a hardware ticket and manager approval.`,
        );
      }
      return ok({ orderId: makeTicketId("ORD"), item: input.item, quantity: input.quantity ?? 1, eta: "3-5 business days" });
    },
  },
  {
    definition: {
      name: "getWarrantyInfo",
      description:
        "Return warranty/coverage status for an asset tag. Read-only. Does NOT file warranty claims or contact the vendor.",
      input_schema: {
        type: "object",
        properties: { assetTag: { type: "string" } },
        required: ["assetTag"],
      },
    },
    handler: (input) => {
      const tag = String(input.assetTag ?? "");
      if (!ASSET_DB[tag]) {
        return fail("ASSET_NOT_FOUND", "Unknown asset tag — cannot determine warranty.");
      }
      return ok({ assetTag: tag, warranty: "active", expiresOn: "2027-03-31", coverage: "next-business-day onsite" });
    },
  },
];
