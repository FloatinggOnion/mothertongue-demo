"""
Prompt building and KV-cached sampling for vamboai/morena-1.5b-instruct.

Morena is NOT a transformers model. The HF repo ships a plain-PyTorch `Transformer`
(modeling_morena.py) with no .generate() and a training-shaped forward, plus a
tokenizers-library tokenizer.json. See the repo's load_example.py.

Chat format is taken verbatim from tokenizer.chat_template in the official GGUF build
(vamboai/morena-1.5b-instruct-gguf):

    <eos>{system}\n<reserved_0>\n{user}\n<reserved_1>\n{assistant}<eos> ... <reserved_1>\n

<eos>, <reserved_0> and <reserved_1> are single tokens (ids 2, 3, 4). The model card warns
that <|user|>-style strings produce degenerate output — do not substitute them.

Imports of torch / modeling_morena are deferred so `modal deploy` can import this file
on a machine without torch.
"""

EOS_ID = 2
MAX_CONTEXT = 4096
_MARKERS = ("<eos>", "<reserved_0>", "<reserved_1>")


def _clean(text: str) -> str:
    # Strip chat markers from caller-supplied text so it can't forge turn boundaries.
    for m in _MARKERS:
        text = text.replace(m, "")
    return text


def build_prompt_ids(tok, system_prompt: str, messages: list) -> list:
    """Render the GGUF chat template and tokenize it. Leading <eos> is the BOS token."""
    parts = []
    if system_prompt:
        parts.append(_clean(system_prompt) + "\n")
    for m in messages:
        role, content = m.get("role"), _clean(str(m.get("content", "")))
        if role == "user":
            parts.append("<reserved_0>\n" + content + "\n")
        elif role == "assistant":
            parts.append("<reserved_1>\n" + content + "<eos>")
    parts.append("<reserved_1>\n")
    return [EOS_ID] + tok.encode("".join(parts), add_special_tokens=False).ids


def forward_cached(model, idx, start_pos: int, cache: list):
    """
    Incremental forward over `idx` (1, T) using the model's own weights, appending K/V to
    `cache` (one (k, v) entry per layer, None when empty). Returns last-position logits.

    Mirrors modeling_morena.Transformer.forward in "sdpa" mode; the only difference is
    that K/V from earlier positions are reused instead of recomputed.
    """
    import torch
    import torch.nn.functional as F
    import modeling_morena as M

    cfg = model.cfg
    B, T = idx.shape
    assert B == 1
    # is_causal masks top-left aligned, which is only correct with no cached prefix.
    assert T == 1 or start_pos == 0, "multi-token steps are only supported for the prefill"

    x = model.embed(idx)
    pos = torch.arange(start_pos, start_pos + T, device=idx.device)
    cos, sin = M.rope_cos_sin(pos, cfg.d_model // cfg.n_head, cfg.rope_theta, x.dtype)

    for i, blk in enumerate(model.layers):
        a = blk.attn
        h = blk.attn_norm(x)
        q = M.apply_rope(a.wq(h).view(T, a.n_head, a.hd), cos, sin)
        k = M.apply_rope(a.wk(h).view(T, a.n_kv, a.hd), cos, sin)
        v = a.wv(h).view(T, a.n_kv, a.hd)
        q = q.view(1, T, a.n_head, a.hd).transpose(1, 2)
        k = k.view(1, T, a.n_kv, a.hd).transpose(1, 2)
        v = v.view(1, T, a.n_kv, a.hd).transpose(1, 2)
        if cache[i] is not None:
            k = torch.cat([cache[i][0], k], dim=2)
            v = torch.cat([cache[i][1], v], dim=2)
        cache[i] = (k, v)
        rep = a.n_head // a.n_kv
        kk = k.repeat_interleave(rep, dim=1) if rep > 1 else k
        vv = v.repeat_interleave(rep, dim=1) if rep > 1 else v
        o = F.scaled_dot_product_attention(q, kk, vv, is_causal=T > 1)
        x = x + a.wo(o.transpose(1, 2).reshape(1, T, -1))
        x = x + blk.mlp(blk.mlp_norm(x))

    x = model.norm(x[:, -1:, :])
    w = model.embed.weight if cfg.tie_embeddings else model.lm_head.weight
    return F.linear(x, w)[:, -1, :]


def generate(model, tok, prompt_ids: list, max_new_tokens: int,
             temperature: float = 0.7, top_p: float = 0.9) -> str:
    """Top-p sampling, same as load_example.py's sampler but with a KV cache."""
    import torch

    if len(prompt_ids) + max_new_tokens > MAX_CONTEXT:
        raise ValueError("Prompt too long for Morena's 4096-token context")

    device = model.embed.weight.device
    cache = [None] * len(model.layers)
    stop_ids = {EOS_ID, tok.token_to_id("<reserved_0>"), tok.token_to_id("<reserved_1>")}

    with torch.no_grad():
        logits = forward_cached(model, torch.tensor([prompt_ids], device=device), 0, cache)
        pos = len(prompt_ids)
        out = []
        for _ in range(max_new_tokens):
            probs = torch.softmax(logits.float() / max(temperature, 1e-5), dim=-1)
            sp, si = torch.sort(probs, descending=True, dim=-1)
            sp[sp.cumsum(-1) - sp > top_p] = 0.0
            nxt = si.gather(-1, torch.multinomial(sp / sp.sum(-1, keepdim=True), 1))
            t = int(nxt[0, 0])
            if t in stop_ids:
                break
            out.append(t)
            logits = forward_cached(model, nxt, pos, cache)
            pos += 1

    return tok.decode(out, skip_special_tokens=True).strip()
