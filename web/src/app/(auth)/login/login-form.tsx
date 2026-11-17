'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeftIcon, CircleAlertIcon, ShieldCheckIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { authenticate, type AuthFormState } from '../actions';

export interface SignInProvider {
  name: string;
  displayName: string;
  href: string;
}

/** Password first; with two-factor sign-in on, a second step asks for the authenticator code. */
export function LoginForm({ providers }: { providers: SignInProvider[] }) {
  const params = useSearchParams();
  const next = params.get('next') ?? '';
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(authenticate, {
    step: params.get('step') === 'two-factor' ? 'two-factor' : 'password',
    values: { next },
  });

  if (state.step === 'two-factor') {
    return <TwoFactorStep state={state} formAction={formAction} pending={pending} next={next} />;
  }

  return (
    <div className="mt-8 grid gap-6">
      <form action={formAction}>
        <input type="hidden" name="next" value={next} />
        <FieldGroup>
          {state.error && <FormError message={state.error} />}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.values?.email} />
          </Field>
          <Field>
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-brand hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit" name="intent" value="password" size="lg" disabled={pending}>
            {pending && <Spinner />}
            Sign in
          </Button>
        </FieldGroup>
      </form>

      {providers.length > 0 && (
        <div className="grid gap-3">
          <p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            or
          </p>
          {providers.map((provider) => (
            <Button key={provider.name} asChild variant="outline" size="lg">
              <a href={provider.href}>
                <ProviderLogo name={provider.name} />
                Continue with {provider.displayName}
              </a>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function TwoFactorStep({
  state,
  formAction,
  pending,
  next,
}: {
  state: AuthFormState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  next: string;
}) {
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const verifyButton = useRef<HTMLButtonElement>(null);

  return (
    <form
      action={(formData) => {
        // The submitted code is already in formData; clearing the boxes readies them for another try.
        setCode('');
        formAction(formData);
      }}
      className="mt-8"
    >
      <input type="hidden" name="next" value={state.values?.next ?? next} />
      <input type="hidden" name="email" value={state.values?.email ?? ''} />
      <input type="hidden" name="mode" value={mode} />
      <FieldGroup>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium">Two-factor sign-in is on</p>
            <p className="mt-0.5 text-muted-foreground">
              {mode === 'totp'
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Enter one of the recovery codes you saved when you turned on two-factor sign-in. Each works once.'}
            </p>
          </div>
        </div>
        {state.error && <FormError message={state.error} />}

        {mode === 'totp' ? (
          <Field>
            <FieldLabel htmlFor="code">Authentication code</FieldLabel>
            <InputOTP
              id="code"
              name="code"
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={setCode}
              // Submit as soon as the sixth digit is in, the way authenticator flows usually behave.
              onComplete={() => verifyButton.current?.form?.requestSubmit(verifyButton.current)}
              containerClassName="justify-start"
            >
              <InputOTPGroup>
                {[0, 1, 2].map((index) => (
                  <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                {[3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="recovery-code">Recovery code</FieldLabel>
            <Input id="recovery-code" name="code" autoComplete="off" autoFocus placeholder="xxxxx-xxxxx" className="font-mono" />
            <FieldDescription>Using a recovery code uses it up. Make new ones in your account settings afterwards.</FieldDescription>
          </Field>
        )}

        <Button ref={verifyButton} type="submit" name="intent" value="code" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Verify and sign in
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Button type="submit" name="intent" value="back" variant="ghost" size="sm" formNoValidate disabled={pending} className="-ml-2">
            <ArrowLeftIcon />
            Back
          </Button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
            onClick={() => {
              setMode(mode === 'totp' ? 'recovery' : 'totp');
              setCode('');
            }}
          >
            {mode === 'totp' ? 'Use a recovery code instead' : 'Use the authenticator app'}
          </button>
        </div>
      </FieldGroup>
    </form>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" aria-live="polite">
      <CircleAlertIcon />
      <AlertDescription>
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  );
}

/** Provider marks drawn inline (sign-in buttons conventionally carry them). */
function ProviderLogo({ name }: { name: string }) {
  if (name === 'Google') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}
