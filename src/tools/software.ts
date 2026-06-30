import { SpecialistTool, ok, fail, makeTicketId } from "./shared";

const CATALOG: Record<string, { seatsTotal: number; seatsUsed: number; requiresApproval: boolean }> = {
  "microsoft 365": { seatsTotal: 2000, seatsUsed: 1840, requiresApproval: false },
  slack: { seatsTotal: 2000, seatsUsed: 1990, requiresApproval: false },
  "adobe creative cloud": { seatsTotal: 50, seatsUsed: 50, requiresApproval: true },
  jetbrains: { seatsTotal: 120, seatsUsed: 118, requiresApproval: true },
  figma: { seatsTotal: 80, seatsUsed: 61, requiresApproval: false },
};

function findProduct(name: string) {
  const key = name.trim().toLowerCase();
  const match = Object.keys(CATALOG).find((k) => key.includes(k) || k.includes(key));
  return match ? { name: match, ...CATALOG[match] } : null;
}

export const softwareTools: SpecialistTool[] = [
  {
    definition: {
      name: "lookupSoftwareCatalog",
      description:
        "Look up an application in the company software catalog. Returns whether it exists, total/used seats and whether it needs approval. Read-only. Does NOT grant access or buy licenses.",
      input_schema: {
        type: "object",
        properties: { product: { type: "string", description: "Application name" } },
        required: ["product"],
      },
    },
    handler: (input) => {
      const p = findProduct(String(input.product ?? ""));
      if (!p) {
        return fail(
          "PRODUCT_NOT_IN_CATALOG",
          "Application not in the approved catalog. New software requires a security & procurement review.",
        );
      }
      return ok(p);
    },
  },
  {
    definition: {
      name: "checkLicenseAvailability",
      description:
        "Check if a free license seat is available for a catalog product. Read-only. Does NOT reserve, grant, or purchase seats.",
      input_schema: {
        type: "object",
        properties: { product: { type: "string" } },
        required: ["product"],
      },
    },
    handler: (input) => {
      const p = findProduct(String(input.product ?? ""));
      if (!p) return fail("PRODUCT_NOT_IN_CATALOG", "Unknown product — cannot check license availability.");
      const available = p.seatsTotal - p.seatsUsed;
      return ok({ product: p.name, seatsAvailable: available, hasFreeSeat: available > 0 });
    },
  },
  {
    definition: {
      name: "provisionSoftwareAccess",
      description:
        "Grant a user access to a catalog product that has a free seat and does not require manual approval. Returns provisioning status. Does NOT purchase new licenses and does NOT grant admin roles.",
      input_schema: {
        type: "object",
        properties: {
          product: { type: "string" },
          user: { type: "string", description: "Affected user (email)" },
        },
        required: ["product", "user"],
      },
    },
    handler: (input) => {
      const p = findProduct(String(input.product ?? ""));
      if (!p) return fail("PRODUCT_NOT_IN_CATALOG", "Unknown product — cannot provision.");
      if (p.requiresApproval) {
        return fail(
          "APPROVAL_REQUIRED",
          `${p.name} requires manager approval before provisioning. Use requestLicensePurchase or route to approval workflow.`,
        );
      }
      if (p.seatsTotal - p.seatsUsed <= 0) {
        return fail("NO_FREE_SEATS", `No free ${p.name} seats. Use requestLicensePurchase to buy one.`);
      }
      return ok({ product: p.name, user: input.user, status: "provisioned" });
    },
  },
  {
    definition: {
      name: "requestLicensePurchase",
      description:
        "Open a purchase request for an additional software license (when no free seat exists or approval is required). Returns a request id. Does NOT actually buy or auto-approve — it queues for procurement.",
      input_schema: {
        type: "object",
        properties: {
          product: { type: "string" },
          justification: { type: "string" },
        },
        required: ["product"],
      },
    },
    handler: (input) =>
      ok({ requestId: makeTicketId("LIC"), product: input.product, status: "pending_procurement" }),
  },
];
