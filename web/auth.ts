import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { apiPost } from './lib/api';
import { validateEmail } from './lib/validation';

/** Surfaces the API's reason (e.g. EMAIL_NOT_VERIFIED) to the login action via `error.code`. */
class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

function jwtExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

type LoginResponse = {
  token: string;
  user: { id: string; email: string; role: string; platformRole?: string; organizationId: string };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (validateEmail(email) || !password) throw new LoginError('INVALID_CREDENTIALS');

        // Password verification (bcrypt), rate limiting and the e-mail-verified check all live in the API.
        const res = await apiPost<LoginResponse>('/api/auth/login', { email, password });
        if (!res.ok) throw new LoginError(res.data.code ?? (res.status === 401 ? 'INVALID_CREDENTIALS' : 'SERVER_ERROR'));

        const { token, user } = res.data;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          platformRole: user.platformRole,
          organizationId: user.organizationId,
          apiToken: token,
          apiTokenExp: jwtExpiry(token),
        };
      },
    }),
  ],
});
