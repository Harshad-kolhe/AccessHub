'use client';

import { useActionState } from 'react';
import { CircleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { register, type AuthFormState } from '../actions';

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const values = state.values ?? {};

  return (
    <form action={formAction} className="mt-8">
      <FieldGroup>
        {state.error && (
          <Alert variant="destructive" aria-live="polite">
            <CircleAlertIcon />
            <AlertDescription>
              <p>{state.error}</p>
            </AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="organizationName">Organization name</FieldLabel>
          <Input id="organizationName" name="organizationName" required defaultValue={values.organizationName} />
        </Field>
        <Field>
          <FieldLabel htmlFor="fullName">Your name</FieldLabel>
          <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={values.fullName} />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={values.email} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <FieldDescription>At least 8 characters, with an uppercase letter, a lowercase letter and a digit.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Create organization
        </Button>
      </FieldGroup>
    </form>
  );
}
