# Exploratory Tiny Aya prompt-language probe

Run on 5 October 2026 with Cohere `tiny-aya-earth`, temperature 0.7, and 64 output tokens. The script is `run-aya-prompt-probe.mjs`. It used two synthetic market cases and one response per instruction variant. The scene and learner messages were held constant. The Yoruba instruction text was drafted without fluent-speaker review, so this is **not** the controlled comparison described in `PROMPT-COMPARISON.md` and should not determine the production prompt.

| Case | Instruction variant | Raw reply | Request time |
| --- | --- | --- | ---: |
| `market-order-english` | English | `Tomato, ọmọ ìgbà, o wá láti lọ́wọ́ mi.` | 1,847 ms |
| `market-order-english` | Yoruba draft | `"Ẹ káàbọ̀, ọmọ mi. Tomátì ni o fẹ́? Mo ní wọn ní iye tó dára. Ẹ̀bùn kan fún ọ, kí o ṣe é ṣe é?"` | 699 ms |
| `market-price-code-switch` | English | `Tomato meji ni, bọọlu meji ni.` | 458 ms |
| `market-price-code-switch` | Yoruba draft | `Dára. Méjì ìgò.` | 460 ms |

Neither price-case reply states a price. The Yoruba-draft order reply begins with another greeting. These are directly visible shortcomings relative to the case requirements; the naturalness and precise meaning of the Yoruba should be checked by a fluent speaker. Latency is a single observed request time, not a distribution. No variant wins from this probe.

Next: have a fluent Yoruba speaker produce or correct semantically matched English and Yoruba prompts; run all reviewed cases repeatedly and blind-score the outputs. Compare model candidates separately. Keep the deployed provider/model and prompt version in the record.
