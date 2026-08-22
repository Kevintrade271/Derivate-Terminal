"""
QuantDesk Derivatives Terminal — Standalone Desktop Application
Launches embedded FastAPI backend + React SPA in a native Windows WebView2 container.
"""
import sys
import os
import time
import threading
import requests
import uvicorn
import webview

# Ensure backend directory is in Python path
base_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(base_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def start_backend():
    """Runs FastAPI uvicorn server in background thread."""
    from main import app
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


def wait_for_server(url="http://127.0.0.1:8000/api/health", timeout=12):
    """Wait until backend server is listening and healthy."""
    start_t = time.time()
    while time.time() - start_t < timeout:
        try:
            r = requests.get(url, timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.3)
    return False


def main():
    # 1. Start backend server thread
    server_thread = threading.Thread(target=start_backend, daemon=True)
    server_thread.start()

    # 2. Wait for backend to be ready
    wait_for_server()

    # 3. Create native desktop window
    window = webview.create_window(
        title="QuantDesk — Derivatives Terminal",
        url="http://127.0.0.1:8000",
        width=1600,
        height=960,
        min_size=(1150, 720),
        background_color="#020617",
        easy_drag=False,
    )

    # 4. Start native GUI loop
    try:
        webview.start(gui="edgechromium", debug=False)
    except Exception:
        # Fallback to default gui engine if edgechromium has quirks
        webview.start(debug=False)


if __name__ == "__main__":
    main()
