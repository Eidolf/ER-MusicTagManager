import uvicorn

from app.main import app

import webbrowser
import threading
import time

if __name__ == "__main__":
    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:13010")

    threading.Thread(target=open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=13010, log_level="info")
