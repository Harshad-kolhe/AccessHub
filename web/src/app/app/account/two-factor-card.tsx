'use client';

import { useState, useTransition } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { CheckIcon, CopyIcon, DownloadIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { disableTwoFactor, enableTwoFactor, newRecoveryCodes, startTwoFactorSetup, type TwoFactorSetup } from './actions';

type Step = { name: 'idle' } | { name: 'scan'; setup: TwoFactorSetup } | { name: 'codes'; codes: string[] } | { name: 'confirm'; purpose: 'disable' | 'codes' };

function CodeInput({ id, value, onChange, onComplete }: { id: string; value: string; onChange: (value: string) => void; onComplete?: () => void }) {
  return (
    <InputOTP id={id} maxLength={6} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" value={value} onChange={onChange} onComplete={onComplete} containerClassName="justify-start">
      <InputOTPGroup>
        {[0, 1, 2].map((index) => (
          <InputOTPSlot key={index} index={index} className="size-10 text-base" />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {[3, 4, 5].map((index) => (
          <InputOTPSlot key={index} index={index} className="size-10 text-base" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** Turn two-factor sign-in on (scan, confirm a code, save recovery codes) or off. */
export function TwoFactorCard({ enabled, recoveryCodesLeft, email }: { enabled: boolean; recoveryCodesLeft: number; email: string }) {
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      setError('');
      await task();
    });

  const begin = () =>
    run(async () => {
      const result = await startTwoFactorSetup();
      if (result.ok && result.data) setStep({ name: 'scan', setup: result.data });
      else if (!result.ok) setError(result.error);
    });

  const confirmEnable = () =>
    run(async () => {
      const result = await enableTwoFactor(code);
      setCode('');
      if (!result.ok) return setError(result.error);
      toast.success('Two-factor sign-in is on');
      setStep({ name: 'codes', codes: result.data?.recoveryCodes ?? [] });
    });

  const confirmWithCode = (purpose: 'disable' | 'codes') =>
    run(async () => {
      if (purpose === 'disable') {
        const result = await disableTwoFactor(code);
        setCode('');
        if (!result.ok) return setError(result.error);
        toast.success('Two-factor sign-in is off');
        setStep({ name: 'idle' });
      } else {
        const result = await newRecoveryCodes(code);
        setCode('');
        if (!result.ok) return setError(result.error);
        setStep({ name: 'codes', codes: result.data?.recoveryCodes ?? [] });
      }
    });

  const errorLine = error && (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  );

  if (step.name === 'codes') return <RecoveryCodes codes={step.codes} email={email} onDone={() => setStep({ name: 'idle' })} />;

  if (step.name === 'scan') {
    return (
      <div className="grid gap-5">
        <ol className="grid gap-5 text-sm">
          <li className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-5">
            <div
              className="size-40 rounded-lg border bg-white p-2.5 [&_svg]:size-full"
              role="img"
              aria-label="QR code for your authenticator app"
              dangerouslySetInnerHTML={{ __html: step.setup.qrSvg }}
            />
            <div className="grid gap-2">
              <p className="font-medium">1. Scan this with an authenticator app</p>
              <p className="text-muted-foreground">Google Authenticator, Microsoft Authenticator, 1Password and others all work.</p>
              <p className="text-muted-foreground">Can’t scan? Enter this key instead:</p>
              <code className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-[0.8rem] tracking-wider break-all">{step.setup.sharedKey}</code>
            </div>
          </li>
          <li className="grid gap-2">
            <p className="font-medium">2. Enter the 6-digit code it shows</p>
            <CodeInput id="enable-code" value={code} onChange={setCode} onComplete={confirmEnable} />
          </li>
        </ol>
        {errorLine}
        <div className="flex gap-2">
          <Button onClick={confirmEnable} disabled={pending || code.length !== 6}>
            {pending && <Spinner />}
            Turn on
          </Button>
          <Button variant="ghost" onClick={() => setStep({ name: 'idle' })} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === 'confirm') {
    return (
      <div className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="confirm-code">Code from your authenticator app</FieldLabel>
          <CodeInput id="confirm-code" value={code} onChange={setCode} onComplete={() => confirmWithCode(step.purpose)} />
          <FieldDescription>
            {step.purpose === 'disable' ? 'Sign-in will only need your password again.' : 'Your old recovery codes stop working.'}
          </FieldDescription>
        </Field>
        {errorLine}
        <div className="flex gap-2">
          <Button variant={step.purpose === 'disable' ? 'destructive' : 'default'} onClick={() => confirmWithCode(step.purpose)} disabled={pending || code.length !== 6}>
            {pending && <Spinner />}
            {step.purpose === 'disable' ? 'Turn off two-factor sign-in' : 'Make new codes'}
          </Button>
          <Button variant="ghost" onClick={() => setStep({ name: 'idle' })} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return enabled ? (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-granted" aria-hidden="true" />
        <div className="text-sm">
          <p className="flex items-center gap-2 font-medium">
            Two-factor sign-in is on <Badge variant="outline">Authenticator app</Badge>
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Signing in needs your password and a code from your phone. {recoveryCodesLeft} recovery {recoveryCodesLeft === 1 ? 'code' : 'codes'} left.
          </p>
        </div>
      </div>
      {errorLine}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setStep({ name: 'confirm', purpose: 'codes' })}>
          New recovery codes
        </Button>
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setStep({ name: 'confirm', purpose: 'disable' })}>
          <ShieldOffIcon />
          Turn off
        </Button>
      </div>
    </div>
  ) : (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Add a code from your phone to every sign-in, so a stolen password isn’t enough. Wrong codes count towards the same lockout as
        wrong passwords.
      </p>
      {errorLine}
      <Button onClick={begin} disabled={pending} className="justify-self-start">
        {pending ? <Spinner /> : <ShieldCheckIcon />}
        Set up two-factor sign-in
      </Button>
    </div>
  );
}

function RecoveryCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `AccessHub recovery codes for ${email}\nEach code works once.\n\n${codes.join('\n')}\n`;

  return (
    <div className="grid gap-4">
      <div className="text-sm">
        <p className="font-medium">Save your recovery codes</p>
        <p className="mt-0.5 text-muted-foreground">If you lose your phone, each of these signs you in once. This is the only time they’re shown.</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-4">
        {codes.map((recoveryCode) => (
          <li key={recoveryCode} className="tabular">
            {recoveryCode}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" asChild>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="accesshub-recovery-codes.txt">
            <DownloadIcon />
            Download
          </a>
        </Button>
        <Button onClick={onDone}>I’ve saved them</Button>
      </div>
    </div>
  );
}
