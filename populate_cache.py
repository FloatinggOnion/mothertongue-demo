import modal

app = modal.App("mothertongue-cache-builder")

image = modal.Image.debian_slim().pip_install("transformers", "torch")
volume = modal.Volume.from_name("mothertongue-model-cache", create_if_missing=True)

@app.function(image=image, volumes={"/model-cache": volume}, timeout=600)
def download_models():
    import os
    # Scrub potential toxic tokens from the container context
    os.environ.pop("HF_TOKEN", None)
    os.environ.pop("HUGGINGFACE_TOKEN", None)
    
    from transformers import VitsModel, AutoTokenizer

    models = ["facebook/mms-tts-hau", "facebook/mms-tts-ibo"]
    
    for model_name in models:
        print(f"--> Downloading {model_name} directly to volume...")
        try:
            # Force download cleanly into the directory mount
            AutoTokenizer.from_pretrained(model_name, cache_dir="/model-cache", force_download=True)
            VitsModel.from_pretrained(model_name, cache_dir="/model-cache", force_download=True)
            print(f"Successfully downloaded {model_name}")
        except Exception as e:
            print(f"Failed to fetch {model_name}: {e}")
            
    # Explicitly persist the filesystem state to the volume layer
    print("Committing files securely to modal.Volume...")
    volume.commit()

if __name__ == "__main__":
    # Clean, modern method to trigger a one-off execution of your app function in the cloud
    with app.run():
        download_models.remote()
    