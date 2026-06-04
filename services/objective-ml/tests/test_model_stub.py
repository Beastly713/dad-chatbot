import unittest

from objective_ml.contracts import ALLOWED_ML_TARGET
from objective_ml.model_stub import predict_rule_safe_inference


def base_request():
    return {
        "request_id": "request-1",
        "feature_window_id": "feature-window-1",
        "session_id": "session-1",
        "target": ALLOWED_ML_TARGET,
        "feature_schema_version": "objective-feature-window-foundation-v1",
        "preprocessing_version": "objective-preprocessing-v1",
        "features": {
            "ecg": {
                "median_hr_bpm": 75,
            },
            "gsr": {
                "tonic_mean_microsiemens": 2.1,
            },
            "ppg": {
                "median_hr_bpm": 74,
            },
            "imu": {
                "activity_level": "still",
            },
        },
        "baseline_relative": {
            "baseline_state": "available",
            "ecg": {
                "hr_delta_bpm": 0,
            },
            "gsr": {
                "tonic_delta_percent": 0,
            },
            "ppg": {
                "hr_delta_bpm": 0,
            },
        },
        "quality": {
            "window_status": "ready",
            "readiness_modifier": 1,
            "imu": {
                "high_motion_confound_present": False,
            },
        },
        "missingness": {
            "ecg": {
                "missing_fraction": 0,
            },
            "gsr": {
                "missing_fraction": 0,
            },
        },
        "modality_availability": {
            "ecg": {
                "state": "available",
            },
            "gsr": {
                "state": "available",
            },
            "ppg": {
                "state": "available",
            },
        },
        "cross_signal": {
            "signal_conflict_score": 0,
            "high_motion_confound_present": False,
        },
        "uncertainty_reasons": [],
        "timeout_ms": 1000,
    }


class ObjectiveMlModelStubTest(unittest.TestCase):
    def test_near_baseline_returns_low_or_baseline_clinician_only(self):
        result = predict_rule_safe_inference(base_request())

        self.assertEqual(
            result["predicted_class"],
            "low_or_baseline_arousal_evidence",
        )
        self.assertEqual(result["suppression_state"], "not_suppressed")
        self.assertEqual(result["confidence_label"], "moderate_confidence")
        self.assertEqual(
            result["visibility"],
            {
                "clinician_visible": True,
                "patient_visible": False,
                "chatbot_visible": False,
            },
        )

    def test_positive_baseline_relative_deltas_return_elevated_arousal(self):
        request = base_request()
        request["baseline_relative"]["ecg"]["hr_delta_bpm"] = 12
        request["baseline_relative"]["gsr"]["tonic_delta_percent"] = 18
        request["baseline_relative"]["ppg"]["hr_delta_bpm"] = 11

        result = predict_rule_safe_inference(request)

        self.assertEqual(result["predicted_class"], "elevated_arousal_evidence")
        self.assertEqual(result["suppression_state"], "not_suppressed")
        self.assertGreater(result["probability"], 0.6)
        self.assertIn("hr_above_baseline", result["uncertainty_reasons"])
        self.assertIn("gsr_above_baseline", result["uncertainty_reasons"])

    def test_negative_baseline_relative_deltas_return_recovery_cooldown(self):
        request = base_request()
        request["baseline_relative"]["ecg"]["hr_delta_bpm"] = -9
        request["baseline_relative"]["gsr"]["tonic_delta_percent"] = -11
        request["baseline_relative"]["ppg"]["hr_delta_bpm"] = -8

        result = predict_rule_safe_inference(request)

        self.assertEqual(result["predicted_class"], "recovery_cooldown")
        self.assertEqual(result["suppression_state"], "not_suppressed")
        self.assertIn("hr_below_baseline", result["uncertainty_reasons"])
        self.assertIn("gsr_below_baseline", result["uncertainty_reasons"])

    def test_missing_baseline_suppresses_to_insufficient_reliable_data(self):
        request = base_request()
        request["baseline_relative"]["baseline_state"] = "unavailable"
        request["quality"]["readiness_modifier"] = 0.6

        result = predict_rule_safe_inference(request)

        self.assertEqual(result["predicted_class"], "insufficient_reliable_data")
        self.assertEqual(result["confidence_label"], "insufficient_confidence")
        self.assertIn("baseline_unavailable", result["uncertainty_reasons"])
        self.assertFalse(result["visibility"]["patient_visible"])
        self.assertFalse(result["visibility"]["chatbot_visible"])

    def test_high_motion_or_signal_conflict_suppresses_to_insufficient(self):
        request = base_request()
        request["cross_signal"]["high_motion_confound_present"] = True

        result = predict_rule_safe_inference(request)

        self.assertEqual(result["predicted_class"], "insufficient_reliable_data")
        self.assertIn("high_motion_confound", result["uncertainty_reasons"])

        request = base_request()
        request["cross_signal"]["signal_conflict_score"] = 0.5

        result = predict_rule_safe_inference(request)

        self.assertEqual(result["predicted_class"], "insufficient_reliable_data")
        self.assertIn("signal_conflict", result["uncertainty_reasons"])

    def test_suppressed_primary_features_suppress_to_insufficient(self):
        request = base_request()
        request["features"]["ecg"]["suppressed"] = True

        result = predict_rule_safe_inference(request)

        self.assertEqual(result["predicted_class"], "insufficient_reliable_data")
        self.assertIn("ecg_primary_feature_unavailable", result["uncertainty_reasons"])

    def test_rejects_unsupported_safe_or_forbidden_targets(self):
        request = base_request()
        request["target"] = "unsupported_safe_target"

        with self.assertRaisesRegex(ValueError, "target is not allowed"):
            predict_rule_safe_inference(request)

        request = base_request()
        request["target"] = "relapse_risk"

        with self.assertRaisesRegex(ValueError, "forbidden"):
            predict_rule_safe_inference(request)

    def test_visibility_is_never_patient_or_chatbot_visible(self):
        result = predict_rule_safe_inference(base_request())

        self.assertFalse(result["visibility"]["patient_visible"])
        self.assertFalse(result["visibility"]["chatbot_visible"])


if __name__ == "__main__":
    unittest.main()
