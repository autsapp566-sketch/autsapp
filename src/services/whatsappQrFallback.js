export const SIMULATION_QR_MESSAGE = 'تم توليد QR تجريبي (وضع المحاكاة)';

/**
 * Placeholder QR (SVG) when Evolution is offline or misconfigured.
 * @param {string} instanceName
 */
export function buildMockQrPayload(instanceName) {
  const safeName = String(instanceName ?? 'instance')
    .replace(/[<>&"']/g, '')
    .slice(0, 32);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="#ffffff"/>
  <rect x="20" y="20" width="280" height="280" rx="12" fill="#0f172a"/>
  <rect x="44" y="44" width="72" height="72" fill="#ffffff"/>
  <rect x="204" y="44" width="72" height="72" fill="#ffffff"/>
  <rect x="44" y="204" width="72" height="72" fill="#ffffff"/>
  <rect x="136" y="136" width="48" height="48" fill="#10b981"/>
  <text x="160" y="168" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="12" font-weight="bold">DEMO</text>
  <text x="160" y="186" text-anchor="middle" fill="#94a3b8" font-family="Arial,sans-serif" font-size="9">Simulation</text>
  <text x="160" y="300" text-anchor="middle" fill="#64748b" font-family="Arial,sans-serif" font-size="10">${safeName}</text>
</svg>`;

  return {
    base64: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    pairingCode: 'SIM-MODE',
    simulationMode: true,
    message: SIMULATION_QR_MESSAGE,
  };
}

/**
 * @param {{ base64?: string | null, pairingCode?: string | null }} qr
 * @param {string} instanceName
 */
export function finalizeQrResponse(qr, instanceName, { allowSimulationFallback = true } = {}) {
  if (qr?.base64) {
    return {
      qr: { base64: qr.base64, pairingCode: qr.pairingCode ?? null },
      simulationMode: false,
      message: null,
    };
  }

  if (!allowSimulationFallback) {
    return {
      qr: { base64: null, pairingCode: null },
      simulationMode: false,
      message: 'تعذر جلب QR من Evolution — تحقق من الرابط، المفتاح، والجدار الناري.',
    };
  }

  const mock = buildMockQrPayload(instanceName);
  return {
    qr: { base64: mock.base64, pairingCode: mock.pairingCode },
    simulationMode: true,
    message: mock.message,
  };
}
