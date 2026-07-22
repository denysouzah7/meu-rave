import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "../database/client.js";
import { accounts, sessions, users, verifications } from "../database/schema.js";
import { clientOrigins, env } from "../config/env.js";
import { createId } from "../utils/id.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications
    }
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: clientOrigins,
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Swap this for a transactional email provider in production.
      console.info(`[auth] Password reset for ${user.email}: ${url}`);
    },
    onPasswordReset: async ({ user }) => {
      console.info(`[auth] Password reset completed for ${user.email}`);
    }
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "participant"
      },
      isBlocked: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false
      },
      blockedReason: {
        type: "string",
        required: false,
        input: false
      },
      profileTheme: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "neon"
      }
    }
  },
  advanced: {
    database: {
      generateId: () => createId("auth")
    }
  }
});
