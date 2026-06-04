import json
import unittest

from objective_ml.contracts import ALLOWED_ML_TARGET, MODEL_VERSION
from objective_ml.model_pipeline import (
    load_model_card,
    load_model_registry,
    predict_classical_pipeline,
    validate_model_artifacts,
)


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
                "r_peak_quality_score": 0.9,
                "suppression": {
                    "suppressed": False,
                    "reasons": [],
                },
            },
            "gsr": {
                "gsr_quality_score": 0.9,
                "suppression": {
                    "suppressed": False,
                    "reasons": [],
                },
            },
            "ppg": {
                "waveform_quality_score": 0.8,
                "suppression": {
                    "suppressed": False,
                    "reasons": [],
                },
            },
            "imu": {
                "activity_like_confound_index": 0.1,
                "suppression": {
                    "suppressed": False,
                    "reasons": [],
                },
            },
        },
        "baseline_relative": {
            "baseline_state": "available",
            "readiness_confidence_modifier": 1,
            "ecg_median_hr_delta_bpm": 0,
            "ecg_mean_hr_delta_bpm": 0,
            "gsr_tonic_baseline_deviation_delta_raw": 0,
            "ppg_pulse_rate_delta_bpm": 0,
            "motion_magnitude_delta": 0,
        },
        "quality": {
            "window_status": "ready",
        },
        "missingness": {},
        "modality_availability": {},
        "cross_signal": {
            "signal_conflict_score": 0,
            "high_motion_confound_present": False,
            "motion_confound_index": 0.1,
        },
        "uncertainty_reasons": [],
        "timeout_ms": 1000,
    }


class ObjectiveMlModelPipelineTest(unittest.TestCase):
    def test_loads_registry_and_model_card_metadata(self):
        registry = load_model_registry()
        model_card = load_model_card()

        self.assertEqual(registry["active_model_version"], MODEL_VERSION)
        self.assertEqual(registry["target"], ALLOWED_ML_TARGET)
        self.assertEqual(model_card["model_version"], MODEL_VERSION)
        self.assertEqual(model_card["validation_status"], "dev_only")
        self.assertEqual(model_card["visibility"]["patient_visible"], False)
        self.assertEqual(model_card["visibility"]["chatbot_visible"], False)

    def test_validates_model_artifacts(self):
        artifacts = validate_model_artifacts()

        self.assertIn("registry", artifacts)
        self.assertIn("logistic", artifacts)
        self.assertIn("tree", artifacts)
        self.assertIn("model_card", artifacts)

    def test_predicts_low_or_baseline_class(self):
        response = predict_classical_pipeline(base_request())

        self.assertEqual(response["target"], ALLOWED_ML_TARGET)
        self.assertEqual(
            response["predicted_class"],
            "low_or_baseline_arousal_evidence",
        )
        self.assertEqual(response["model_version"], MODEL_VERSION)
        self.assertEqual(response["visibility"]["patient_visible"], False)
        self.assertEqual(response["visibility"]["chatbot_visible"], False)

    def test_predicts_elevated_class_when_classical_models_agree(self):
        payload = base_request()
        payload["baseline_relative"] = {
            **payload["baseline_relative"],
            "ecg_median_hr_delta_bpm": 24,
            "ecg_mean_hr_delta_bpm": 22,
            "gsr_tonic_baseline_deviation_delta_raw": 60,
            "ppg_pulse_rate_delta_bpm": 18,
        }

        response = predict_classical_pipeline(payload)

        self.assertEqual(response["predicted_class"], "elevated_arousal_evidence")
        self.assertEqual(response["suppression_state"], "not_suppressed")
        self.assertIn("classical_models_agree", response["uncertainty_reasons"])
        self.assertGreater(response["probability"], 0.6)

    def test_predicts_recovery_class_for_cooling_pattern(self):
        payload = base_request()
        payload["baseline_relative"] = {
            **payload["baseline_relative"],
            "ecg_median_hr_delta_bpm": -16,
            "ecg_mean_hr_delta_bpm": -14,
            "gsr_tonic_baseline_deviation_delta_raw": -28,
            "ppg_pulse_rate_delta_bpm": -12,
        }

        response = predict_classical_pipeline(payload)

        self.assertEqual(response["predicted_class"], "recovery_cooldown")
        self.assertEqual(response["suppression_state"], "not_suppressed")

    def test_quality_gate_still_suppresses_before_model_output(self):
        payload = base_request()
        payload["baseline_relative"] = {
            "baseline_state": "unavailable",
            "readiness_confidence_modifier": 0.6,
        }

        response = predict_classical_pipeline(payload)

        self.assertEqual(response["predicted_class"], "insufficient_reliable_data")
        self.assertEqual(response["confidence_label"], "insufficient_confidence")
        self.assertIn("classical_pipeline_suppressed", response["uncertainty_reasons"])

    def test_rejects_forbidden_or_unsupported_target(self):
        payload = base_request()
        payload["target"] = "unsupported_arousal_target"

        with self.assertRaisesRegex(ValueError, "target is not allowed"):
            predict_classical_pipeline(payload)

        payload = base_request()
        payload["target"] = "relapse_risk"

        with self.assertRaisesRegex(ValueError, "forbidden"):
            predict_classical_pipeline(payload)

    def test_artifact_metadata_has_no_forbidden_clinical_target_names(self):
        serialized = json.dumps(
            {
                "registry": load_model_registry(),
                "model_card": load_model_card(),
            }
        ).lower()

        for forbidden in [
            "relapse",
            "withdrawal",
            "intoxication",
            "craving",
            "diagnosis",
            "treatment_need",
            "detox",
            "medication",
            "ciwa",
            "sobriety",
            "truthfulness",
            "patient_is_lying",
        ]:
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
