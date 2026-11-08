import { useState } from 'react';
import type { FormEvent } from 'react';
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { loginRequestSchema, loginResponseSchema } from '@courtly/contracts';
import type { LoginRequest } from '@courtly/contracts';
import { CheckIcon, Clock3Icon, ShieldCheckIcon, SparklesIcon } from 'lucide-react';
import { z } from 'zod';
import { BrandLockup, BrandMark } from '@/components/brand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { fetchData } from '@/lib/api';
import { errorMessage } from '@/lib/error-messages';
import { safeRedirect } from '@/lib/redirect';
import { getSession, startSession } from '@/lib/session';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

const DEMO_ACCOUNTS = [
  { label: 'Player', email: 'user@courtly.test', password: 'courtly123' },
  { label: 'Admin', email: 'admin@courtly.test', password: 'courtly123' },
] as const;

const FEATURES = [
  { icon: Clock3Icon, text: 'Hourly availability, shown at the facility' },
  { icon: SparklesIcon, text: 'Book one or two consecutive hours' },
  { icon: ShieldCheckIcon, text: 'Cancel free up to two hours before the start' },
];

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

  function fillDemoAccount(nextEmail: string, nextPassword: string) {
    setEmail(nextEmail);
    setPassword(nextPassword);
    setFormError(null);
  }

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
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <aside className="relative hidden min-h-[33rem] flex-col justify-between overflow-hidden rounded-3xl bg-primary p-10 text-primary-foreground shadow-xl shadow-primary/15 lg:flex">
        <div aria-hidden="true" className="court-lines absolute inset-0 opacity-70" />
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 size-72 rounded-full bg-highlight/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-16 size-64 rounded-full bg-primary-foreground/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <BrandMark className="bg-primary-foreground text-primary ring-0" />
          <span className="flex flex-col leading-none">
            <span className="text-base font-semibold tracking-tight">Courtly</span>
            <span className="mt-1 text-[0.68rem] font-medium tracking-[0.14em] text-primary-foreground/60 uppercase">
              Court booking
            </span>
          </span>
        </div>

        <div className="relative flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-highlight uppercase">
              Play more, plan less
            </p>
            <h2 className="max-w-sm text-3xl font-semibold tracking-tight text-balance">
              Your next game starts here.
            </h2>
            <p className="max-w-sm text-sm/relaxed text-primary-foreground/75">
              See what is free at a glance, book your hour and get back to the game.
            </p>
          </div>

          <ul className="flex flex-col gap-3 text-sm">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-foreground/10 text-highlight">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="text-primary-foreground/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/55">
          No double bookings. Every slot is guarded by the database.
        </p>
      </aside>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-none">
        <div className="flex flex-col gap-3 lg:hidden">
          <BrandLockup subtitle="Court booking" />
        </div>

        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader className="gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              Welcome back
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Book courts at the facility.</p>
          </CardHeader>

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

            {import.meta.env.DEV ? (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Demo accounts</span>
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => fillDemoAccount(account.email, account.password)}
                  >
                    {account.label}
                  </Button>
                ))}
                <span className="w-full">Choose one to fill the form, then sign in.</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Courtly demo · Seeded users are listed in the README.
        </p>
      </div>
    </div>
  );
}
