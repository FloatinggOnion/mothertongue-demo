import os
import shutil
import modal

volume = modal.Volume.from_name("mothertongue-igbo-volume", create_if_missing=True)
app = modal.App("igbo-volume-uploader")

@app.function(volumes={"/igbo-storage": volume})
def upload_assets():
    import os
    print("Checking volume content...")
    print("Files currently in volume:", os.listdir("/igbo-storage"))

if __name__ == "__main__":
    print("Step 1: Downloading Igbo Model locally via fail-safe endpoints...")
    
    # We strip out the custom hf-mirror endpoint to try direct download channels 
    # using a forced clean agent header string.
    if "HF_ENDPOINT" in os.environ:
        del os.environ["HF_ENDPOINT"]
        
    local_temp_dir = "./temp_igbo_model"
    os.makedirs(local_temp_dir, exist_ok=True)
    
    from huggingface_hub import snapshot_download
    
    try:
        # snapshot_download directly fetches repo contents without checking model class logic
        print("Attempting repository snapshot download...")
        snapshot_download(
            repo_id="facebook/mms-tts-ibo",
            local_dir=local_temp_dir,
            local_dir_use_symlinks=False
        )
    except Exception as e:
        print(f"Standard fetch failed: {e}. Trying alternative open public proxy gateway...")
        # Fallback to a secondary secure mirrored distribution gateway
        os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
        snapshot_download(
            repo_id="facebook/mms-tts-ibo",
            local_dir=local_temp_dir,
            local_dir_use_symlinks=False,
            force_download=True
        )
    
    print("\nStep 2: Connecting to Modal Volume storage...")
    with volume.batch_upload() as upload:
        for root, dirs, files in os.walk(local_temp_dir):
            for file in files:
                local_path = os.path.join(root, file)
                remote_path = os.path.relpath(local_path, local_temp_dir)
                print(f"Uploading: {remote_path} -> Modal Volume")
                upload.put_file(local_path, remote_path)
                
    print("\nStep 3: Verifying storage deployment layers...")
    with app.run():
        upload_assets.remote()
        
    if os.path.exists(local_temp_dir):
        shutil.rmtree(local_temp_dir)
        print("Cleanup complete. Local scratch files purged.")