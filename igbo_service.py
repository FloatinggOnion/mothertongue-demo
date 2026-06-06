import os
import modal
from io import BytesIO
from pydantic import BaseModel

# 1. Define a downloading routine that runs inside a live function lifecycle stage
def download_igbo_model():
    # Set the mirror variable inside the live function runtime environment
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    
    from transformers import VitsModel, AutoTokenizer
    print("🌍 Outbound network connection open. Baking Igbo model layers into image cache...")
    AutoTokenizer.from_pretrained("facebook/mms-tts-ibo")
    VitsModel.from_pretrained("facebook/mms-tts-ibo")
    print("✅ Model layers securely baked into the container image layer.")

# 2. Build the image layer using .run_function instead of .run_commands
igbo_image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi[standard]", 
        "torch", 
        "transformers", 
        "soundfile", 
        "numpy", 
        "pydantic"
    )
    .run_function(download_igbo_model) # Resolves with full outbound network access
)

app = modal.App("mothertongue-tts-igbo", image=igbo_image)
models_cache = {}

class TTSRequest(BaseModel):
    text: str

@app.function(
    gpu="T4",
    timeout=120,
    memory=4096,
)
@modal.fastapi_endpoint(method="POST")
async def generate_speech(data: TTSRequest):
    from fastapi import Response
    import torch
    import soundfile as sf
    from transformers import VitsModel, AutoTokenizer

    try:
        text = data.text.strip()
        
        if "igbo" not in models_cache:
            print("[LOCAL] Loading baked Igbo assets instantly from image layers...")
            # local_files_only=True skips the internet entirely at request-time
            tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-ibo", local_files_only=True)
            model = VitsModel.from_pretrained("facebook/mms-tts-ibo", local_files_only=True)
            models_cache["igbo"] = (model, tokenizer)

        model, tokenizer = models_cache["igbo"]
        inputs = tokenizer(text, return_tensors="pt")

        with torch.no_grad():
            waveform = model(**inputs).waveform

        audio = waveform.squeeze().cpu().numpy()
        buffer = BytesIO()
        sf.write(buffer, audio, samplerate=model.config.sampling_rate, format="WAV")
        buffer.seek(0)

        return Response(content=buffer.read(), media_type="audio/wav")
    except Exception as e:
        return Response(content=f"Igbo Backend Error: {str(e)}", status_code=500)