import modal

# Define the image with system dependencies and Python packages
image = (
    modal.Image.debian_slim()
    # Install ffmpeg for audio processing reliability
    .apt_install("ffmpeg")
    # Install Python dependencies:
    # - transformers & torch for the model
    # - scipy for saving wav files
    # - huggingface_hub for authenticated downloads
    # - fastapi[standard] for the web server
    .pip_install(
        "transformers",
        "torch",
        "scipy",
        "huggingface_hub",
        "accelerate",
        "fastapi[standard]"
    )
)

app = modal.App("mothertongue-tts")

@app.cls(
    image=image,
    gpu="any",  # T4 is sufficient and cheapest
    secrets=[modal.Secret.from_name("huggingface-secret")],  # Needs HF_TOKEN
    scaledown_window=600,  # Keep container warm for 10 mins
)
class YorubaTTS:
    @modal.enter()
    def enter(self):
        """Load the model and tokenizer once when the container starts."""
        import torch
        from transformers import VitsModel, AutoTokenizer
        import os

        # Model repository
        model_id = "FloatinggOnion/yoruba-tts"
        
        print(f"📥 Loading model: {model_id}...")
        
        # Load tokenizer and model
        # Note: We rely on the HF_TOKEN environment variable injected by the secret
        hf_token = os.environ.get("HF_TOKEN")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, token=hf_token)
        self.model = VitsModel.from_pretrained(model_id, token=hf_token).to("cuda")
        
        print("✅ Model loaded successfully on GPU!")

    @modal.method()
    def generate_speech(self, text: str):
        import torch
        import io
        import scipy.io.wavfile

        print(f"🗣️ Generating speech for: '{text}'")
        
        # Tokenize input
        inputs = self.tokenizer(text, return_tensors="pt")
        inputs = inputs.to("cuda")

        # Generate waveform (inference)
        with torch.no_grad():
            output = self.model(**inputs).waveform

        # Move to CPU and convert to numpy
        waveform = output.cpu().numpy().squeeze()
        
        # Determine sampling rate (MMS usually defaults to 16kHz or config value)
        rate = self.model.config.sampling_rate

        # Save to in-memory buffer
        # Write wav file to bytes
        buffer = io.BytesIO()
        scipy.io.wavfile.write(buffer, rate, waveform)
        
        return buffer.getvalue()

# Define the FastAPI app
@app.function(image=image)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import Response
    from pydantic import BaseModel

    web_app = FastAPI(title="Mothertongue Yoruba TTS", description="Research-grade VITS model for Yoruba TTS")

    class TTSRequest(BaseModel):
        text: str

    @web_app.post("/generate")
    async def generate(request: TTSRequest):
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")

        # Invoke the GPU class
        # Modal handles the connection to the GPU container automatically
        tts = YorubaTTS()
        wav_bytes = tts.generate_speech.remote(request.text)

        return Response(content=wav_bytes, media_type="audio/wav")

    return web_app
