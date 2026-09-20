"""
Modal deployment for vamboai/morena-1.5b-instruct.

Setup:
  pip install modal
  modal setup          # authenticates your account
  modal deploy modal_morena.py

The endpoint URL is printed after deploy — set it as MORENA_MODAL_URL in .env.local

Model weights are baked into the container image on first build (~3 GB download),
so subsequent cold starts are fast (~10-15 s to load weights onto the GPU).
"""

import modal

MODEL_ID = "vamboai/morena-1.5b-instruct"
MODEL_DIR = "/model"

app = modal.App("mothertongue-morena")


def _download_model():
    from huggingface_hub import snapshot_download
    snapshot_download(MODEL_ID, local_dir=MODEL_DIR)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("transformers>=4.40", "torch", "accelerate", "huggingface_hub", "fastapi[standard]")
    .run_function(_download_model)
)


@app.cls(
    image=image,
    gpu="T4",
    scaledown_window=120,  # stay warm for 2 min after last request; no idle billing beyond that
)
class MorenaModel:
    @modal.enter()
    def load_model(self):
        from transformers import AutoTokenizer, AutoModelForCausalLM
        import torch

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_DIR,
            torch_dtype=torch.bfloat16,
            device_map="auto",
        )
        self.model.eval()

    @modal.fastapi_endpoint(method="POST")
    def infer(self, data: dict) -> dict:
        import torch

        system_prompt = data.get("system_prompt", "")
        messages = data.get("messages", [])
        max_new_tokens = int(data.get("max_new_tokens", 200))

        chat_messages = [{"role": "system", "content": system_prompt}] + messages

        input_ids = self.tokenizer.apply_chat_template(
            chat_messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        ).to(self.model.device)

        with torch.no_grad():
            output_ids = self.model.generate(
                input_ids,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=0.7,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        new_tokens = output_ids[0][input_ids.shape[-1]:]
        text = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        return {"text": text}
