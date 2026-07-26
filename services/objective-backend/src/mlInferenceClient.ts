import {
    validateObjectiveMlInferenceRequest,
    validateObjectiveMlInferenceResponse,
    type ObjectiveMlInferenceRequest,
    type ObjectiveMlInferenceResponse,
    type ObjectiveMlJsonObject,
} from "./mlInferenceContract.js";
import type { ObjectiveFeatureWindowRecord } from "./featureStorage.js";

export type ObjectiveMlClientOptions = {
    base_url: string;
    infer_path?: string;
    timeout_ms?: number;
    fetch_impl?: typeof fetch;
};

export type ObjectiveMlServiceEnvelope = {
    ok: true;
    inference: ObjectiveMlInferenceResponse;
    db_write_enabled: false;
};

export type ObjectiveMlClient = {
    infer(
        request: ObjectiveMlInferenceRequest,
    ): Promise<ObjectiveMlInferenceResponse>;
};

function assertNonEmptyString(value: string | undefined, name: string): string {
    if (!value || value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return value;
}

function normalizeEndpoint(baseUrl: string, inferPath: string): string {
    const base = baseUrl.replace(/\/+$/, "");
    const path = inferPath.startsWith("/") ? inferPath : `/${inferPath}`;

    return `${base}${path}`;
}

function parseMlServiceEnvelope(payload: unknown): ObjectiveMlServiceEnvelope {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new Error("ML service response must be a JSON object");
    }

    const record = payload as Record<string, unknown>;

    if (record.ok !== true) {
        throw new Error("ML service response was not ok");
    }

    if (record.db_write_enabled !== false) {
        throw new Error("ML service response must confirm db_write_enabled false");
    }

    const inference = validateObjectiveMlInferenceResponse(record.inference);

    return {
        ok: true,
        inference,
        db_write_enabled: false,
    };
}

export function createObjectiveMlInferenceRequestFromFeatureWindow(
    featureWindow: ObjectiveFeatureWindowRecord,
    options: {
        request_id?: string;
        timeout_ms?: number;
    } = {},
): ObjectiveMlInferenceRequest {
    const featureWindowWithCrossSignal = featureWindow as ObjectiveFeatureWindowRecord & {
        cross_signal?: ObjectiveMlJsonObject;
    };

    return validateObjectiveMlInferenceRequest({
        request_id:
            options.request_id ??
            `ml-request:${featureWindow.feature_window_key}:${featureWindow.feature_schema_version}`,
        feature_window_id: featureWindow.id,
        session_id: featureWindow.session_id,
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        feature_schema_version: featureWindow.feature_schema_version,
        preprocessing_version: featureWindow.preprocessing_version,
        features: featureWindow.features,
        baseline_relative: featureWindow.baseline_relative,
        quality: featureWindow.quality,
        missingness: featureWindow.missingness,
        modality_availability: featureWindow.modality_availability,
        cross_signal: featureWindowWithCrossSignal.cross_signal ?? {},
        uncertainty_reasons: featureWindow.uncertainty_reasons,
        timeout_ms: options.timeout_ms ?? 1000,
    });
}

export class HttpObjectiveMlClient implements ObjectiveMlClient {
    private readonly endpoint: string;
    private readonly timeoutMs: number;
    private readonly fetchImpl: typeof fetch;

    constructor(options: ObjectiveMlClientOptions) {
        this.endpoint = normalizeEndpoint(
            assertNonEmptyString(options.base_url, "base_url"),
            options.infer_path ?? "/infer",
        );
        this.timeoutMs = options.timeout_ms ?? 1000;
        this.fetchImpl = options.fetch_impl ?? globalThis.fetch;

        if (!this.fetchImpl) {
            throw new Error("fetch is not available; pass fetch_impl or use Node 20+");
        }
    }

    async infer(
        request: ObjectiveMlInferenceRequest,
    ): Promise<ObjectiveMlInferenceResponse> {
        const validatedRequest = validateObjectiveMlInferenceRequest(request);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await this.fetchImpl(this.endpoint, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(validatedRequest),
                signal: controller.signal,
            });

            const text = await response.text();

            if (!response.ok) {
                throw new Error(
                    `ML inference request failed with HTTP ${response.status}: ${text}`,
                );
            }

            const payload = JSON.parse(text) as unknown;

            return parseMlServiceEnvelope(payload).inference;
        } finally {
            clearTimeout(timeout);
        }
    }
}
