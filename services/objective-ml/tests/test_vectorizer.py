import unittest

from objective_ml.vectorizer import (
    FEATURE_NAMES,
    FEATURE_VECTOR_VERSION,
    build_feature_vector,
    scale_feature_vector,
)


class ObjectiveMlVectorizerTest(unittest.TestCase):
    def test_builds_named_feature_vector(self):
        payload = {
            "features": {
                "ecg": {
                    "r_peak_quality_score": 0.9,
                },
                "gsr": {
                    "gsr_quality_score": 0.8,
                },
                "ppg": {
                    "waveform_quality_score": 0.7,
                },
                "imu": {
                    "activity_like_confound_index": 0.2,
                },
            },
            "baseline_relative": {
                "ecg_median_hr_delta_bpm": 12,
                "gsr_tonic_baseline_deviation_delta_raw": 25,
                "ppg_pulse_rate_delta_bpm": 10,
                "readiness_confidence_modifier": 1,
            },
            "cross_signal": {
                "signal_conflict_score": 0.1,
                "motion_confound_index": 0.2,
            },
        }

        vector = build_feature_vector(payload)

        self.assertEqual(vector["feature_vector_version"], FEATURE_VECTOR_VERSION)
        self.assertEqual(vector["feature_names"], FEATURE_NAMES)
        self.assertEqual(
            vector["named_values"]["ecg_median_hr_delta_bpm"],
            12.0,
        )
        self.assertEqual(vector["named_values"]["gsr_quality"], 0.8)
        self.assertEqual(len(vector["values"]), len(FEATURE_NAMES))

    def test_missing_values_default_to_safe_numbers(self):
        vector = build_feature_vector({})

        self.assertEqual(vector["named_values"]["ecg_median_hr_delta_bpm"], 0.0)
        self.assertEqual(vector["named_values"]["readiness_confidence_modifier"], 0.6)
        self.assertEqual(vector["named_values"]["signal_conflict_score"], 0.0)

    def test_scales_feature_vector(self):
        scaled = scale_feature_vector([10, 20], [0, 10], [10, 5])

        self.assertEqual(scaled, [1.0, 2.0])

    def test_rejects_scaler_dimension_mismatch(self):
        with self.assertRaisesRegex(ValueError, "dimensions"):
            scale_feature_vector([1, 2], [0], [1])


if __name__ == "__main__":
    unittest.main()
