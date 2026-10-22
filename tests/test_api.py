import time
from fastapi.testclient import TestClient
from backend.app import app, SESSIONS
from backend.core import Key


def test_session_isolation_and_validation():
    with TestClient(app) as client:
        first = client.post("/api/session").json()["token"]
        second = client.post("/api/session").json()["token"]
        headers = {"X-Lab-Session": first}
        assert client.post("/api/keys", json={"bits": 512}, headers=headers).status_code == 422
        assert client.get("/api/jobs/missing", headers=headers).status_code == 404
        SESSIONS[first]["keys"]["fixture"] = Key(61, 53, 17, 2753)
        assert client.post("/api/keys/fixture/reveal", headers={"X-Lab-Session": second}).status_code == 404
        assert client.post("/api/keys/fixture/reveal", headers=headers).json()["p"] == "61"
        assert client.post("/api/encrypt", json={"key_id": "missing", "mode": "oaep", "message": "hi"}, headers=headers).status_code == 404
        assert client.post("/api/session", headers={"Origin": "https://untrusted.example"}).status_code == 403
        assert client.get("/api/jobs/x").status_code == 401


def test_real_job_and_round_trip():
    with TestClient(app) as client:
        headers = {"X-Lab-Session": client.post("/api/session").json()["token"]}
        response = client.post("/api/keys", json={"bits": 1024}, headers=headers)
        assert response.status_code == 202
        job_id = response.json()["job_id"]
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            job = client.get(f"/api/jobs/{job_id}", headers=headers).json()
            if job["status"] != "running":
                break
            time.sleep(.05)
        assert job["status"] == "complete"
        key = job["result"]
        assert key["bits"] == 1024
        assert not any(field in key for field in ("p", "q", "d"))
        for mode in ("textbook", "oaep"):
            result = client.post("/api/encrypt", json={"key_id": key["id"], "mode": mode, "message": "Hello مرحبا 🔐"}, headers=headers)
            assert result.status_code == 200
            recovered = client.post("/api/decrypt", json={"key_id": key["id"], "envelope": result.json()["envelope"]}, headers=headers)
            assert recovered.json()["message"] == "Hello مرحبا 🔐"
        assert client.post("/api/decrypt", json={"key_id": key["id"], "envelope": "bad"}, headers=headers).status_code == 400
