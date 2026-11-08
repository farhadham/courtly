import { useState } from 'react';
import type { FormEvent } from 'react';
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { loginRequestSchema, loginResponseSchema } from '@courtly/contracts';
import type { LoginRequest } from '@courtly/contracts';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { fetchData } from '@/lib/api';
import { errorMessage } from '@/lib/error-messages';
import { safeRedirect } from '@/lib/redirect';
import { getSession, startSession } from '@/lib/session';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const parsed = loginSearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  beforeLoad: ({ search }) => {
    // A signed-in user has no business on the login screen.
    if (getSession()) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Router redirect object.
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (input: LoginRequest) =>
      fetchData('/auth/login', loginResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (session) => {
      startSession(session);
      // Re-run the root guard now that a session exists, then follow the
      // original destination.
      await router.invalidate();
      await navigate({ href: safeRedirect(search.redirect), replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginRequestSchema.safeParse({ email, password });

    if (!parsed.success) {
      setFormError('Enter a valid email address and password.');
      return;
    }

    setFormError(null);
    login.mutate(parsed.data);
  }

  const failure = formError ?? (login.isError ? errorMessage(login.error) : null);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Book courts at the facility.</p>
      </header>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>

              {failure ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not sign in</AlertTitle>
                  <AlertDescription>{failure}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {import.meta.env.DEV ? (
        <p className="text-xs text-muted-foreground">
          Seeded users: user@courtly.test / courtly123 &middot; admin@courtly.test / courtly123
        </p>
      ) : null}
    </div>
  );
}
