# Web measurement plan

**Scope:** Next.js web app on Vercel. Conversation coherence is the primary quality measure. This plan covers Yoruba, Igbo, and Hausa separately and does not include mobile.

## Decision the data should support

After each release, decide whether a first learner can complete a useful conversation, which failure is most common, and whether the fix improves that failure without making latency or abandonment worse. Do not treat model-generated scores or a high number of chat turns as proof that the partner understood the learner.

## Primary measures

1. **Human-reviewed relevant reply rate:** On a balanced sample of consented conversations, a reviewer marks each partner reply as addressing the latest learner meaning, staying in scene, using the target language naturally, and being culturally appropriate. Report the percentage that passes all four, the sample size, and breakdowns by language, level, scenario, provider, and turn number. Flag severe role swaps or misleading replies separately.
2. **Learner-reported understanding:** After selected partner replies, ask a one-tap question: “Did your partner understand what you meant?” Yes / No / Skip. If No, offer fixed reasons: missed my meaning, changed topic, wrong language, unnatural wording, other. Report Yes rate together with response rate; never silently count skipped prompts as Yes.
3. **First-turn success:** In the first three learner turns, measure whether the learner gets a relevant reply and reaches the scene objective. Review this separately for first-time and returning learners. This is especially important for beginners.

Model review verdicts are diagnostic signals, not ground truth. Compare them with human labels to learn false acceptance and false rejection rates before using them as a release gate.

## Supporting measures

| Question | Events / calculation |
| --- | --- |
| Where do learners stop? | `scenario_started` → `first_turn_sent` → `third_turn_sent` → `session_finished`; report each conversion and time between steps. |
| Does help work? | `hint_opened`, `hint_step_revealed`, `turn_sent_after_hint`; show rate of a meaningful next turn, not just clicks. |
| Is voice usable? | `voice_started`, `transcription_succeeded`, `transcription_failed`, `transcript_edited`; no audio in analytics. |
| Are replies fast and reliable? | `partner_reply_succeeded` / `partner_reply_failed`, response latency p50/p95, retry and reviewer rejection counts, grouped by provider and language. |
| Do learners return? | Distinct practice sessions within 7 days after a first session, using a pseudonymous browser ID before sign-in and account linkage only after the learner saves progress. Report sample size and consent/age limits. |
| Is saving useful? | `save_requested`, `save_succeeded`, `save_failed`, and later `scenario_started` for returning learners. |

Capture only allowlisted event names and structured fields: `scenario_id`, language, starting level, turn index, input mode, provider/model version, status/reason code, and coarse latency. Never put chat text, translations, audio, email, names, or arbitrary URLs into product analytics. Limit event volume to meaningful state changes; do not auto-capture every click.

## Data flow and free-tier tools

- **PostHog Free:** Product events and dashboards for funnels, trends, and retention. Its current free tier includes 1 million analytics events per month and one project. Use server-side manual capture only; leave autocapture and session replay off. Vercel Hobby Web Analytics does not provide custom events, so it cannot answer the conversation questions on its own. Free tiers have limits and can change.
- **Neon Free:** Store only opted-in text conversations and human review labels in a private Postgres table. Keep its connection string server-side in Vercel functions, with no browser access. Do not store raw audio. Revoke public table grants, keep a deletion job, and honor withdrawal. Free tier limits can change.
- **Vercel:** Continue hosting the web app and its server routes. Store PostHog and Neon credentials as project environment variables. Keep Clerk for optional progress saving; it is not the transcript store.

Events can be pseudonymous before sign-in, but a stable browser or session identifier is **not truly anonymous**. Explain this in the privacy notice. Associate an event history with a Clerk account only after a save action and only within the age/privacy policy chosen for launch. Do not send email addresses to PostHog.

## Consent and learner-facing copy

At the start of practice, show a short notice that messages are sent to AI services to run the conversation and link to the full privacy notice. At the end, separately offer an **unchecked** choice to share the text conversation for human review. No review copy is stored until the learner accepts. The choice must not block finishing or saving progress, and declining must not change the lesson. The page should say what is stored, who can review it, why, for how long, and how to withdraw. Include a persistent Privacy link. The launch post can explain the same choice but cannot replace the in-product choice.

The founder confirmed that transcript sharing is offered only to learners who confirm they are **18 or older**, with automatic deletion after **30 days**. Younger learners may still practice, but their text must not be saved for human review. This is a minimum collection boundary, not a substitute for a broader age-policy review.

Draft copy:

> Help us improve conversations. If you are 18 or older and choose to share, we will save the text of this practice conversation so the Mothertongue team can review whether the AI understood you and improve the app. We will not save your microphone recording for review. Sharing is optional and will not affect your progress. The shared text is deleted after 30 days. You can delete it sooner using the receipt we give you.

Do not treat a child's click as sufficient permission to retain their transcript. A wider review of the age policy is needed before open recruitment because the core AI conversation also processes learner text and potentially voice.

## Implementation order

1. Finalize broader age eligibility and privacy notice. Create a dedicated PostHog project in an organization the founder controls and a Neon project on their free plans; set spending limits to zero where available. Add environment variables in Vercel. Keep collection off until these are complete.
2. Add a manual, server-side event helper with an explicit schema and tests proving that raw text/audio/email cannot enter event payloads. Instrument conversation responses and failures first, then key client funnel steps.
3. Add the one-tap understanding question to partner replies. Measure response rate and avoid prompting on every turn.
4. Add the optional transcript-sharing control and server endpoint. Enforce consent and age policy on the server, store a consent version/time, strip direct identifiers if possible, restrict reviewer access, and provide deletion/withdrawal.
5. Build a small review queue with a fixed rubric and stratified sampling. Start with human review of 30–50 conversations across languages and levels. Keep an adjudication note for disagreements.
6. Create a weekly dashboard: relevant reply rate with denominator, learner Yes rate with response rate, first-turn success, p95 response time, failure rate, and the first-session funnel. Review it after each model/prompt change.

**Release gate:** No transcript collection before the consent flow and age policy are tested. No claim of improved coherence until human-reviewed results and learner reports agree on an adequately sampled set.

## Current external references (5 October 2026)

- [PostHog pricing](https://posthog.com/pricing)
- [Neon pricing](https://neon.com/pricing)
- [Vercel Web Analytics pricing](https://vercel.com/docs/analytics/limits-and-pricing)
- [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [ICO Children's code recommendations](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/best-interests-self-assessment/step-4-prioritise-actions/recommended-actions-in-the-children-s-code/)
- [Nigeria Data Protection Act](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf)
