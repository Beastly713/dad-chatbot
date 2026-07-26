from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from .contracts import (
    ALLOWED_ML_CLASSES,
    ALLOWED_ML_TARGET,
    MODEL_VERSION,
    validate_inference_request,
    validate_inference_response,
)
from .model_stub import predict_rule_safe_inference
from .vectorizer import FEATURE_VECTOR_VERSION, build_feature_vector, scale_feature_vector

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"


def _load_json_artifact(name: str) -> dict[str, Any]:
    path = ARTIFACT_DIR / name

    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict):
        raise ValueError(f"artifact {name} must contain a JSON object")

    return payload


def load_model_registry() -> dict[str, Any]:
    return _load_json_artifact("model_registry.json")


def load_model_card() -> dict[str, Any]:
    registry = load_model_registry()
    path = registry.get("model_card_path")

    if not isinstance(path, str) or not path.endswith(".json"):
        raise ValueError("model registry must reference a JSON model card")

    return _load_json_artifact(path)


def load_logistic_artifact() -> dict[str, Any]:
    return _load_json_artifact("classical_baseline_logistic_ordinal_v1.json")


def load_tree_candidate_artifact() -> dict[str, Any]:
    return _load_json_artifact("gradient_boosted_tree_candidate_v1.json")


def validate_model_artifacts() -> dict[str, Any]:
    registry = load_model_registry()
    model_card = load_model_card()
    logistic = load_logistic_artifact()
    tree = load_tree_candidate_artifact()

    for artifact in [registry, model_card, logistic, tree]:
        if artifact.get("target") != ALLOWED_ML_TARGET:
            raise ValueError("model artifact target is not allowed")

    for artifact in [logistic, tree]:
        allowed_classes = artifact.get("allowed_classes")

        if not isinstance(allowed_classes, list):
            raise ValueError("model artifact must list allowed classes")

        for class_name in allowed_classes:
            if class_name not in ALLOWED_ML_CLASSES:
                raise ValueError("model artifact contains unsupported class")

    if registry.get("patient_visible") is not False:
        raise ValueError("model registry patient_visible must be false")

    if registry.get("chatbot_visible") is not False:
        raise ValueError("model registry chatbot_visible must be false")

    if model_card.get("validation_status") != "dev_only":
        raise ValueError("model card must remain dev_only in this commit")

    return {
        "registry": registry,
        "model_card": model_card,
        "logistic": logistic,
        "tree": tree,
    }


def _softmax(scores: dict[str, float]) -> dict[str, float]:
    max_score = max(scores.values())
    exp_scores = {
        class_name: math.exp(score - max_score)
        for class_name, score in scores.items()
    }
    total = sum(exp_scores.values())

    return {
        class_name: value / total
        for class_name, value in exp_scores.items()
    }


def _predict_logistic(
    request: dict[str, Any],
    logistic: dict[str, Any],
) -> dict[str, Any]:
    vector = build_feature_vector(request)
    scaler = logistic.get("scaler", {})
    mean = scaler.get("mean")
    scale = scaler.get("scale")

    if not isinstance(mean, list) or not isinstance(scale, list):
        raise ValueError("logistic artifact scaler is invalid")

    scaled = scale_feature_vector(vector["values"], mean, scale)
    weights = logistic.get("weights")
    bias = logistic.get("bias")

    if not isinstance(weights, dict) or not isinstance(bias, dict):
        raise ValueError("logistic artifact weights are invalid")

    scores: dict[str, float] = {}

    for class_name in [
        "elevated_arousal_evidence",
        "recovery_cooldown",
        "low_or_baseline_arousal_evidence",
    ]:
        class_weights = weights.get(class_name)
        class_bias = bias.get(class_name)

        if not isinstance(class_weights, list) or not isinstance(class_bias, (int, float)):
            raise ValueError("logistic artifact class parameters are invalid")

        if len(class_weights) != len(scaled):
            raise ValueError("logistic artifact feature dimensions do not match")

        scores[class_name] = float(class_bias) + sum(
            float(weight) * value for weight, value in zip(class_weights, scaled)
        )

    probabilities = _softmax(scores)
    predicted_class = max(probabilities, key=probabilities.get)

    return {
        "model_version": logistic["model_version"],
        "predicted_class": predicted_class,
        "probability": probabilities[predicted_class],
        "class_probabilities": probabilities,
        "feature_vector": vector,
    }


