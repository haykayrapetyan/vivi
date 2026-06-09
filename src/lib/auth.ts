import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization as organizationPlugin } from "better-auth/plugins";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
} from "@/lib/db/schema";
import { sendMagicLinkEmail, sendOrgInvitationEmail } from "@/lib/email";
import { slugify } from "@/lib/slug";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "Vivi",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, organization, member, invitation },
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  databaseHooks: {
    user: {
      create: {
        // Give every new user a personal organization they own.
        after: async (createdUser) => {
          const name = createdUser.name?.trim() || createdUser.email.split("@")[0];
          const orgId = nanoid();
          await db.insert(organization).values({
            id: orgId,
            name,
            slug: `${slugify(name)}-${nanoid(6)}`,
            createdAt: new Date(),
          });
          await db.insert(member).values({
            id: nanoid(),
            organizationId: orgId,
            userId: createdUser.id,
            role: "owner",
            createdAt: new Date(),
          });
        },
      },
    },
    session: {
      create: {
        // Default the active organization to the user's first membership.
        before: async (s) => {
          const [m] = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, s.userId))
            .limit(1);
          return { data: { ...s, activeOrganizationId: m?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 5,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    organizationPlugin({
      sendInvitationEmail: async (data) => {
        await sendOrgInvitationEmail(data.email, {
          orgName: data.organization.name,
          inviterName:
            data.inviter.user.name || data.inviter.user.email,
          url: `${appUrl}/accept-invitation/${data.id}`,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
