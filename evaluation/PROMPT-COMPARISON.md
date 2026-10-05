# Partner prompt comparison

The current partner instructions are written in English while the requested reply is in the target language. We should test whether Yoruba instructions improve the *conversation*, not only the fraction of Yoruba words.

## Controlled comparison

Use the synthetic turns in `conversation-cases.json` as a seed set. Expand to at least 30 multi-turn cases with a Yoruba-speaking reviewer before selecting a production prompt. Keep the model, scenario, history, learner turn, generation settings, and output checks identical. Vary only the instruction language:

1. English instructions with Yoruba output requested (current baseline).
2. A Yoruba translation of the same instructions, checked by a fluent Yoruba speaker for meaning and register.
3. Bilingual instructions: English role and safety constraints, Yoruba scene and conversational guidance, also checked by a fluent speaker.

Run each case three times per variant in randomized order. Hide the variant name from reviewers. Include the deployed provider, Gemini, and any small model under serious consideration as separate comparisons; never pool their scores when deciding what language of prompt works.

For every reply, record whether it answers the latest learner intent, remembers relevant earlier turns, stays in character, advances the scene naturally, uses appropriate Yoruba and register, and avoids invented facts. Mark a reply that contains valid Yoruba words but misses the learner's request as a coherence failure. Also record response latency, provider error, fallback, and output language. A native speaker should judge the Yoruba and cultural dimensions; an automatic judge may assist triage but cannot be the final arbiter.

Do not infer that a prompt is better from one live exchange. Select it only after blinded multi-turn review and a live learner trial. The local environment lacks the Gemini and Groq credentials for the full provider comparison; the data and review rubric are ready for that run.

An exploratory Tiny Aya run using the available Cohere evaluation key is recorded in `aya-prompt-probe.md`. It covers only two market cases and an unreviewed Yoruba draft. Both variants missed the price request, so it does not support selecting a prompt language. The configured Gemini/Groq credentials needed for the full provider comparison are still unavailable locally.
