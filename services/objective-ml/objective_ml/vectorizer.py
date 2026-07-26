from __future__ import annotations

from typing import Any

FEATURE_VECTOR_VERSION = "objective-feature-vector-v1"

FEATURE_NAMES = [
    "ecg_median_hr_delta_bpm",
    "gsr_tonic_baseline_deviation_delta_raw",
    "ppg_pulse_rate_delta_bpm",
    "motion_confound_index",
    "signal_conflict_score",
    "readiness_confidence_modifier",
    "ecg_quality",
    "gsr_quality",
    "ppg_quality",
]


def _as_object(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return default

    if isinstance(value, (int, float)):
        return float(value)

    return default


def _nested(payload: dict[str, Any], *path: str) -> Any:
    current: Any = payload

    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)

    return current


def _quality(payload: dict[str, Any], modality: str, key: str) -> float:
    value = _nested(payload, "features", modality, key)
    return _as_float(value, 0.0)


def build_feature_vector(payload: dict[str, Any]) -> dict[str, Any]:
    baseline_relative = _as_object(payload.get("baseline_relative"))
    cross_signal = _as_object(payload.get("cross_signal"))

    values = {
        "ecg_median_hr_delta_bpm": _as_float(
            baseline_relative.get("ecg_median_hr_delta_bpm"),
            0.0,
        ),
        "gsr_tonic_baseline_deviation_delta_raw": _as_float(
            baseline_relative.get("gsr_tonic_baseline_deviation_delta_raw"),
            0.0,
        ),
        "ppg_pulse_rate_delta_bpm": _as_float(
            baseline_relative.get("ppg_pulse_rate_delta_bpm"),
            0.0,
        ),
        "motion_confound_index": _as_float(
            cross_signal.get("motion_confound_index"),
            _as_float(_nested(payload, "features", "imu", "activity_like_confound_index"), 0.0),
        ),
        "signal_conflict_score": _as_float(
            cross_signal.get("signal_conflict_score"),
            0.0,
        ),
        "readiness_confidence_modifier": _as_float(
            baseline_relative.get("readiness_confidence_modifier"),
            0.6,
        ),
        "ecg_quality": _quality(payload, "ecg", "r_peak_quality_score"),
        "gsr_quality": _quality(payload, "gsr", "gsr_quality_score"),
        "ppg_quality": _quality(payload, "ppg", "waveform_quality_score"),
    }

    return {
        "feature_vector_version": FEATURE_VECTOR_VERSION,
        "feature_names": FEATURE_NAMES,
        "values": [values[name] for name in FEATURE_NAMES],
        "named_values": values,
    }


def scale_feature_vector(
    values: list[float],
    mean: list[float],
    scale: list[float],
) -> list[float]:
    if len(values) != len(mean) or len(values) != len(scale):
        raise ValueError("feature vector scaler dimensions do not match")

    scaled: list[float] = []

    for value, mean_value, scale_value in zip(values, mean, scale):
        denominator = scale_value if scale_value != 0 else 1.0
        scaled.append((value - mean_value) / denominator)

    return scaled
