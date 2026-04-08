"""Routes for local GGUF model management and inference via llama-cpp-python."""

import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/local-models", tags=["local-models"])

MODELS_DIR = Path(os.getenv("GGUF_MODELS_DIR", "./models"))
MODELS_DIR.mkdir(exist_ok=True)

# In-memory state
_loaded_model = None
_loaded_model_path: Optional[str] = None


class LoadModelRequest(BaseModel):
    hf_repo: str
    file_name: str
    model_id: str


class ChatRequest(BaseModel):
    model_id: str
    messages: list[dict]
    temperature: float = 0.7
    max_tokens: int = 2048


def _get_llama():
    """Lazy import llama_cpp to avoid startup crash if not installed."""
    try:
        from llama_cpp import Llama
        return Llama
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="llama-cpp-python is not installed. Run: pip install llama-cpp-python",
        )


@router.get("/list")
async def list_models():
    """List downloaded GGUF models."""
    models = []
    if MODELS_DIR.exists():
        for f in MODELS_DIR.glob("*.gguf"):
            models.append({
                "id": f.stem,
                "file_name": f.name,
                "size_mb": round(f.stat().st_size / (1024 * 1024), 1),
                "loaded": _loaded_model_path == str(f),
            })
    return {"models": models, "models_dir": str(MODELS_DIR)}


@router.post("/download")
async def download_model(req: LoadModelRequest):
    """Download a GGUF model from HuggingFace."""
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="huggingface_hub is not installed. Run: pip install huggingface_hub",
        )

    target = MODELS_DIR / req.file_name
    if target.exists():
        return {"status": "already_downloaded", "path": str(target)}

    try:
        path = hf_hub_download(
            repo_id=req.hf_repo,
            filename=req.file_name,
            local_dir=str(MODELS_DIR),
            local_dir_use_symlinks=False,
        )
        return {"status": "downloaded", "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/load")
async def load_model(req: LoadModelRequest):
    """Load a GGUF model into memory."""
    global _loaded_model, _loaded_model_path

    Llama = _get_llama()
    model_path = MODELS_DIR / req.file_name

    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model file not found: {req.file_name}")

    try:
        if _loaded_model is not None:
            del _loaded_model

        _loaded_model = Llama(
            model_path=str(model_path),
            n_ctx=4096,
            n_threads=os.cpu_count() or 4,
            verbose=False,
        )
        _loaded_model_path = str(model_path)
        return {"status": "loaded", "model_id": req.model_id}
    except Exception as e:
        _loaded_model = None
        _loaded_model_path = None
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unload")
async def unload_model():
    """Unload the current model from memory."""
    global _loaded_model, _loaded_model_path

    if _loaded_model is not None:
        del _loaded_model
        _loaded_model = None
        _loaded_model_path = None

    return {"status": "unloaded"}


@router.post("/chat")
async def chat(req: ChatRequest):
    """Chat with the loaded model, streaming tokens via SSE."""
    if _loaded_model is None:
        raise HTTPException(status_code=400, detail="No model loaded. Call /load first.")

    async def generate():
        try:
            response = _loaded_model.create_chat_completion(
                messages=req.messages,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                stream=True,
            )
            for chunk in response:
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                content = delta.get("content")
                if content:
                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'content': ''})}\n\n"
        except Exception as e:
            logger.error("Local model chat error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.delete("/delete/{file_name}")
async def delete_model(file_name: str):
    """Delete a downloaded GGUF model."""
    global _loaded_model, _loaded_model_path

    target = MODELS_DIR / file_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Model file not found")

    if _loaded_model_path == str(target):
        del _loaded_model
        _loaded_model = None
        _loaded_model_path = None

    target.unlink()
    return {"status": "deleted"}
