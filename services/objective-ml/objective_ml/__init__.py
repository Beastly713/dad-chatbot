"""Objective ML service scaffold.

This package is intentionally separate from the chatbot and objective backend.
It provides request/response contracts and a minimal HTTP service only.
"""

from .contracts import (
    ALLOWED_ML_CLASSES,
    ALLOWED_ML_TARGET,
    ML_SERVICE_VERSION,
    MODEL_VERSION,
    validate_inference_request,
    validate_inference_response,
)
from .model_stub import predict_rule_safe_inference

__all__ = [
    "ALLOWED_ML_CLASSES",
    "ALLOWED_ML_TARGET",
    "ML_SERVICE_VERSION",
    "MODEL_VERSION",
    "predict_rule_safe_inference",
    "validate_inference_request",
    "validate_inference_response",
]