def _condition_matches(named_values: dict[str, float], condition: list[Any]) -> bool:
    if len(condition) != 3:
        raise ValueError("tree condition must have three entries")

    feature_name, operator, threshold = condition

    if not isinstance(feature_name, str):
        raise ValueError("tree condition feature must be a string")

    if not isinstance(operator, str):
        raise ValueError("tree condition operator must be a string")

    if not isinstance(threshold, (int, float)):
        raise ValueError("tree condition threshold must be numeric")

    if feature_name.startswith("abs_"):
        value = abs(named_values.get(feature_name[4:], 0.0))
    else:
        value = named_values.get(feature_name, 0.0)

    threshold_value = float(threshold)

    if operator == ">=":
        return value >= threshold_value

    if operator == "<=":
        return value <= threshold_value

    if operator == "<":
        return value < threshold_value

    if operator == ">":
        return value > threshold_value

    raise ValueError("tree condition operator is unsupported")


def _predict_tree_candidate(
    request: dict[str, Any],
    tree: dict[str, Any],
) -> dict[str, Any]:
    vector = build_feature_vector(request)
    named_values = vector["named_values"]
    rules = tree.get("rules")

    if not isinstance(rules, list):
        raise ValueError("tree artifact rules must be a list")

    for rule in rules:
        if not isinstance(rule, dict):
            raise ValueError("tree artifact rule must be an object")

        class_name = rule.get("class")
        conditions = rule.get("conditions")
        score = rule.get("score")

        if class_name not in ALLOWED_ML_CLASSES:
            raise ValueError("tree artifact rule class is unsupported")

        if not isinstance(conditions, list):
            raise ValueError("tree artifact rule conditions must be a list")

        if not isinstance(score, (int, float)):
            raise ValueError("tree artifact rule score must be numeric")

        if all(_condition_matches(named_values, condition) for condition in conditions):
            return {
                "model_version": tree["model_version"],
                "predicted_class": class_name,
                "probability": float(score),
                "feature_vector": vector,
            }

    fallback_class = tree.get("fallback_class")
    fallback_score = tree.get("fallback_score")

    if fallback_class not in ALLOWED_ML_CLASSES:
        raise ValueError("tree fallback class is unsupported")

    if not isinstance(fallback_score, (int, float)):
        raise ValueError("tree fallback score must be numeric")

    return {
        "model_version": tree["model_version"],
        "predicted_class": fallback_class,
        "probability": float(fallback_score),
        "feature_vector": vector,
    }


def _confidence_label(probability: float, suppressed: bool) -> str:
    if suppressed:
        return "insufficient_confidence"

    if probability >= 0.65:
        return "moderate_confidence"

    return "low_confidence"


def _response(
    predicted_class: str,
    probability: float,
    uncertainty_reasons: list[str],
    suppression_state: str,
) -> dict[str, Any]:
    return validate_inference_response(
        {
            "target": ALLOWED_ML_TARGET,
            "predicted_class": predicted_class,
            "confidence_label": _confidence_label(
                probability,
                predicted_class == "insufficient_reliable_data",
            ),
            "probability": round(max(0.0, min(1.0, probability)), 4),
            "uncertainty_reasons": list(dict.fromkeys(uncertainty_reasons)),
            "suppression_state": suppression_state,
            "model_version": MODEL_VERSION,
            "visibility": {
                "clinician_visible": True,
                "patient_visible": False,
                "chatbot_visible": False,
            },
        }
    )


def predict_classical_pipeline(payload: Any) -> dict[str, Any]:
    request = validate_inference_request(payload)
    artifacts = validate_model_artifacts()

    # Reuse Commit 38 safety gate. The artifact-backed model cannot override
    # missing baseline, high conflict, high motion, or suppressed primary data.
    gated = predict_rule_safe_inference(request)

    if gated["predicted_class"] == "insufficient_reliable_data":
        return _response(
            predicted_class="insufficient_reliable_data",
            probability=0.0,
            uncertainty_reasons=gated["uncertainty_reasons"] + ["classical_pipeline_suppressed"],
            suppression_state=gated["suppression_state"],
        )

    logistic = _predict_logistic(request, artifacts["logistic"])
    tree = _predict_tree_candidate(request, artifacts["tree"])

    if tree["predicted_class"] == logistic["predicted_class"]:
        predicted_class = tree["predicted_class"]
        probability = min(0.85, max(float(tree["probability"]), float(logistic["probability"])))
        reasons = [
            *gated["uncertainty_reasons"],
            "classical_models_agree",
            f"feature_vector_version:{FEATURE_VECTOR_VERSION}",
        ]
    else:
        # Conservative disagreement handling: keep the rule-safe class and lower confidence.
        predicted_class = gated["predicted_class"]
        probability = min(0.6, float(gated["probability"]))
        reasons = [
            *gated["uncertainty_reasons"],
            "classical_models_disagree",
            f"feature_vector_version:{FEATURE_VECTOR_VERSION}",
        ]

    return _response(
        predicted_class=predicted_class,
        probability=probability,
        uncertainty_reasons=reasons,
        suppression_state="not_suppressed",
    )
