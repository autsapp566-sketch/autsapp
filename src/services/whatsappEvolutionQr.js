import {
  createEvolutionInstance,
  extractQrFromEvolutionResponse,
  fetchConnectQr,
  isEvolutionMockMode,
} from './evolutionApi.js';
import { resolveEvolutionConfig } from './evolutionConfig.js';
import { finalizeQrResponse } from './whatsappQrFallback.js';

function isDuplicateEvolutionError(message) {
  return /exist|already|duplicate/i.test(message ?? '');
}

/**
 * Try Evolution create + connect; never throws — returns simulation QR on failure.
 * @param {string} instanceName
 * @param {string | null} webhookUrl
 * @param {{ skipCreate?: boolean }} [opts]
 */
export async function resolveInstanceQr(instanceName, webhookUrl, opts = {}) {
  const config = await resolveEvolutionConfig();
  const allowSimulationFallback = isEvolutionMockMode() || !config.configured;

  let qr = { base64: null, pairingCode: null };
  let lastError = null;

  if (!opts.skipCreate) {
    try {
      const created = await createEvolutionInstance({ instanceName, webhookUrl });
      qr = extractQrFromEvolutionResponse(created);
    } catch (err) {
      lastError = err;
      if (!isDuplicateEvolutionError(err.message)) {
        /* try connect next */
      }
    }
  }

  if (!qr.base64) {
    try {
      qr = await fetchConnectQr(instanceName);
    } catch (err) {
      lastError = err;
    }
  }

  const result = finalizeQrResponse(qr, instanceName, { allowSimulationFallback });
  if (!result.qr?.base64 && lastError && !allowSimulationFallback) {
    result.message = lastError.message ?? result.message;
  }
  return result;
}
