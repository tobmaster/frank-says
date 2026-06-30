import { SpecialistTool, ok, fail, makeTicketId } from "./shared";

const DIRECTORY: Record<string, { displayName: string; status: string; locked: boolean }> = {
  "max.mueller@company.de": { displayName: "M. Mueller", status: "active", locked: false },
  "anna.schmidt@company.de": { displayName: "A. Schmidt", status: "active", locked: true },
};

export const accessTools: SpecialistTool[] = [
  {
    definition: {
      name: "lookupAdUser",
      description:
        "Look up an Active Directory user by email. Returns display name, account status and lock state. Read-only. Does NOT modify the account, reset passwords, or change group membership.",
      input_schema: {
        type: "object",
        properties: { user: { type: "string", description: "User email" } },
        required: ["user"],
      },
    },
    handler: (input) => {
      const u = String(input.user ?? "").toLowerCase();
      const entry = DIRECTORY[u];
      if (!entry) return fail("USER_NOT_FOUND", "No AD user matched that email. Verify the address with the requester.");
      return ok({ user: u, ...entry });
    },
  },
  {
    definition: {
      name: "checkAccountStatus",
      description:
        "Check whether an account is active/locked/disabled and recent sign-in state. Read-only. Does NOT unlock or reset anything.",
      input_schema: {
        type: "object",
        properties: { user: { type: "string" } },
        required: ["user"],
      },
    },
    handler: (input) => {
      const u = String(input.user ?? "").toLowerCase();
      const entry = DIRECTORY[u];
      if (!entry) return fail("USER_NOT_FOUND", "Unknown account.");
      return ok({ user: u, status: entry.status, locked: entry.locked, lastSignIn: "2026-06-29T08:12:00Z" });
    },
  },
  {
    definition: {
      name: "resetPassword",
      description:
        "Trigger a self-service password reset for a STANDARD user account. Returns a reset confirmation. Does NOT reset privileged/administrator/service/C-Level accounts (those are blocked by policy) and does NOT bypass identity verification.",
      input_schema: {
        type: "object",
        properties: {
          account: { type: "string", description: "Account/email to reset" },
        },
        required: ["account"],
      },
    },
    handler: (input) =>
      ok({ account: input.account, status: "reset_link_sent", channel: "registered_secondary_email" }),
  },
  {
    definition: {
      name: "grantGroupMembership",
      description:
        "Add a user to a STANDARD (non-privileged) AD/security group, e.g. a team distribution list or a project share. Returns membership status. Does NOT grant admin/domain-admin/privileged groups (blocked by policy) and does NOT create new groups.",
      input_schema: {
        type: "object",
        properties: {
          user: { type: "string" },
          group: { type: "string" },
        },
        required: ["user", "group"],
      },
    },
    handler: (input) =>
      ok({ user: input.user, group: input.group, status: "member_added", ticketId: makeTicketId("ACC") }),
  },
];
