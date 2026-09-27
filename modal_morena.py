"""
Modal deployment for vamboai/morena-1.5b-instruct.

Setup:
  pip install modal
  modal setup          # authenticates your account
  modal deploy modal_morena.py

The endpoint URL is printed after deploy — set it as MORENA_MODAL_URL in .env.local

Model weights are baked into the container image on first build (~3 GB download),
so subsequent cold starts are fast (~20-30 s to load weights onto the GPU).

Morena is NOT a transformers model (no AutoModel support, no .generate()). It is loaded
with the repo's own modeling_morena.py and tokenizer.json, as in the repo's
load_example.py; prompt building and sampling live in morena_infer.py.

Authentication: set MORENA_ENDPOINT_SECRET in .env.local — the same value must be
set in MORENA_ENDPOINT_SECRET so morena.ts sends it as X-Api-Key on every request.
Modal reads the secret from .env.local at deploy time via Secret.from_dotenv().
"""

import modal

MODEL_ID = "vamboai/morena-1.5b-instruct"
MODEL_DIR = "/model"
MAX_NEW_TOKENS = 300     # hard server-side cap — callers cannot exceed this
MAX_INPUT_CHARS = 8_000  # guards against oversized prompt payloads

app = modal.App("mothertongue-morena")


def _download_model():
    from huggingface_hub import snapshot_download
    snapshot_download(
        MODEL_ID,
        local_dir=MODEL_DIR,
        allow_patterns=["config.json", "model.safetensors", "tokenizer.json", "modeling_morena.py"],
    )


image = (
    modal.Image.debian_slim(python_version="3.11")
    # modeling_morena.py needs torch >= 2.4 and numpy; no transformers dependency.
    .pip_install("torch>=2.4", "numpy", "safetensors", "tokenizers", "huggingface_hub", "fastapi[standard]")
    .run_function(_download_model)
    .add_local_python_source("morena_infer")
)


@app.cls(
    image=image,
    gpu="L4",  # weights are bf16; T4 has no native bf16 support
    scaledown_window=120,  # stay warm for 2 min after last request; no idle billing beyond that
    secrets=[modal.Secret.from_dict({"MORENA_ENDPOINT_SECRET": __import__("os").environ.get("MORENA_ENDPOINT_SECRET", "")})],
)
class MorenaModel:
    @modal.enter()
    def load_model(self):
        import json
        import os
        import sys
        import torch
        from safetensors.torch import load_file
        from tokenizers import Tokenizer

        sys.path.insert(0, MODEL_DIR)
        import modeling_morena as M

        cfg = json.load(open(f"{MODEL_DIR}/config.json"))
        # Build on the meta device so the 1.5B random init is skipped, then adopt the
        # bf16 checkpoint tensors directly.
        with torch.device("meta"):
            model = M.Transformer(M.ModelConfig(**cfg["model"]), "sdpa")
        model.load_state_dict(load_file(f"{MODEL_DIR}/model.safetensors"), strict=True, assign=True)
        self.model = model.to(device="cuda", dtype=torch.bfloat16).eval()
        self.tokenizer = Tokenizer.from_file(f"{MODEL_DIR}/tokenizer.json")
        self._secret = os.environ.get("MORENA_ENDPOINT_SECRET")

    @modal.fastapi_endpoint(method="POST")
    def infer(self, data: dict) -> dict:
        from fastapi import HTTPException
        import morena_infer

        # Auth — pop key from body so it never reaches inference logic
        if self._secret and data.pop("x_api_key", None) != self._secret:
            raise HTTPException(status_code=401, detail="Unauthorized")

        system_prompt = str(data.get("system_prompt", ""))
        messages = data.get("messages", [])
        if not isinstance(messages, list) or not all(isinstance(m, dict) for m in messages):
            raise HTTPException(status_code=400, detail="messages must be a list of objects")

        # Resource caps
        total_chars = len(system_prompt) + sum(len(str(m.get("content", ""))) for m in messages)
        if total_chars > MAX_INPUT_CHARS:
            raise HTTPException(status_code=400, detail="Input too large")

        max_new_tokens = min(int(data.get("max_new_tokens", 200)), MAX_NEW_TOKENS)

        prompt_ids = morena_infer.build_prompt_ids(self.tokenizer, system_prompt, messages)
        try:
            text = morena_infer.generate(self.model, self.tokenizer, prompt_ids, max_new_tokens)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"text": text}
