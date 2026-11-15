"""Loopback-only educational API and built frontend server."""
import asyncio
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager
import secrets
import time
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .core import Key, generate_key, encrypt_bytes, decrypt_bytes, pack_cipher, unpack_cipher

SESSIONS: dict = {}
TASKS: set = set()
POOL = None
TTL = 3600


@asynccontextmanager
async def lifespan(app):
    global POOL
    POOL = ProcessPoolExecutor(max_workers=2)
    yield
    for task in TASKS:
        task.cancel()
    POOL.shutdown(wait=False, cancel_futures=True)
    SESSIONS.clear()


app = FastAPI(title="RSA Learning Lab", lifespan=lifespan)


@app.middleware("http")
async def local_origin(request, call_next):
    origin = request.headers.get("origin")
    if request.url.path.startswith("/api") and origin and origin not in (
        "http://127.0.0.1:8765", "http://localhost:8765", "http://127.0.0.1:5173", "http://localhost:5173"
    ):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "This lab accepts local requests only."}, status_code=403)
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def session(x_lab_session: str = Header(default="")):
    now = time.monotonic()
    for token in list(SESSIONS):
        if now - SESSIONS[token]["used"] > TTL:
            del SESSIONS[token]
    state = SESSIONS.get(x_lab_session)
    if not state:
        raise HTTPException(401, "Your lab session expired. Refresh to start a new session.")
    state["used"] = now
    return state


@app.get("/api/health")
def health():
    return {"ok": True, "engine": "Custom Python RSA + OAEP"}


@app.post("/api/session")
def new_session():
    now = time.monotonic()
    for token in list(SESSIONS):
        if now - SESSIONS[token]["used"] > TTL:
            del SESSIONS[token]
    if len(SESSIONS) >= 100:
        raise HTTPException(429, "Too many lab sessions. Try again later.")
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = {"used": now, "keys": {}, "jobs": {}}
    return {"token": token}


class KeyRequest(BaseModel):
    bits: Literal[1024, 2048]


async def finish_key(state, job_id, bits):
    job = state["jobs"][job_id]
    try:
        key = await asyncio.get_running_loop().run_in_executor(POOL, generate_key, bits)
        key_id = secrets.token_urlsafe(16)
        if len(state["keys"]) >= 8:
            del state["keys"][next(iter(state["keys"]))]
        state["keys"][key_id] = key
        job.update(status="complete", result={"id": key_id, **key.public()})
    except asyncio.CancelledError:
        job.update(status="error", error="Generation was interrupted.")
        raise
    except Exception:
        job.update(status="error", error="Key generation failed. Please retry.")


@app.post("/api/keys", status_code=202)
async def create_key(body: KeyRequest, state=Depends(session)):
    if any(j["status"] == "running" for j in state["jobs"].values()):
        raise HTTPException(409, "A key is already being generated.")
    active = sum(j["status"] == "running" for s in SESSIONS.values() for j in s["jobs"].values())
    if active >= 4:
        raise HTTPException(429, "The lab is busy. Try again shortly.")
    if len(state["jobs"]) >= 10:
        del state["jobs"][next(iter(state["jobs"]))]
    job_id = secrets.token_urlsafe(16)
    state["jobs"][job_id] = {"status": "running", "bits": body.bits}
    task = asyncio.create_task(finish_key(state, job_id, body.bits))
    TASKS.add(task)
    task.add_done_callback(TASKS.discard)
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str, state=Depends(session)):
    if job_id not in state["jobs"]:
        raise HTTPException(404, "Job not found in this session.")
    return state["jobs"][job_id]


def find_key(state, key_id) -> Key:
    key = state["keys"].get(key_id)
    if key is None:
        raise HTTPException(404, "Generate a key first. Old keys expire when the session ends.")
    return key


@app.post("/api/keys/{key_id}/reveal")
def reveal(key_id: str, state=Depends(session)):
    return find_key(state, key_id).private()


class EncryptRequest(BaseModel):
    key_id: str = Field(max_length=64)
    message: str = Field(max_length=1024)
    mode: Literal["oaep", "textbook"]


class DecryptRequest(BaseModel):
    key_id: str = Field(max_length=64)
    envelope: str = Field(max_length=8192)


@app.post("/api/encrypt")
def encrypt(body: EncryptRequest, state=Depends(session)):
    key = find_key(state, body.key_id)
    try:
        data = body.message.encode("utf-8")
        started = time.perf_counter()
        ciphertext = encrypt_bytes(data, key, body.mode)
        elapsed = (time.perf_counter() - started) * 1000
        return {"envelope": pack_cipher(ciphertext, key, body.mode, len(data)),
                "cipher_hex": ciphertext.hex(), "cipher_int": str(int.from_bytes(ciphertext, "big")),
                "message_int": str(int.from_bytes(data, "big")), "utf8_hex": data.hex(),
                "input_bytes": len(data), "output_bytes": len(ciphertext), "elapsed_ms": round(elapsed, 3),
                "mode": body.mode, "bits": key.n.bit_length()}
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(400, str(exc)) from None


@app.post("/api/decrypt")
def decrypt(body: DecryptRequest, state=Depends(session)):
    key = find_key(state, body.key_id)
    try:
        ciphertext, mode, length = unpack_cipher(body.envelope.strip(), key)
        started = time.perf_counter()
        data = decrypt_bytes(ciphertext, key, mode, length)
        elapsed = (time.perf_counter() - started) * 1000
        return {"message": data.decode("utf-8"), "utf8_hex": data.hex(),
                "elapsed_ms": round(elapsed, 3), "mode": mode, "input_bytes": len(ciphertext)}
    except (ValueError, UnicodeError):
        raise HTTPException(400, "Decryption failed. Check the key and ciphertext envelope.") from None


DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/")
@app.get("/{client_path:path}")
def index(client_path: str = ""):
    # BrowserRouter deep links use the same shell. Unknown API/assets requests
    # must still return 404 rather than an HTML response masquerading as JSON.
    if client_path.split("/", 1)[0] in ("api", "assets"):
        raise HTTPException(404, "Not found")
    if (DIST / "index.html").exists():
        return FileResponse(DIST / "index.html")
    raise HTTPException(503, "Build the frontend first: cd frontend; npm run build")
