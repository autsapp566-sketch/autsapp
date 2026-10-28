import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe half of the Auth.js config (no Node APIs, no fetch to the API) — imported by
 * middleware.ts. The Credentials provider lives in auth.ts.
 *
 * Sessions are stateless JWTs in an encrypted, httpOnly cookie. The Express API token obtained at
 * login travels inside that JWT (`apiToken`) and is never put on the `session` object.
 */
export const authConfig = {
  // The Express API already owns /api/auth/*, so Auth.js lives under its own prefix.
  basePath: '/api/nextauth',
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.platformRole = user.platformRole;
        token.organizationId = user.organizationId;
        token.apiToken = user.apiToken;
        token.apiTokenExp = user.apiTokenExp;
      }
      // The API token is the real credential: when it expires the web session ends with it.
      if (typeof token.apiTokenExp === 'number' && Date.now() / 1000 >= token.apiTokenExp) {
        return null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.platformRole = token.platformRole;
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
