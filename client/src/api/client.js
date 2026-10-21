const TOKEN_KEY = 'auth_token';

/** Production: set VITE_API_URL to the API deployment (e.g. https://test-wats.vercel.app). Dev uses Vite proxy. */
const API_BASE = String(import.meta.env.VITE_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    const error = new Error(
      API_BASE
        ? 'تعذر الاتصال بالخادم. تحقق من VITE_API_URL و CORS على مشروع API.'
        : 'تعذر الاتصال بالخادم. شغّل API: npm run dev (المنفذ 3000)'
    );
    error.status = 0;
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fallback =
      response.status === 404 && !API_BASE
        ? 'المسار غير موجود — في الإنتاج عيّن VITE_API_URL على URL مشروع API'
        : response.status === 404 && API_BASE
          ? 'المسار غير موجود على API — تحقق من VITE_API_URL'
          : response.status === 502 || response.status === 503 || response.status === 504
            ? API_BASE
              ? 'الخادم غير متاح — تحقق من deploy مشروع API'
              : 'الخادم غير متاح — شغّل API في طرفية: npm run dev (منفذ 3000)'
            : 'Request failed';
    const message = data.error ?? fallback;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function login(email, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe() {
  return apiFetch('/api/auth/me');
}

export function fetchAnalyticsOverview() {
  return apiFetch('/api/analytics/overview');
}

export function fetchLeads(statuses = ['QUALIFIED', 'HANDED_OFF']) {
  const status = statuses.join(',');
  return apiFetch(`/api/leads?status=${encodeURIComponent(status)}`);
}

export function fetchLead(id) {
  return apiFetch(`/api/leads/${id}`);
}

export function setLeadTakeover(id, enabled) {
  return apiFetch(`/api/leads/${id}/takeover`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function toggleLeadAi(id, aiPaused) {
  return apiFetch(`/api/leads/${id}/toggle-ai`, {
    method: 'POST',
    body: JSON.stringify({ aiPaused }),
  });
}

export function sendLeadMessage(id, content) {
  return apiFetch(`/api/leads/${id}/send-message`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function fetchWhatsAppInstances() {
  return apiFetch('/api/whatsapp-instances');
}

export function fetchWhatsAppIntegration() {
  return apiFetch('/api/whatsapp-instances/integration');
}

export function logoutWhatsAppInstance(id) {
  return apiFetch(`/api/whatsapp-instances/${id}/logout`, { method: 'POST' });
}

export function rebootWhatsAppInstance(id) {
  return apiFetch(`/api/whatsapp-instances/${id}/reboot`, { method: 'POST' });
}

export function createWhatsAppInstance(body) {
  return apiFetch('/api/whatsapp-instances', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchWhatsAppConnectQr(id) {
  return apiFetch(`/api/whatsapp-instances/${id}/connect`);
}

export function fetchWhatsAppInstanceStatus(id) {
  return apiFetch(`/api/whatsapp-instances/${id}/status`);
}

export function setDefaultWhatsAppInstance(id) {
  return apiFetch(`/api/whatsapp-instances/${id}/default`, { method: 'PATCH' });
}

export function deleteWhatsAppInstance(id) {
  return apiFetch(`/api/whatsapp-instances/${id}`, { method: 'DELETE' });
}

export function fetchSettings() {
  return apiFetch('/api/settings');
}

export function saveSettings(body) {
  return apiFetch('/api/settings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchGreenWebhookStatus() {
  return apiFetch('/api/settings/green-webhook');
}

export function syncGreenWebhook() {
  return apiFetch('/api/settings/green-webhook/sync', { method: 'POST' });
}

export function fetchAiVoiceSettings() {
  return fetchSettings();
}

export function saveAiVoiceSettings(body) {
  return saveSettings(body);
}

export function fetchMoroccanAiVoiceTemplate() {
  return apiFetch('/api/settings/ai-voice/templates/moroccan');
}

export function fetchQualificationPromptTemplate() {
  return apiFetch('/api/settings/ai-voice/templates/qualification');
}

export function fetchKnowledge(type) {
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch(`/api/knowledge${q}`);
}

export function createKnowledgeItem(body) {
  const payload = { ...body, type: body.type };
  if (payload.priceDh !== '' && payload.priceDh != null) {
    payload.priceDh = Number(payload.priceDh);
  }
  if (Array.isArray(payload.imageUrls)) {
    payload.imageUrls = payload.imageUrls.filter(Boolean);
  }
  if (Array.isArray(payload.colors)) {
    payload.colors = payload.colors.filter(Boolean);
  }
  if (Array.isArray(payload.sizes)) {
    payload.sizes = payload.sizes.filter(Boolean);
  }
  delete payload.imageUrl;
  return apiFetch('/api/knowledge', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateKnowledgeItem(id, body) {
  const payload = { ...body };
  delete payload.id;
  if (payload.priceDh !== '' && payload.priceDh != null) {
    payload.priceDh = Number(payload.priceDh);
  }
  if (Array.isArray(payload.imageUrls)) {
    payload.imageUrls = payload.imageUrls.filter(Boolean);
  }
  if (Array.isArray(payload.colors)) {
    payload.colors = payload.colors.filter(Boolean);
  }
  if (Array.isArray(payload.sizes)) {
    payload.sizes = payload.sizes.filter(Boolean);
  }
  delete payload.imageUrl;
  return apiFetch(`/api/knowledge/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function uploadProductImages(files) {
  const form = new FormData();
  for (const file of files) {
    form.append('images', file);
  }
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  let response;
  try {
    response = await fetch(apiUrl('/api/knowledge/upload-images'), { method: 'POST', headers, body: form });
  } catch {
    throw new Error('تعذر رفع الصور — تأكد أن API يعمل');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? 'فشل رفع الصور');
  }
  return data;
}

export function deleteKnowledgeItem(id) {
  return apiFetch(`/api/knowledge/${id}`, { method: 'DELETE' });
}

export function generateKnowledgeCopilot(brief) {
  return apiFetch('/api/knowledge/ai-copilot', {
    method: 'POST',
    body: JSON.stringify({ brief }),
  });
}

export function sendBotPlaygroundMessage(body) {
  return apiFetch('/api/bot-playground/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchBotPlaygroundStatus() {
  return apiFetch('/api/bot-playground/status');
}
