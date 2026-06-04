from __future__ import annotations

from typing import Any

from .contracts import (
    ALLOWED_ML_TARGET,
    RULE_SAFE_STUB_MODEL_VERSION,
    validate_inference_request,
    validate_inference_response,
)

STUB_VERSION = RULE_SAFE_STUB_MODEL_VERSION


def _as_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    return {}


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    return None


def _get_nested_float(payload: dict[str, Any], *path: str) -> float | None:
    cursor: Any = payload

    for key in path:
        if not isinstance(cursor, dict):
            return None

        cursor = cursor.get(key)

    return _as_float(cursor)


def _get_nested_bool(payload: dict[str, Any], *path: str) -> bool | None:
    cursor: Any = payload

    for key in path:
        if not isinstance(cursor, dict):
            return None

        cursor = cursor.get(key)

    if isinstance(cursor, bool):
        return cursor

    return None


def _unique_reasons(reasons: list[str]) -> list[str]:
    result: list[str] = []

    for reason in reasons:
        if reason not in result:
            result.append(reason)

    return result


def _confidence_label(probability: float, suppressed: bool) -> str:
    if suppressed:
        return "insufficient_confidence"

    if probability >= 0.65:
        return "moderate_confidence"

    return "low_confidence"


def _safe_visibility() -> dict[str, bool]:
    return {
        "clinician_visible": True,
        "patient_visible": False,
        "chatbot_visible": False,
    }


def _make_response(
    *,
    predicted_class: str,
    probability: float,
    reasons: list[str],
    suppression_state: str,
) -> dict[str, Any]:
    suppressed = suppression_state != "not_suppressed"
    response = {
        "target": ALLOWED_ML_TARGET,
        "predicted_class": predicted_class,
        "confidence_label": _confidence_label(probability, suppressed),
        "probability": probability,
        "uncertainty_reasons": _unique_reasons(reasons),
        "suppression_state": suppression_state,
        "model_version": STUB_VERSION,
        "visibility": _safe_visibility(),
    }

    return validate_inference_response(response)


def _baseline_state(request: dict[str, Any]) -> str:
    baseline_relative = _as_object(request.get("baseline_relative"))
    state = baseline_relative.get("baseline_state")

    if state == "available":
        return "available"

    return "unavailable"


def _readiness_modifier(request: dict[str, Any]) -> float | None:
    quality = _as_object(request.get("quality"))
    return _get_nested_float(quality, "readiness_modifier")


def _signal_conflict_score(request: dict[str, Any]) -> float:
    cross_signal = _as_object(request.get("cross_signal"))
    return _get_nested_float(cross_signal, "signal_conflict_score") or 0.0


def _motion_confound_present(request: dict[str, Any]) -> bool:
    cross_signal = _as_object(request.get("cross_signal"))
    imu_quality = _as_object(_as_object(request.get("quality")).get("imu"))

    return bool(
        _get_nested_bool(cross_signal, "high_motion_confound_present")
        or _get_nested_bool(imu_quality, "high_motion_confound_present")
    )


def _primary_feature_available(request: dict[str, Any], modality: str) -> bool:
    features = _as_object(request.get("features"))
    modality_features = _as_object(features.get(modality))

    if _get_nested_bool(modality_features, "suppressed"):
        return False

    modality_availability = _as_object(request.get("modality_availability"))
    modality_state = _as_object(modality_availability.get(modality)).get("state")

    if modality_state == "suppressed":
        return False

    return len(modality_features) > 0


def _quality_reasons(request: dict[str, Any]) -> list[str]:
    reasons = list(request.get("uncertainty_reasons") or [])

    if _baseline_state(request) != "available":
        reasons.append("baseline_unavailable")

    readiness = _readiness_modifier(request)
    if readiness is not None and readiness < 0.75:
        reasons.append("low_quality_readiness")

    if _signal_conflict_score(request) >= 0.5:
        reasons.append("signal_conflict")

    if _motion_confound_present(request):
        reasons.append("high_motion_confound")

    if not _primary_feature_available(request, "ecg"):
        reasons.append("ecg_primary_feature_unavailable")

    if not _primary_feature_available(request, "gsr"):
        reasons.append("gsr_primary_feature_unavailable")

    return _unique_reasons(reasons)


def _should_suppress(request: dict[str, Any]) -> bool:
    return (
        _baseline_state(request) != "available"
        or _signal_conflict_score(request) >= 0.5
        or _motion_confound_present(request)
        or not _primary_feature_available(request, "ecg")
        or not _primary_feature_available(request, "gsr")
    )


def _baseline_deltas(request: dict[str, Any]) -> dict[str, float | None]:
    baseline_relative = _as_object(request.get("baseline_relative"))

    return {
        "hr_delta_bpm": _get_nested_float(baseline_relative, "ecg", "hr_delta_bpm"),
        "gsr_delta_percent": _get_nested_float(
            baseline_relative,
            "gsr",
            "tonic_delta_percent",
        ),
        "ppg_delta_bpm": _get_nested_float(baseline_relative, "ppg", "hr_delta_bpm"),
    }


def _classify_from_deltas(
    deltas: dict[str, float | None],
) -> tuple[str, float, list[str]]:
    hr_delta = deltas["hr_delta_bpm"]
    gsr_delta = deltas["gsr_delta_percent"]
    ppg_delta = deltas["ppg_delta_bpm"]

    if (
        hr_delta is not None
        and hr_delta >= 10
        and gsr_delta is not None
        and gsr_delta >= 15
        and (ppg_delta is None or ppg_delta >= 10)
    ):
        reasons = ["hr_above_baseline", "gsr_above_baseline"]
        if ppg_delta is not None:
            reasons.append("ppg_above_baseline")

        return "elevated_arousal_evidence", 0.72, reasons

    if (
        hr_delta is not None
        and hr_delta <= -8
        and gsr_delta is not None
        and gsr_delta <= -10
        and (ppg_delta is None or ppg_delta <= -8)
    ):
        reasons = ["hr_below_baseline", "gsr_below_baseline"]
        if ppg_delta is not None:
            reasons.append("ppg_below_baseline")

        return "recovery_cooldown", 0.62, reasons

    if (
        hr_delta is not None
        and abs(hr_delta) <= 8
        and gsr_delta is not None
        and abs(gsr_delta) <= 12
        and (ppg_delta is None or abs(ppg_delta) <= 8)
    ):
        return "low_or_baseline_arousal_evidence", 0.66, ["features_near_baseline"]

    return "low_or_baseline_arousal_evidence", 0.52, ["mixed_or_weak_feature_pattern"]


def predict_rule_safe_inference(payload: Any) -> dict[str, Any]:
    request = validate_inference_request(payload)
    reasons = _quality_reasons(request)

    if _should_suppress(request):
        return _make_response(
            predicted_class="insufficient_reliable_data",
            probability=0.0,
            reasons=reasons,
            suppression_state="suppressed_missing_data",
        )

    predicted_class, probability, class_reasons = _classify_from_deltas(
        _baseline_deltas(request)
    )

    return _make_response(
        predicted_class=predicted_class,
        probability=probability,
        reasons=reasons + class_reasons,
        suppression_state="not_suppressed",
    )
