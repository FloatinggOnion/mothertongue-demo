'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Message, ProficiencyLevel } from '@/types';
import { CONSENT_VERSION } from '@/lib/research-sharing';

interface Props {
  scenarioId: string;
  proficiencyLevel: ProficiencyLevel;
  messages: Message[];
}

export function ShareConversationAction({ scenarioId, proficiencyLevel, messages }: Props) {
  if (process.env.NEXT_PUBLIC_RESEARCH_SHARING_ENABLED !== 'true') return null;
  return <ConfiguredShareConversationAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} messages={messages} />;
}

function ConfiguredShareConversationAction({ scenarioId, proficiencyLevel, messages }: Props) {
  const [age, setAge] = useState<'adult' | 'minor' | ''>('');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sharing' | 'shared' | 'error'>('idle');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');

  const share = async () => {
    if (age !== 'adult' || !agreed || status === 'sharing' || status === 'shared') return;
    setStatus('sharing');
    setError('');
    try {
      const response = await fetch('/api/review-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId,
          proficiencyLevel,
          adultConfirmed: true,
          consented: true,
          consentVersion: CONSENT_VERSION,
          messages: messages.map(({ role, content, kind }) => ({ role, content, kind })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not share conversation');
      setReceipt(body.receipt);
      setStatus('shared');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Could not share conversation');
    }
  };

  return (
    <section aria-label="Optional conversation sharing" className="border border-[#D9D2C7] bg-[#EDE8DF] p-5 mb-6 text-left">
      <h3 className="font-display text-lg text-[#2C1810] mb-2">Help us improve conversations</h3>
      <p className="font-body text-sm text-[#2C1810] leading-relaxed mb-3">
        If you choose to share, the Mothertongue team will save this conversation&apos;s text to check whether the AI understood you. We do not save your microphone recording for review. Sharing is optional and does not affect your progress. Shared text is deleted after 30 days, and you can delete it sooner with a receipt.
      </p>
      <Link href="/privacy" target="_blank" className="font-ui text-xs text-[#C4622D] underline">Read how your data is used</Link>

      {status === 'shared' ? (
        <div className="mt-4">
          <p role="status" className="font-body text-sm text-[#2D5A4E] mb-2">Thank you. Your conversation text was shared for review.</p>
          <label htmlFor="review-receipt" className="font-body text-xs text-[#2C1810] block mb-1">Save this deletion receipt. You can enter it on the Privacy page to delete your shared text sooner.</label>
          <input id="review-receipt" readOnly value={receipt} onFocus={(event) => event.currentTarget.select()} className="w-full border border-[#D9D2C7] bg-white p-2 font-mono text-xs text-[#2C1810]" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <fieldset>
            <legend className="font-body text-sm text-[#2C1810] mb-2">For this optional sharing, which applies to you?</legend>
            <label className="font-body text-sm text-[#2C1810] flex items-center gap-2 mb-1">
              <input type="radio" name="review-age" checked={age === 'adult'} onChange={() => setAge('adult')} /> I am 18 or older
            </label>
            <label className="font-body text-sm text-[#2C1810] flex items-center gap-2">
              <input type="radio" name="review-age" checked={age === 'minor'} onChange={() => { setAge('minor'); setAgreed(false); }} /> I am under 18
            </label>
          </fieldset>
          {age === 'minor' && <p className="font-body text-xs text-[#2C1810]">You can still practice. We will not save your conversation for human review.</p>}
          {age === 'adult' && (
            <>
              <label className="font-body text-sm text-[#2C1810] flex items-start gap-2">
                <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" />
                <span>I agree to share this conversation&apos;s text for human review for up to 30 days. I understand this is optional.</span>
              </label>
              <button type="button" onClick={() => void share()} disabled={!agreed || status === 'sharing'} className="font-ui text-xs uppercase tracking-widest px-4 py-2 bg-[#2D5A4E] text-white disabled:opacity-50">
                {status === 'sharing' ? 'Sharing…' : 'Share conversation text'}
              </button>
            </>
          )}
          {status === 'error' && <p role="alert" className="font-body text-xs text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
