import copy
import json
import unittest

from objective_ml.contracts import ALLOWED_ML_CLASSES, ALLOWED_ML_TARGET
from objective_ml.model_pipeline import (
    load_logistic_artifact,
    load_model_card,
    load_model_registry,
    load_tree_candidate_artifact,
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


def with_baseline_deltas(**deltas):
    request = copy.deepcopy(base_request())
    request["baseline_relative"] = {
        **request["baseline_relative"],
        **deltas,
    }
    return request


def assert_clinician_only(test_case, response):
    test_case.assertEqual(
        response["visibility"],
        {
            "clinician_visible": True,
            "patient_visible": False,
            "chatbot_visible": False,
        },
    )


def assert_safe_response_text(test_case, payload):
    serialized = json.dumps(payload).lower()

    for forbidden in [
        "craving",
        "relapse",
        "withdrawal",
        "intoxication",
        "diagnosis",
        "treatment",
        "detox",
        "medication",
        "ciwa",
        "sobriety",
        "truthfulness",
        "patient_is_lying",
        "patient_is_safe",
        "patient_is_stable",
        "emergency",
        'chatbot_visible": true',
        'patient_visible": true',
        "dashboard",
        "interpretation",
    ]:
        test_case.assertNotIn(forbidden, serialized)


class ObjectiveMlStage8RegressionTest(unittest.TestCase):
    def test_all_golden_outputs_use_allowed_target_class_and_visibility(self):
        cases = [
            (
                "baseline",
                base_request(),
                "low_or_baseline_arousal_evidence",
            ),
            (
                "elevated",
                with_baseline_deltas(
                    ecg_median_hr_delta_bpm=24,
                    ecg_mean_hr_delta_bpm=22,
                    gsr_tonic_baseline_deviation_delta_raw=60,
                    ppg_pulse_rate_delta_bpm=18,
                ),
                "elevated_arousal_evidence",
            ),
            (
                "cooldown",
                with_baseline_deltas(
                    ecg_median_hr_delta_bpm=-16,
                    ecg_mean_hr_delta_bpm=-14,
                    gsr_tonic_baseline_deviation_delta_raw=-28,
                    ppg_pulse_rate_delta_bpm=-12,
                ),
                "recovery_cooldown",
            ),
            (
                "no_baseline",
                with_baseline_deltas(
                    baseline_state="unavailable",
                    readiness_confidence_modifier=0.6,
                ),
                "insufficient_reliable_data",
            ),
        ]

        for name, request, expected_class in cases:
            with self.subTest(name=name):
                response = predict_classical_pipeline(request)

                self.assertEqual(response["target"], ALLOWED_ML_TARGET)
                self.assertIn(response["predicted_class"], ALLOWED_ML_CLASSES)
                self.assertEqual(response["predicted_class"], expected_class)
                self.assertGreaterEqual(response["probability"], 0)
                self.assertLessEqual(response["probability"], 1)
                self.assertIsInstance(response["uncertainty_reasons"], list)
                assert_clinician_only(self, response)
                assert_safe_response_text(self, response)

    def test_quality_gates_override_artifact_predictions(self):
        motion_payload = with_baseline_deltas(
            ecg_median_hr_delta_bpm=24,
            gsr_tonic_baseline_deviation_delta_raw=60,
            ppg_pulse_rate_delta_bpm=18,
        )
        motion_payload["cross_signal"]["high_motion_confound_present"] = True

        conflict_payload = with_baseline_deltas(
            ecg_median_hr_delta_bpm=24,
            gsr_tonic_baseline_deviation_delta_raw=60,
            ppg_pulse_rate_delta_bpm=18,
        )
        conflict_payload["cross_signal"]["signal_conflict_score"] = 0.8

        suppressed_payload = with_baseline_deltas(
            ecg_median_hr_delta_bpm=24,
            gsr_tonic_baseline_deviation_delta_raw=60,
            ppg_pulse_rate_delta_bpm=18,
        )
        suppressed_payload["features"]["ecg"]["suppression"]["suppressed"] = True

        cases = [
            ("motion", motion_payload, "high_motion_confound"),
            ("conflict", conflict_payload, "signal_conflict"),
            (
                "suppressed_ecg",
                suppressed_payload,
                "ecg_primary_feature_unavailable",
            ),
        ]

        for name, request, expected_reason in cases:
            with self.subTest(name=name):
                response = predict_classical_pipeline(request)

                self.assertEqual(
                    response["predicted_class"],
                    "insufficient_reliable_data",
                )
                self.assertEqual(
                    response["confidence_label"],
                    "insufficient_confidence",
                )
                self.assertIn(expected_reason, response["uncertainty_reasons"])
                self.assertIn(
                    "classical_pipeline_suppressed",
                    response["uncertainty_reasons"],
                )
                assert_clinician_only(self, response)
                assert_safe_response_text(self, response)

    def test_inference_is_deterministic_for_same_input(self):
        payload = with_baseline_deltas(
            ecg_median_hr_delta_bpm=24,
            ecg_mean_hr_delta_bpm=22,
            gsr_tonic_baseline_deviation_delta_raw=60,
            ppg_pulse_rate_delta_bpm=18,
        )

        first = predict_classical_pipeline(copy.deepcopy(payload))
        second = predict_classical_pipeline(copy.deepcopy(payload))

        self.assertEqual(first, second)

    def test_artifacts_are_dev_only_and_allowlist_bounded(self):
        artifacts = validate_model_artifacts()
        registry = artifacts["registry"]
        model_card = artifacts["model_card"]

        self.assertEqual(registry["target"], ALLOWED_ML_TARGET)
        self.assertIs(registry["patient_visible"], False)
        self.assertIs(registry["chatbot_visible"], False)
        self.assertEqual(model_card["validation_status"], "dev_only")
        self.assertIs(model_card["visibility"]["patient_visible"], False)
        self.assertIs(model_card["visibility"]["chatbot_visible"], False)

        for artifact in [
            load_logistic_artifact(),
            load_tree_candidate_artifact(),
        ]:
            self.assertEqual(artifact["target"], ALLOWED_ML_TARGET)
            self.assertLessEqual(
                set(artifact["allowed_classes"]),
                ALLOWED_ML_CLASSES,
            )

    def test_artifact_targets_and_classes_do_not_use_forbidden_clinical_names(self):
        serialized = json.dumps(
            {
                "registry": load_model_registry(),
                "model_card": load_model_card(),
                "logistic": load_logistic_artifact(),
                "tree": load_tree_candidate_artifact(),
            }
        ).lower()

        for forbidden in [
            "craving",
            "relapse",
            "withdrawal",
            "intoxication",
            "diagnosis",
            "treatment",
            "detox",
            "medication",
            "ciwa",
            "sobriety",
            "truthfulness",
            "patient_is_lying",
            "patient_is_safe",
            "patient_is_stable",
            "emergency",
        ]:
            self.assertNotIn(forbidden, serialized)

    def test_forbidden_request_payloads_are_rejected_before_prediction(self):
        payload = base_request()
        payload["target"] = "relapse_risk"

        with self.assertRaisesRegex(ValueError, "forbidden|not allowed"):
            predict_classical_pipeline(payload)

        payload = base_request()
        payload["features"]["unsafe"] = {"diagnosis": "example"}

        with self.assertRaisesRegex(ValueError, "forbidden"):
            predict_classical_pipeline(payload)


if __name__ == "__main__":
    unittest.main()
