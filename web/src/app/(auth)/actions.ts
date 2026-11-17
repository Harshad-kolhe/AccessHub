'use server';

import { redirect } from 'next/navigation';
import { API_UNREACHABLE, apiPostAnonymous, readApiError } from '@/lib/api';
import { safeNext } from '@/lib/jwt';
import { clearTwoFactorChallenge, clientHeaders, getTwoFactorChallenge, setSession, setTwoFactorChallenge } from '@/lib/session';
import type { AuthResponse } from '@/lib/types';

export interface AuthFormState {
  error?: string;
  /** Which step of sign-in the form shows: the password, or the code from an authenticator app. */
  step?: 'password' | 'two-factor';
  /** A success message for forms that don't navigate away (forgot password). */
  notice?: string;
  /** Echoed back so the form keeps what the user typed (never the password). */
  values?: Record<string, string>;
}

/** Seeded demo accounts behind the badges on the sign-in page. Credentials stay on the server. */
const DEMO_ACCOUNTS: Record<string, { email: string; password: string }> = {
  'org-admin': { email: 'admin@acme.local', password: 'Admin123!' },
  viewer: { email: 'viewer@acme.local', password: 'Viewer123!' },
  'super-admin': { email: 'superadmin@accesshub.local', password: 'SuperAdmin123!' },
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

/** Stores the session from a successful sign-in, or moves the form to the two-factor step. */
async function finishSignIn(response: Response, next: string, values: Record<string, string>): Promise<AuthFormState> {
  const auth = (await response.json()) as AuthResponse;
  if (auth.requiresTwoFactor && auth.challengeToken) {
    await setTwoFactorChallenge(auth.challengeToken);
    return { step: 'two-factor', values };
  }
  if (!auth.tokens) return { error: 'Sign-in failed. Try again.', values };

  await setSession(auth.tokens);
  redirect(safeNext(next));
}

async function signIn(email: string, password: string, next: string): Promise<AuthFormState> {
  const values = { email, next };
  const response = await apiPostAnonymous('/api/auth/login', { email, password }, await clientHeaders());
  if (!response) return { error: API_UNREACHABLE, values };
  if (!response.ok) {
    const error =
      response.status === 401
        ? 'That email and password don’t match an active account.'
        : await readApiError(response, 'Sign-in failed. Try again.');
    return { error, values };
  }
  return finishSignIn(response, next, values);
}

/**
 * The sign-in form's single action. `intent` says which step was submitted: the password, the two-factor code,
 * or "back" from the code step to the password step.
 */
export async function authenticate(state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  switch (formData.get('intent')) {
    case 'code':
      return verifyTwoFactor(state, formData);
    case 'back':
      await clearTwoFactorChallenge();
      return { step: 'password', values: { email: text(formData, 'email'), next: text(formData, 'next') } };
    default:
      return signIn(text(formData, 'email'), String(formData.get('password') ?? ''), text(formData, 'next'));
  }
}

export async function signInWithDemoBadge(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const key = String(formData.get('account') ?? '');
  if (!Object.hasOwn(DEMO_ACCOUNTS, key)) return { error: 'Unknown demo account.' };

  const account = DEMO_ACCOUNTS[key];
  return signIn(account.email, account.password, text(formData, 'next'));
}

/** Second step: the six-digit code from the authenticator app, or one of the recovery codes. */
async function verifyTwoFactor(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = text(formData, 'next');
  const values = { email: text(formData, 'email'), next };
  const challengeToken = await getTwoFactorChallenge();
  if (!challengeToken) return { step: 'password', error: 'That took too long. Enter your email and password again.', values };

  const isRecoveryCode = formData.get('mode') === 'recovery';
  const code = text(formData, 'code');
  if (!code) return { step: 'two-factor', error: isRecoveryCode ? 'Enter a recovery code.' : 'Enter the 6-digit code.', values };

  const response = await apiPostAnonymous('/api/auth/login/two-factor', { challengeToken, code, isRecoveryCode }, await clientHeaders());
  if (!response) return { step: 'two-factor', error: API_UNREACHABLE, values };
  if (!response.ok) {
    const error = await readApiError(response, 'That code didn’t work. Try again.');
    // An expired challenge means starting over; a wrong code means trying again.
    const expired = response.status === 401 && error.startsWith('That took too long');
    if (expired) await clearTwoFactorChallenge();
    return { step: expired ? 'password' : 'two-factor', error, values };
  }

  await clearTwoFactorChallenge();
  return finishSignIn(response, next, values);
}

/** Creates an organization with the caller as its first admin, then signs them in. */
export async function register(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = {
    organizationName: text(formData, 'organizationName'),
    fullName: text(formData, 'fullName'),
    email: text(formData, 'email'),
  };
  const password = String(formData.get('password') ?? '');
  if (password !== String(formData.get('confirmPassword') ?? '')) {
    return { error: 'The two passwords don’t match.', values };
  }

  const response = await apiPostAnonymous('/api/auth/register', { ...values, password }, await clientHeaders());
  if (!response) return { error: API_UNREACHABLE, values };
  if (!response.ok) {
    return { error: await readApiError(response, 'The organization could not be created. Try again.'), values };
  }
  return finishSignIn(response, '/app', values);
}

/** Always answers the same way, so the form can't be used to find out who has an account. */
export async function forgotPassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, 'email');
  const response = await apiPostAnonymous('/api/auth/forgot-password', { email }, await clientHeaders());
  if (!response) return { error: API_UNREACHABLE, values: { email } };
  if (!response.ok) return { error: await readApiError(response, 'Something went wrong. Try again.'), values: { email } };
  return { notice: email, values: { email } };
}

export async function resetPassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, 'email');
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password !== String(formData.get('confirmPassword') ?? '')) return { error: 'The two passwords don’t match.' };

  const response = await apiPostAnonymous('/api/auth/reset-password', { email, token, password }, await clientHeaders());
  if (!response) return { error: API_UNREACHABLE };
  if (!response.ok) return { error: await readApiError(response, 'The password could not be changed. Try again.') };
  redirect('/login?reason=password-reset');
}

export async function acceptInvite(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const userId = text(formData, 'userId');
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password !== String(formData.get('confirmPassword') ?? '')) return { error: 'The two passwords don’t match.' };

  const response = await apiPostAnonymous('/api/auth/accept-invite', { userId, token, password }, await clientHeaders());
  if (!response) return { error: API_UNREACHABLE };
  if (!response.ok) return { error: await readApiError(response, 'The invitation could not be accepted. Try again.') };
  return finishSignIn(response, '/app', {});
}
