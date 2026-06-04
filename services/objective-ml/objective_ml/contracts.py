from __future__ import annotations

from typing import Any

ML_SERVICE_VERSION = "objective-ml-service-scaffold-v1"
MODEL_VERSION = "objective-ml-no-model-scaffold-v1"

ALLOWED_ML_TARGET = "baseline_relative_elevated_physiological_arousal_evidence"

ALLOWED_ML_CLASSES = {
    "low_or_baseline_arousal_evidence",
    "elevated_arousal_evidence",
    "recovery_cooldown",
    "insufficient_reliable_data",
}

ALLOWED_CONFIDENCE_LABELS = {
    "low_confidence",
    "moderate_confidence",
    "insufficient_confidence",
}

FORBIDDEN_SUBSTRINGS = {
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
}


def _is_json_object(value: Any) -> bool:
    return isinstance(value, dict)


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and len(value.strip()) > 0


def _contains_forbidden_text(value: Any) -> bool:
    if isinstance(value, str):
        lowered = value.lower()
        return any(forbidden in lowered for forbidden in FORBIDDEN_SUBSTRINGS)

    if isinstance(value, dict):
        return any(
            _contains_forbidden_text(key) or _contains_forbidden_text(item)
            for key, item in value.items()
        )

    if isinstance(value, list):
        return any(_contains_forbidden_text(item) for item in value)

    return False


def validate_inference_request(payload: Any) -> dict[str, Any]:
    if not _is_json_object(payload):
        raise ValueError("inference request must be a JSON object")

    if _contains_forbidden_text(payload):
        raise ValueError("inference request contains forbidden clinical or unsafe wording")

    request_id = payload.get("request_id")
    feature_window_id = payload.get("feature_window_id")
    session_id = payload.get("session_id")
    feature_schema_version = payload.get("feature_schema_version")
    preprocessing_version = payload.get("preprocessing_version")
    features = payload.get("features")
    baseline_relative = payload.get("baseline_relative")
    quality = payload.get("quality")
    missingness = payload.get("missingness")
    modality_availability = payload.get("modality_availability")
    cross_signal = payload.get("cross_signal")
    uncertainty_reasons = payload.get("uncertainty_reasons")
    timeout_ms = payload.get("timeout_ms", 1000)

    for key, value in {
        "request_id": request_id,
        "feature_window_id": feature_window_id,
        "session_id": session_id,
        "feature_schema_version": feature_schema_version,
        "preprocessing_version": preprocessing_version,
    }.items():
        if not _is_non_empty_string(value):
            raise ValueError(f"{key} must be a non-empty string")

    for key, value in {
        "features": features,
        "baseline_relative": baseline_relative,
        "quality": quality,
        "missingness": missingness,
        "modality_availability": modality_availability,
    }.items():
        if not _is_json_object(value):
            raise ValueError(f"{key} must be a JSON object")

    if cross_signal is not None and not _is_json_object(cross_signal):
        raise ValueError("cross_signal must be a JSON object when present")

    if not isinstance(uncertainty_reasons, list) or any(
        not isinstance(reason, str) for reason in uncertainty_reasons
    ):
        raise ValueError("uncertainty_reasons must be an array of strings")

    if not isinstance(timeout_ms, int) or timeout_ms <= 0:
        raise ValueError("timeout_ms must be a positive integer")

    return {
        "request_id": request_id,
        "feature_window_id": feature_window_id,
        "session_id": session_id,
        "feature_schema_version": feature_schema_version,
        "preprocessing_version": preprocessing_version,
        "features": features,
        "baseline_relative": baseline_relative,
        "quality": quality,
        "missingness": missingness,
        "modality_availability": modality_availability,
        "cross_signal": cross_signal or {},
        "uncertainty_reasons": uncertainty_reasons,
        "timeout_ms": timeout_ms,
    }


def validate_inference_response(payload: Any) -> dict[str, Any]:
    if not _is_json_object(payload):
        raise ValueError("inference response must be a JSON object")

    if _contains_forbidden_text(payload):
        raise ValueError("inference response contains forbidden clinical or unsafe wording")

    target = payload.get("target")
    predicted_class = payload.get("predicted_class")
    confidence_label = payload.get("confidence_label")
    probability = payload.get("probability")
    uncertainty_reasons = payload.get("uncertainty_reasons")
    suppression_state = payload.get("suppression_state")
    model_version = payload.get("model_version")
    visibility = payload.get("visibility")

    if target != ALLOWED_ML_TARGET:
        raise ValueError("target is not allowed")

    if predicted_class not in ALLOWED_ML_CLASSES:
        raise ValueError("predicted_class is not allowed")

    if confidence_label not in ALLOWED_CONFIDENCE_LABELS:
        raise ValueError("confidence_label is not allowed")

    if not isinstance(probability, (int, float)) or probability < 0 or probability > 1:
        raise ValueError("probability must be between 0 and 1")

    if not isinstance(uncertainty_reasons, list) or any(
        not isinstance(reason, str) for reason in uncertainty_reasons
    ):
        raise ValueError("uncertainty_reasons must be an array of strings")

    if not _is_non_empty_string(suppression_state):
        raise ValueError("suppression_state must be a non-empty string")

    if not _is_non_empty_string(model_version):
        raise ValueError("model_version must be a non-empty string")

    if visibility != {
        "clinician_visible": True,
        "patient_visible": False,
        "chatbot_visible": False,
    }:
        raise ValueError("visibility must be clinician-only")

    return {
        "target": target,
        "predicted_class": predicted_class,
        "confidence_label": confidence_label,
        "probability": float(probability),
        "uncertainty_reasons": uncertainty_reasons,
        "suppression_state": suppression_state,
        "model_version": model_version,
        "visibility": visibility,
    }


def create_unavailable_scaffold_response() -> dict[str, Any]:
    """Return a contract-valid placeholder response.

    Commit 37 is not the model-stub commit. This response exists only so the
    inference endpoint can return a safe, unavailable state while proving the
    response contract.
    """

    return {
        "target": ALLOWED_ML_TARGET,
        "predicted_class": "insufficient_reliable_data",
        "confidence_label": "insufficient_confidence",
        "probability": 0.0,
        "uncertainty_reasons": ["ml_model_not_loaded"],
        "suppression_state": "suppressed_missing_data",
        "model_version": MODEL_VERSION,
        "visibility": {
            "clinician_visible": True,
            "patient_visible": False,
            "chatbot_visible": False,
        },
    }
