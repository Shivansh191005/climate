"""
LandSafe AI backend - AI explanation service

Correct flow (per project spec): XGBoost/CNN -> prediction -> SHAP factors
-> Bedrock -> human-readable explanation. Bedrock explains the model's
result; it never replaces the prediction itself.

Since Bedrock requires AWS credentials you haven't set up yet, this
service falls back to a local, template-based explanation built directly
from the real SHAP factors whenever `settings.bedrock_enabled` is False
or the Bedrock call fails - so the AI Assistant panel works immediately,
and upgrades to real Bedrock the moment you flip the setting on.
"""

import json
from typing import Optional

from app.config import settings


def _local_fallback_explanation(location_name: str, risk_level: str,
                                 probability: float, top_factors: list[dict],
                                 terrain_label: Optional[str]) -> str:
    top_two = top_factors[:2]
    factor_text = " and ".join(
        f"{f['factor'].replace('_', ' ')} ({f['percentage']}% contribution)" for f in top_two
    )

    lines = [
        f"{location_name} is currently assessed as {risk_level.upper()} risk "
        f"({probability * 100:.0f}% model confidence).",
        f"The main drivers behind this prediction are {factor_text}.",
    ]
    if terrain_label == "landslide":
        lines.append(
            "The uploaded terrain image was also classified as showing landslide-affected ground, "
            "reinforcing the risk assessment."
        )
    elif terrain_label == "non_landslide":
        lines.append(
            "The uploaded terrain image did not show visible landslide signs, "
            "which slightly offsets the environmental risk factors."
        )
    lines.append(
        "This is a model-generated risk assessment for a prototype system, not official "
        "safety guidance - always follow guidance from local disaster management authorities."
    )
    return " ".join(lines)


def _call_bedrock(prompt: str) -> Optional[str]:
    """Attempts a real Bedrock call. Returns None on any failure so the
    caller can fall back gracefully instead of crashing the request."""
    try:
        import boto3

        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}],
        })
        response = client.invoke_model(modelId=settings.bedrock_model_id, body=body)
        payload = json.loads(response["body"].read())
        return payload["content"][0]["text"]
    except Exception:
        return None


def explain_prediction(location_name: str, risk_level: str, probability: float,
                        top_factors: list[dict], terrain_label: Optional[str],
                        user_question: Optional[str] = None) -> tuple[str, str]:
    """Returns (explanation_text, source) where source is 'bedrock' or 'local_fallback'."""

    if settings.bedrock_enabled:
        factor_summary = ", ".join(f"{f['factor']}: {f['percentage']}%" for f in top_factors)
        prompt = (
            f"You are LandSafe AI's assistant. A landslide risk model predicted "
            f"{risk_level} risk ({probability * 100:.0f}% confidence) for {location_name}. "
            f"SHAP factor contributions: {factor_summary}. "
            f"Terrain image classification: {terrain_label or 'not provided'}. "
            f"{'User question: ' + user_question if user_question else ''} "
            f"In 2-3 sentences, explain in plain language why the area has this risk level, "
            f"based only on the given factors. Do not give specific evacuation instructions - "
            f"that is not your role."
        )
        bedrock_text = _call_bedrock(prompt)
        if bedrock_text:
            return bedrock_text, "bedrock"

    fallback = _local_fallback_explanation(
        location_name, risk_level, probability, top_factors, terrain_label
    )
    return fallback, "local_fallback"
