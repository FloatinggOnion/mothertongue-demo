# Live web conversation baseline

Observed on 5 October 2026 at `https://www.trymothertongue.com/drill/market-haggling`, using Beginner and text input. This is a small manual baseline, not a quality score. The deployed provider and prompt version were not visible in the UI.

| Turn | Learner | Partner | Observation |
| --- | --- | --- | --- |
| Starter | — | `Ẹ kú àárọ̀ o! Ẹ wá ra nǹkan? I have fresh tomatoes today, very fresh! Kí ló fẹ́ ra?` | Market seller asks what the learner wants. |
| 1 | `I want tomatoes, please.` | `Ẹ kú àárọ̀, Mama Nkechi.` | Ignores tomatoes, repeats a greeting, and appears to address the seller by her own name. The UI displayed a model warm-up message before this reply. |
| 2 | `I want two baskets of tomatoes. How much?` | `One basket of tomatoes costs 500 Naira.` | Answers in English and gives a one-basket price after a two-basket request. |

An earlier manual run with the same first learner turn also returned a greeting that ignored tomatoes. These observations make the first market case a useful regression test, but they cannot establish a failure rate or whether a different provider/prompt will meet the release gate.

Next comparison: run the seed cases from `conversation-cases.json` against the deployed route and candidate providers. Record provider, model, prompt version, output, latency, and reviewer judgments. A Yoruba-speaking reviewer should verify the translation, register, and whether the proposed repair sounds natural.
