"""Serve the arcade without exposing local credentials or development data."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        try:
            parts = path.relative_to(ROOT).parts
        except ValueError:
            self.send_error(404)
            return None
        if any(part.startswith(".") for part in parts) or (parts and parts[0] == "dev"):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.bind, args.port), partial(Handler, directory=str(ROOT)))
    print(f"Arcade: http://{args.bind}:{args.port}", flush=True)
    server.serve_forever()
