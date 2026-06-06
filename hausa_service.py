import modal
from io import BytesIO
from pydantic import BaseModel

app = modal.App("mothertongue-tts-hausa")

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "torch", "transformers", "soundfile", "numpy", "pydantic")
)

volume = modal.Volume.from_name("mothertongue-hausa-cache", create_if_missing=True)

models_cache = {}

class TTSRequest(BaseModel):
    text: str

@app.function(
    image=image,
    gpu="T4",
    volumes={"/model-cache": volume},
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
        if "hausa" not in models_cache:
            print("[INIT] Loading Hausa model...")
            tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-hau", cache_dir="/model-cache")
            model = VitsModel.from_pretrained("facebook/mms-tts-hau", cache_dir="/model-cache")
            models_cache["hausa"] = (model, tokenizer)
            volume.commit()

        model, tokenizer = models_cache["hausa"]
        inputs = tokenizer(text, return_tensors="pt")

        with torch.no_grad():
            waveform = model(**inputs).waveform

        audio = waveform.squeeze().cpu().numpy()
        buffer = BytesIO()
        sf.write(buffer, audio, samplerate=model.config.sampling_rate, format="WAV")
        buffer.seek(0)

        return Response(content=buffer.read(), media_type="audio/wav")
    except Exception as e:
        return Response(content=f"Hausa Backend Error: {str(e)}", status_code=500)