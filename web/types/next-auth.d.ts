import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role?: string;
    platformRole?: string;
    organizationId?: string;
    apiToken?: string;
    apiTokenExp?: number;
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      platformRole?: string;
      organizationId?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    platformRole?: string;
    organizationId?: string;
    apiToken?: string;
    apiTokenExp?: number;
  }
}
