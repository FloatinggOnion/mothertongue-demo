import modal
from io import BytesIO

stt_image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install(
        "fastapi[standard]",
        "torch",
        "transformers",
        "soundfile",
        "numpy",
        "pydantic",
        "pydub",
    )
)

app = modal.App("mothertongue-stt-hausa", image=stt_image)


# 1. Dedicated GPU Processing Layer
@app.cls(gpu="T4", timeout=600, memory=4096)
class TranscriberEngine:
    @modal.enter()
    def load_model(self):
        import torch
        from transformers import AutoProcessor, Wav2Vec2ForCTC

        print("[GPU CONTAINER] Connecting directly to Hugging Face Hub...")
        model_id = "facebook/mms-1b-all"

        self.processor = AutoProcessor.from_pretrained(model_id, target_lang="hau")
        self.model = Wav2Vec2ForCTC.from_pretrained(
            model_id,
            target_lang="hau",
            ignore_mismatched_sizes=True
        )
        print("[GPU CONTAINER] Model initialized completely on memory grid.")

    @modal.method()
    def process_audio(self, audio_bytes: bytes) -> str:
        import torch
        import soundfile as sf
        import numpy as np
        from pydub import AudioSegment
        import io

        print(f"[GPU] Audio received: {len(audio_bytes)} bytes")

        # Convert any audio format (webm, mp4, ogg, wav) to WAV using pydub
        try:
            audio_segment = AudioSegment.from_file(BytesIO(audio_bytes))
        except Exception as e:
            raise ValueError(f"Could not decode audio format: {e}")

        print(f"[GPU] Raw audio: channels={audio_segment.channels}, frame_rate={audio_segment.frame_rate}, duration={len(audio_segment)}ms")

        # Convert to mono 16kHz WAV — required by Wav2Vec2
        audio_segment = audio_segment.set_channels(1).set_frame_rate(16000)
        wav_buffer = io.BytesIO()
        audio_segment.export(wav_buffer, format="wav")
        wav_buffer.seek(0)

        audio_data, samplerate = sf.read(wav_buffer)

        print(f"[GPU] After conversion: samplerate={samplerate}, shape={audio_data.shape}, max_amplitude={np.max(np.abs(audio_data)):.4f}")

        # Check if audio is too short or silent
        if len(audio_data) < 1600:  # less than 0.1 seconds at 16kHz
            raise ValueError(f"Audio too short: {len(audio_data)} samples ({len(audio_data)/16000:.2f}s)")

        if np.max(np.abs(audio_data)) < 0.001:
            raise ValueError("Audio appears to be silent — no voice detected")

        inputs = self.processor(
            audio_data,
            sampling_rate=samplerate,
            return_tensors="pt"
        )

        with torch.no_grad():
            outputs = self.model(**inputs).logits

        predicted_ids = torch.argmax(outputs, dim=-1)[0]
        result = self.processor.decode(predicted_ids)
        print(f"[GPU] Transcription result: '{result}'")
        return result


# 2. Asynchronous Web Gateway Router
@app.function()
@modal.asgi_app()
def web_entrypoint():
    from fastapi import FastAPI, Request, Response, status
    from fastapi.responses import JSONResponse

    web_app = FastAPI()

    # STEP A: Submit the sound file and get an immediate tracking ticket ID
    @web_app.post("/transcribe")
    async def accept_audio_job(request: Request):
        request_bytes = await request.body()
        if not request_bytes:
            return Response(content="Empty audio stream received", status_code=400)

        print("[GATEWAY] Audio dropped. Spawning detached cloud container process...")

        engine = TranscriberEngine()
        tracker_call = await engine.process_audio.spawn.aio(request_bytes)

        return JSONResponse(
            content={"call_id": tracker_call.object_id},
            status_code=status.HTTP_202_ACCEPTED
        )

    # STEP B: Poll this route to check compilation status
    @web_app.get("/result/{call_id}")
    async def fetch_job_result(call_id: str):
        from modal.functions import FunctionCall

        execution_thread = FunctionCall.from_id(call_id)
        try:
            transcription = await execution_thread.get.aio(timeout=0)
            return {"status": "completed", "text": transcription}
        except TimeoutError:
            return JSONResponse(
                content={"status": "processing", "message": "Model is still computing or warming up..."},
                status_code=202
            )
        except Exception as e:
            return JSONResponse(
                content={"status": "failed", "error": str(e)},
                status_code=500
            )

    return web_app