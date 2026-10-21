import { env } from '../config/env.js';
import { resolveEvolutionConfig } from './evolutionConfig.js';
import {
  disableEvolutionMockMode,
  enableEvolutionMockMode,
  isEvolutionMockMode,
  logEvolutionMockBootMessage,
} from './evolutionMockMode.js';

const PROBE_MS = 8_000;

/**
 * Probe Evolution on startup; mock only when forced or credentials missing.
 */
export async function initEvolutionIntegration() {
  if (env.evolutionMockForce) {
    enableEvolutionMockMode('EVOLUTION_MOCK=true');
    logEvolutionMockBootMessage();
    return;
  }

  let config;
  try {
    config = await resolveEvolutionConfig();
  } catch {
    config = { configured: false, baseUrl: env.evolutionBaseUrl, apiKey: env.evolutionApiKey };
  }

  if (!config.configured) {
    enableEvolutionMockMode('Evolution URL/API key missing at boot');
    logEvolutionMockBootMessage();
    return;
  }

  disableEvolutionMockMode();

  try {
    const response = await fetch(`${config.baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: { apikey: config.apiKey },
      signal: AbortSignal.timeout(PROBE_MS),
    });
    if (!response.ok) {
      console.warn(`[Evolution API] Boot probe HTTP ${response.status} — will still call live API for QR.`);
      if (env.evolutionMockOnProbeFailure) {
        enableEvolutionMockMode(`Evolution probe HTTP ${response.status}`);
      }
    } else {
      console.log(`[Evolution API] Connected to ${config.baseUrl} (live mode).`);
    }
  } catch (err) {
    console.warn(
      `[Evolution API] Boot probe failed (${err?.message ?? 'network'}) — will still try live API when linking WhatsApp.`
    );
    if (env.evolutionMockOnProbeFailure) {
      enableEvolutionMockMode('Evolution unreachable at boot (network/timeout)');
    }
  }

  logEvolutionMockBootMessage();
}

export { isEvolutionMockMode };
