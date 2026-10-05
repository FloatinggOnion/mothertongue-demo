import Link from 'next/link';
import { DeleteSharedConversation } from '@/components/DeleteSharedConversation';

export const metadata = {
  title: 'Privacy | Mothertongue',
  description: 'How Mothertongue uses practice conversations and optional research data.',
};

export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL || 'jesseosems123@gmail.com';
  return (
    <main className="min-h-screen bg-paper px-6 py-12 md:py-20 text-text">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="font-ui text-xs uppercase tracking-widest text-accent hover:underline">← Home</Link>
        <h1 className="font-display text-4xl md:text-5xl mt-8 mb-4">Your practice, your choice</h1>
        <p className="font-body text-text-secondary leading-relaxed mb-10">This page explains how the web app uses conversation data. Last updated 5 October 2026.</p>

        <section className="mb-9">
          <h2 className="font-display text-2xl mb-3">During practice</h2>
          <p className="font-body text-sm leading-relaxed">Your messages are sent to AI services to generate replies, hints, and feedback. If you use the microphone, speech services process your recording to transcribe it or speak a reply. The app keeps your current conversation in this browser so you can continue after a refresh. We do not keep microphone recordings in our review database.</p>
        </section>

        <section className="mb-9">
          <h2 className="font-display text-2xl mb-3">Optional progress saving</h2>
          <p className="font-body text-sm leading-relaxed">You can practice without signing in. If you choose Save progress, Clerk handles email-code sign-in and we save a compact summary of the scenario, language, level, and number of turns. The full conversation is not part of your saved account progress.</p>
        </section>

        <section className="mb-9">
          <h2 className="font-display text-2xl mb-3">Optional conversation sharing</h2>
          <p className="font-body text-sm leading-relaxed mb-3">At the end of a session, learners who confirm they are 18 or older can choose to share the conversation text for human quality review. The choice starts unchecked, does not affect practice or progress, and is unavailable to learners under 18. We use shared text to check whether the AI understood the learner and to improve the experience. We do not save microphone recordings for this review. We remove email addresses, links, and long numbers where we can, but please avoid entering personal details in a practice conversation.</p>
          <p className="font-body text-sm leading-relaxed">Shared text is deleted automatically after 30 days. If you share, we give you a deletion receipt so you can remove it earlier. Our review store does not include your Clerk account ID or email address.</p>
        </section>

        <section className="mb-9">
          <h2 className="font-display text-2xl mb-3">Usage measurement</h2>
          <p className="font-body text-sm leading-relaxed">We may measure actions such as starting a scenario, receiving a reply, using a hint, and whether a reply was reported as understood. These events help us find failures and measure improvements. Product analytics must not include conversation text, audio, email addresses, or names. A random session identifier may be used to connect events in one practice session; that identifier is pseudonymous rather than truly anonymous. We do not use session replay for this measurement.</p>
        </section>

        <section className="mb-9">
          <h2 className="font-display text-2xl mb-3">Delete shared text</h2>
          <p className="font-body text-sm leading-relaxed">Enter the receipt you received when you shared a conversation. If it has already expired or was deleted, this action has no further effect.</p>
          <DeleteSharedConversation />
        </section>

        {contact && <section className="mb-9"><h2 className="font-display text-2xl mb-3">Questions or requests</h2><p className="font-body text-sm">Email <a className="text-accent underline" href={`mailto:${contact}`}>{contact}</a>.</p></section>}
      </div>
    </main>
  );
}
