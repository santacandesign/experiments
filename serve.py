#!/usr/bin/env python3
"""Local dev server for the Fish Friends prototype.

Same as `python3 -m http.server`, except it tells the browser not to cache
anything. Without that you edit a .js file, reload, and spend ten minutes
debugging the previous version.

    python3 serve.py [port]        # default 8777

Camera and microphone need a secure context; localhost counts as one.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "200" not in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    print(f"Fish Friends → http://localhost:{port}   (ctrl-c to stop)")
    ThreadingHTTPServer(("", port), NoCache).serve_forever()
