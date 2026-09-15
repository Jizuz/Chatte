# download.py
import os
from huggingface_hub import snapshot_download

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_HUB_DISABLE_XET"] = "1"

snapshot_download(
    repo_id="Qwen/Qwen2.5-1.5B-Instruct",
    local_dir="./qwen2.5-1.5b-instruct",
    local_dir_use_symlinks=False
)