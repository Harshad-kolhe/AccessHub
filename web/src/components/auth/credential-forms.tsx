'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CircleAlertIcon, MailCheckIcon } from 'lucide-react';
import { acceptInvite, forgotPassword, resetPassword, type AuthFormState } from '@/app/(auth)/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const PASSWORD_RULES = 'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.';

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" aria-live="polite">
      <CircleAlertIcon />
      <AlertDescription>
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  );
}

function NewPasswordFields() {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <FieldDescription>{PASSWORD_RULES}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="confirmPassword">Repeat the password</FieldLabel>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(forgotPassword, {});

  if (state.notice) {
    return (
      <Alert className="mt-8">
        <MailCheckIcon />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          <p>
            If <span className="font-medium text-foreground">{state.notice}</span> belongs to an account, a link to choose a
            new password is on its way. It works once, for 2 hours.
          </p>
          <p className="mt-2">
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="mt-8">
      <FieldGroup>
        <FormError message={state.error} />
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.values?.email} />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Send reset link
        </Button>
      </FieldGroup>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(resetPassword, {});

  if (!email || !token) return <BrokenLink kind="reset" />;

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <FormError message={state.error} />
        <Field>
          <FieldLabel htmlFor="account">Account</FieldLabel>
          <Input id="account" value={email} readOnly disabled autoComplete="username" />
        </Field>
        <NewPasswordFields />
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Change password
        </Button>
      </FieldGroup>
    </form>
  );
}

export function AcceptInviteForm() {
  const params = useSearchParams();
  const userId = params.get('user') ?? '';
  const token = params.get('token') ?? '';
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(acceptInvite, {});

  if (!userId || !token) return <BrokenLink kind="invitation" />;

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <FormError message={state.error} />
        <NewPasswordFields />
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Set password and sign in
        </Button>
      </FieldGroup>
    </form>
  );
}

function BrokenLink({ kind }: { kind: 'reset' | 'invitation' }) {
  return (
    <Alert variant="destructive" className="mt-8">
      <CircleAlertIcon />
      <AlertTitle>This link is incomplete</AlertTitle>
      <AlertDescription>
        <p>
          {kind === 'reset'
            ? 'Open the link from the email again, or ask for a new one.'
            : 'Open the link from the invitation email again, or ask the person who invited you to send a new one.'}
        </p>
        {kind === 'reset' && (
          <p className="mt-2">
            <Link href="/forgot-password" className="font-medium underline underline-offset-4">
              Send a new reset link
            </Link>
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
