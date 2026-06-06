import modal
from io import BytesIO

stt_image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi[standard]",
        "torch",
        "transformers",
        "soundfile",
        "numpy",
        "pydantic"
    )
    # 🌟 FIX: Removed the mirror route so it talks directly to Hugging Face
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
        
        # Pulls parameters cleanly over secure default SSL lines
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
        
        audio_data, samplerate = sf.read(BytesIO(audio_bytes))
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        inputs = self.processor(audio_data, sampling_rate=samplerate, return_tensors="pt")

        with torch.no_grad():
            outputs = self.model(**inputs).logits

        predicted_ids = torch.argmax(outputs, dim=-1)[0]
        return self.processor.decode(predicted_ids)


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
        
        # 🌟 FIX: Swapped to .spawn.aio() to resolve the AsyncUsageWarning
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
            # 🌟 FIX: Swapped to .get.aio() to resolve the AsyncUsageWarning
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