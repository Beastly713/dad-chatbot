import unittest

from objective_ml.contracts import (
    ALLOWED_ML_TARGET,
    MODEL_VERSION,
    create_unavailable_scaffold_response,
    validate_inference_request,
    validate_inference_response,
)


def valid_request():
    return {
        "request_id": "request-1",
        "feature_window_id": "feature-window-1",
        "session_id": "session-1",
        "feature_schema_version": "objective-feature-window-foundation-v1",
        "preprocessing_version": "objective-preprocessing-v1",
        "features": {
            "ecg": {
                "median_hr_bpm": 75,
            }
        },
        "baseline_relative": {
            "baseline_state": "available",
        },
        "quality": {
            "window_status": "ready",
        },
        "missingness": {
            "ecg": {
                "missing_fraction": 0,
            }
        },
        "modality_availability": {
            "ecg": {
                "state": "available",
            }
        },
        "cross_signal": {
            "signal_conflict_score": 0,
        },
        "uncertainty_reasons": [],
        "timeout_ms": 1000,
    }


class ObjectiveMlContractsTest(unittest.TestCase):
    def test_accepts_valid_inference_request(self):
        result = validate_inference_request(valid_request())

        self.assertEqual(result["request_id"], "request-1")
        self.assertEqual(result["timeout_ms"], 1000)

    def test_rejects_forbidden_request_terms(self):
        payload = valid_request()
        payload["features"] = {
            "relapse_risk": "high",
        }

        with self.assertRaisesRegex(ValueError, "forbidden"):
            validate_inference_request(payload)

    def test_rejects_invalid_request_shape(self):
        payload = valid_request()
        payload["features"] = []

        with self.assertRaisesRegex(ValueError, "features must be a JSON object"):
            validate_inference_request(payload)

        payload = valid_request()
        payload["timeout_ms"] = 0

        with self.assertRaisesRegex(ValueError, "timeout_ms"):
            validate_inference_request(payload)

    def test_scaffold_response_is_contract_valid(self):
        response = create_unavailable_scaffold_response()
        validated = validate_inference_response(response)

        self.assertEqual(validated["target"], ALLOWED_ML_TARGET)
        self.assertEqual(validated["predicted_class"], "insufficient_reliable_data")
        self.assertEqual(validated["confidence_label"], "insufficient_confidence")
        self.assertEqual(validated["probability"], 0.0)
        self.assertEqual(validated["model_version"], MODEL_VERSION)
        self.assertEqual(
            validated["visibility"],
            {
                "clinician_visible": True,
                "patient_visible": False,
                "chatbot_visible": False,
            },
        )

    def test_rejects_forbidden_response_target_or_class(self):
        response = create_unavailable_scaffold_response()
        response["target"] = "unsupported_safe_target"

        with self.assertRaisesRegex(ValueError, "target"):
            validate_inference_response(response)

        response = create_unavailable_scaffold_response()
        response["predicted_class"] = "unsupported_safe_class"

        with self.assertRaisesRegex(ValueError, "predicted_class"):
            validate_inference_response(response)

    def test_rejects_patient_or_chatbot_visible_response(self):
        response = create_unavailable_scaffold_response()
        response["visibility"] = {
            "clinician_visible": True,
            "patient_visible": False,
            "chatbot_visible": True,
        }

        with self.assertRaisesRegex(ValueError, "visibility"):
            validate_inference_response(response)


if __name__ == "__main__":
    unittest.main()
