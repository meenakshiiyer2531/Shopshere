/**
 * aicore.js — low-level SAP AI Core (Generative AI Hub) client.
 *
 * Handles the OAuth2 client-credentials flow (token cached in memory) and a
 * single `complete()` call against the orchestration deployment. Credentials
 * are read from the environment (see config.ai). This module throws on any
 * failure; callers are expected to fall back to the deterministic engine.
 */
const config = require("../../config");

let cachedToken = null; // { value, expiresAt }

async function getToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }
  const { authUrl, clientId, clientSecret } = config.ai;
  if (!authUrl || !clientId || !clientSecret) {
    throw new Error("SAP AI Core credentials are not configured");
  }
  const res = await fetch(authUrl.replace(/\/$/, "") + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`AI Core auth failed (${res.status})`);
  const json = await res.json();
  if (!json.access_token) throw new Error("AI Core auth returned no token");
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

/**
 * Send a system + user prompt through the orchestration deployment and return
 * the assistant's raw text content. Times out via AbortController.
 */
async function complete(system, user) {
  const { baseUrl, orchestrationId, resourceGroup, model, timeoutMs } = config.ai;
  if (!baseUrl || !orchestrationId) {
    throw new Error("SAP AI Core deployment is not configured");
  }
  const token = await getToken();
  const url =
    baseUrl.replace(/\/$/, "") +
    "/v2/inference/deployments/" +
    orchestrationId +
    "/completion";

  const body = {
    orchestration_config: {
      module_configurations: {
        llm_module_config: {
          model_name: model,
          model_params: { max_tokens: 500, temperature: 0 },
        },
        templating_module_config: {
          template: [
            { role: "system", content: "{{?system}}" },
            { role: "user", content: "{{?user}}" },
          ],
        },
      },
    },
    input_params: { system, user },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "AI-Resource-Group": resourceGroup,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI Core inference failed (${res.status})`);
    const json = await res.json();
    const content =
      json?.orchestration_result?.choices?.[0]?.message?.content ??
      json?.module_results?.llm?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI Core returned no content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete, getToken };
