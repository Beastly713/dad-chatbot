from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from .contracts import (
    ML_SERVICE_VERSION,
    MODEL_VERSION,
    create_unavailable_scaffold_response,
    validate_inference_request,
    validate_inference_response,
)


class ObjectiveMlHandler(BaseHTTPRequestHandler):
    server_version = "ObjectiveML/0.0.0"

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> Any:
        content_length = int(self.headers.get("content-length", "0"))

        if content_length <= 0:
            raise ValueError("request body is required")

        raw_body = self.rfile.read(content_length)

        try:
            return json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError("request body must be valid JSON") from error

    def log_message(self, format: str, *args: Any) -> None:
        # Keep tests and local dev output quiet by default.
        return

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path == "/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "objective-ml",
                    "service_version": ML_SERVICE_VERSION,
                    "model_version": MODEL_VERSION,
                    "model_loaded": False,
                    "db_write_enabled": False,
                },
            )
            return

        if path == "/model/version":
            self._send_json(
                200,
                {
                    "model_version": MODEL_VERSION,
                    "model_loaded": False,
                    "allowed_target": "baseline_relative_elevated_physiological_arousal_evidence",
                    "db_write_enabled": False,
                },
            )
            return

        self._send_json(
            404,
            {
                "ok": False,
                "error": "not_found",
            },
        )

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        if path != "/infer":
            self._send_json(
                404,
                {
                    "ok": False,
                    "error": "not_found",
                },
            )
            return

        try:
            request_payload = self._read_json_body()
            validate_inference_request(request_payload)
            response_payload = create_unavailable_scaffold_response()
            validated_response = validate_inference_response(response_payload)
        except ValueError as error:
            self._send_json(
                400,
                {
                    "ok": False,
                    "error": str(error),
                    "db_write_enabled": False,
                },
            )
            return

        self._send_json(
            200,
            {
                "ok": True,
                "inference": validated_response,
                "db_write_enabled": False,
            },
        )


def run_server(host: str = "127.0.0.1", port: int = 8091) -> None:
    server = ThreadingHTTPServer((host, port), ObjectiveMlHandler)

    try:
        server.serve_forever()
    finally:
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Objective ML service scaffold")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8091, type=int)
    args = parser.parse_args()

    run_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
