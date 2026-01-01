import threading
import time
import webbrowser

import uvicorn

from app.main import app

import sys
import os

if __name__ == "__main__":
    # Redirect stdout/stderr to devnull if frozen (noconsole mode crash prevention)
    if getattr(sys, 'frozen', False):
        null = open(os.devnull, 'w')
        sys.stdout = null
        sys.stderr = null

    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:13010")

    threading.Thread(target=open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=13010, log_level="info")
