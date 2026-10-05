import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { safeReturnPath } from '@/lib/auth-return';

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const redirect = safeReturnPath(returnTo);
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

  return (
    <main className="min-h-screen bg-paper px-6 py-16 flex flex-col items-center justify-center text-dark">
      <div className="w-full max-w-md mb-8 text-center">
        <Link href={redirect} className="font-ui text-xs uppercase tracking-widest text-accent hover:underline">Continue practicing</Link>
        <h1 className="font-display text-4xl mt-8 mb-3">Save your progress</h1>
        <p className="font-body text-sm text-text-secondary leading-relaxed">Create an account with a code sent to your email.</p>
      </div>
      {configured
        ? <SignUp routing="path" path="/sign-up" forceRedirectUrl={redirect} signInUrl={`/sign-in?returnTo=${encodeURIComponent(redirect)}`} />
        : <p className="font-body text-sm text-text-secondary text-center">Account saving is being set up. You can keep practicing on this device.</p>}
    </main>
  );
}
