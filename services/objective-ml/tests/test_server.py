import json
import unittest
from io import BytesIO

from objective_ml.server import ObjectiveMlHandler


class FakeSocket:
    def makefile(self, *args, **kwargs):
        return BytesIO()


def make_handler(method: str, path: str, body: dict | None = None):
    handler = ObjectiveMlHandler.__new__(ObjectiveMlHandler)
    handler.rfile = BytesIO(json.dumps(body or {}).encode("utf-8"))
    handler.wfile = BytesIO()
    handler.client_address = ("127.0.0.1", 12345)
    handler.server = object()
    body_length = len(json.dumps(body or {}).encode("utf-8"))

    handler.command = method
    handler.path = path
    handler.requestline = f"{method} {path} HTTP/1.1"
    handler.request_version = "HTTP/1.1"
    handler.headers = {
        "content-length": str(body_length),
    }

    return handler


def response_body(handler) -> dict:
    raw = handler.wfile.getvalue()
    _, _, body = raw.partition(b"\r\n\r\n")

    return json.loads(body.decode("utf-8"))


class ObjectiveMlServerTest(unittest.TestCase):
    def test_health_endpoint(self):
        handler = make_handler("GET", "/health")

        handler.do_GET()
        body = response_body(handler)

        self.assertEqual(body["ok"], True)
        self.assertEqual(body["service"], "objective-ml")
        self.assertEqual(body["model_loaded"], False)
        self.assertEqual(body["db_write_enabled"], False)

    def test_model_version_endpoint(self):
        handler = make_handler("GET", "/model/version")

        handler.do_GET()
        body = response_body(handler)

        self.assertEqual(body["model_loaded"], False)
        self.assertEqual(body["db_write_enabled"], False)
        self.assertEqual(
            body["allowed_target"],
            "baseline_relative_elevated_physiological_arousal_evidence",
        )

    def test_infer_endpoint_returns_safe_unavailable_response(self):
        request = {
            "request_id": "request-1",
            "feature_window_id": "feature-window-1",
            "session_id": "session-1",
            "feature_schema_version": "objective-feature-window-foundation-v1",
            "preprocessing_version": "objective-preprocessing-v1",
            "features": {},
            "baseline_relative": {},
            "quality": {},
            "missingness": {},
            "modality_availability": {},
            "cross_signal": {},
            "uncertainty_reasons": [],
            "timeout_ms": 1000,
        }
        handler = make_handler("POST", "/infer", request)

        handler.do_POST()
        body = response_body(handler)

        self.assertEqual(body["ok"], True)
        self.assertEqual(body["db_write_enabled"], False)
        self.assertEqual(
            body["inference"]["target"],
            "baseline_relative_elevated_physiological_arousal_evidence",
        )
        self.assertEqual(
            body["inference"]["predicted_class"],
            "insufficient_reliable_data",
        )
        self.assertEqual(
            body["inference"]["visibility"],
            {
                "clinician_visible": True,
                "patient_visible": False,
                "chatbot_visible": False,
            },
        )

    def test_infer_endpoint_rejects_forbidden_request(self):
        request = {
            "request_id": "request-1",
            "feature_window_id": "feature-window-1",
            "session_id": "session-1",
            "feature_schema_version": "objective-feature-window-foundation-v1",
            "preprocessing_version": "objective-preprocessing-v1",
            "features": {
                "relapse_risk": "high",
            },
            "baseline_relative": {},
            "quality": {},
            "missingness": {},
            "modality_availability": {},
            "cross_signal": {},
            "uncertainty_reasons": [],
            "timeout_ms": 1000,
        }
        handler = make_handler("POST", "/infer", request)

        handler.do_POST()
        body = response_body(handler)

        self.assertEqual(body["ok"], False)
        self.assertEqual(body["db_write_enabled"], False)
        self.assertIn("forbidden", body["error"])


if __name__ == "__main__":
    unittest.main()
