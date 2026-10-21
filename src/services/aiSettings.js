import { QUALIFICATION_SYSTEM_PROMPT } from './qualificationPrompt.js';
import { prisma } from '../lib/prisma.js';

export const MOROCCAN_DARIJA_PERSONA_TEMPLATE = `أنت موظف واتساب ذكي لمتجر مغربي. تكلم بالدارجة المغربية الاحترافية باحترام ووضوح.

1) رحّب بالزبون بشكل مهذّب وودود.
2) جاوب بدقة من الكتالوج والأسئلة الشائعة (Knowledge Base).
3) إذا طلب الزبون صورة منتج، استخدم الصيغة: [IMAGE: رابط_الصورة]
4) جمع بيانات الشراء: الاسم الكامل، المدينة، رقم الهاتف، المنتج المطلوب.
5) إذا وصلت رسالة صوتية، فهمها جيداً (بالدارجة/العربية) وردّ باختصار وفعالية.
6) كون مختصراً ومباشراً وما تضيعش وقت الزبون.`;

export const TEXT_MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — اقتصادي وسريع جداً (موصى به)' },
  { value: 'gpt-4o', label: 'gpt-4o — أداء أعلى' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini — توازن السرعة والجودة' },
];

export const TEXT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'];
export const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export function buildFullSystemPrompt(employeePrompt, qualificationPrompt) {
  const persona = employeePrompt?.trim() || MOROCCAN_DARIJA_PERSONA_TEMPLATE;
  const qualification = qualificationPrompt?.trim() || QUALIFICATION_SYSTEM_PROMPT;
  return `${persona}

---

${qualification}`;
}

function defaultPrompt() {
  return buildFullSystemPrompt(MOROCCAN_DARIJA_PERSONA_TEMPLATE, QUALIFICATION_SYSTEM_PROMPT);
}

export async function getAiSettings() {
  let row = await prisma.aiSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    row = await prisma.aiSettings.create({
      data: {
        id: 'default',
        employeePrompt: MOROCCAN_DARIJA_PERSONA_TEMPLATE,
        systemPrompt: defaultPrompt(),
      },
    });
    row = await bootstrapIntegrationFromEnvOnce(row);
    return row;
  }

  if (!row.employeePrompt?.trim()) {
    const fromLegacy = row.systemPrompt?.includes('---')
      ? row.systemPrompt.split('---')[0].trim()
      : row.systemPrompt;
    row = await prisma.aiSettings.update({
      where: { id: 'default' },
      data: {
        employeePrompt: fromLegacy || MOROCCAN_DARIJA_PERSONA_TEMPLATE,
        systemPrompt: buildFullSystemPrompt(
          fromLegacy || MOROCCAN_DARIJA_PERSONA_TEMPLATE,
          row.qualificationPrompt
        ),
      },
    });
  }

  row = await bootstrapIntegrationFromEnvOnce(row);
  return row;
}

/** استيراد لمرة واحدة من .env القديم إن وُجد، ثم الإعداد من الواجهة فقط */
async function bootstrapIntegrationFromEnvOnce(row) {
  const envSnapshot = {
    openAiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    evolutionBaseUrl: process.env.EVOLUTION_BASE_URL?.trim() || '',
    evolutionApiKey: process.env.EVOLUTION_API_KEY?.trim() || '',
    evolutionInstance: process.env.EVOLUTION_INSTANCE?.trim() || '',
    evolutionWebhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET?.trim() || '',
    appPublicUrl: process.env.APP_PUBLIC_URL?.trim() || '',
  };

  const patch = {};
  if (!row.openAiApiKey?.trim() && envSnapshot.openAiApiKey) {
    patch.openAiApiKey = envSnapshot.openAiApiKey;
  }
  if (!row.evolutionBaseUrl?.trim() && envSnapshot.evolutionBaseUrl) {
    patch.evolutionBaseUrl = envSnapshot.evolutionBaseUrl;
  }
  if (!row.evolutionApiKey?.trim() && envSnapshot.evolutionApiKey) {
    patch.evolutionApiKey = envSnapshot.evolutionApiKey;
  }
  if (!row.evolutionInstance?.trim() && envSnapshot.evolutionInstance) {
    patch.evolutionInstance = envSnapshot.evolutionInstance;
  }
  if (!row.evolutionWebhookSecret?.trim() && envSnapshot.evolutionWebhookSecret) {
    patch.evolutionWebhookSecret = envSnapshot.evolutionWebhookSecret;
  }
  if (!row.appPublicUrl?.trim() && envSnapshot.appPublicUrl) {
    patch.appPublicUrl = envSnapshot.appPublicUrl;
  }

  if (Object.keys(patch).length === 0) {
    return row;
  }

  return prisma.aiSettings.update({
    where: { id: 'default' },
    data: patch,
  });
}

export async function getEffectiveSystemPrompt() {
  const row = await getAiSettings();
  return buildFullSystemPrompt(row.employeePrompt, row.qualificationPrompt);
}

/**
 * @param {Partial<{ openAiApiKey: string, evolutionBaseUrl: string, evolutionApiKey: string, evolutionInstance: string, evolutionWebhookSecret: string, appPublicUrl: string, textModel: string, sttEnabled: boolean, ttsEnabled: boolean, ttsVoice: string, employeePrompt: string, qualificationPrompt: string, systemPrompt: string }>} input
 */
export async function updateAiSettings(input) {
  const current = await getAiSettings();

  const data = {};
  let nextEmployee = current.employeePrompt;
  let nextQualification = current.qualificationPrompt;
  const rawOpenAiKey =
    typeof input.openAiApiKey === 'string'
      ? input.openAiApiKey
      : typeof input.openaiApiKey === 'string'
        ? input.openaiApiKey
        : null;
  if (rawOpenAiKey !== null) {
    const key = rawOpenAiKey.trim();
    if (key && !key.includes('••••') && key.startsWith('sk-')) {
      data.openAiApiKey = key;
    }
  }
  if (typeof input.evolutionBaseUrl === 'string') {
    data.evolutionBaseUrl = input.evolutionBaseUrl.trim();
  }
  if (typeof input.evolutionApiKey === 'string') {
    const key = input.evolutionApiKey.trim();
    if (key && !key.includes('••••')) {
      data.evolutionApiKey = key;
    }
  }
  if (typeof input.evolutionInstance === 'string') {
    data.evolutionInstance = input.evolutionInstance.trim();
  }
  if (typeof input.evolutionWebhookSecret === 'string') {
    data.evolutionWebhookSecret = input.evolutionWebhookSecret.trim();
  }
  if (typeof input.appPublicUrl === 'string') {
    data.appPublicUrl = input.appPublicUrl.trim();
  }
  if (input.textModel && TEXT_MODELS.includes(input.textModel)) {
    data.textModel = input.textModel;
  }
  if (typeof input.sttEnabled === 'boolean') {
    data.sttEnabled = input.sttEnabled;
  }
  if (typeof input.ttsEnabled === 'boolean') {
    data.ttsEnabled = input.ttsEnabled;
  }
  if (input.ttsVoice && TTS_VOICES.includes(input.ttsVoice)) {
    data.ttsVoice = input.ttsVoice;
  }

  if (typeof input.employeePrompt === 'string') {
    nextEmployee = input.employeePrompt.trim();
    data.employeePrompt = nextEmployee;
  } else if (typeof input.systemPrompt === 'string' && input.systemPrompt.trim()) {
    nextEmployee = input.systemPrompt.trim();
    data.employeePrompt = nextEmployee;
  }

  if (typeof input.qualificationPrompt === 'string') {
    nextQualification = input.qualificationPrompt.trim();
    data.qualificationPrompt = nextQualification;
  }

  data.systemPrompt = buildFullSystemPrompt(nextEmployee, nextQualification);

  const updated = await prisma.aiSettings.update({
    where: { id: 'default' },
    data,
  });

  if (data.openAiApiKey) {
    const { invalidateOpenAIClientCache } = await import('./openaiClient.js');
    invalidateOpenAIClientCache();
  }

  return updated;
}

function maskSecret(key, prefix = '') {
  if (!key || key.length < 4) {
    return '';
  }
  return `${prefix}••••••••${key.slice(-4)}`;
}

/** Merchant-facing snapshot (AiSettings row = SystemSettings in API docs). */
export function serializeSystemSettings(row) {
  const serialized = serializeAiSettings(row);
  const merchantPrompt =
    row.employeePrompt?.trim() ||
    (row.systemPrompt?.includes('---') ? row.systemPrompt.split('---')[0].trim() : row.systemPrompt) ||
    '';

  return {
    systemPrompt: merchantPrompt,
    openaiApiKey: serialized.openAiKeyMasked || '',
    openaiApiKeyConfigured: serialized.openAiKeyConfigured,
    textModel: serialized.textModel,
  };
}

export function serializeAiSettings(row) {
  const openAiKey = row.openAiApiKey?.trim() || '';
  const evoKey = row.evolutionApiKey?.trim() || '';

  return {
    textModel: row.textModel,
    sttEnabled: row.sttEnabled,
    ttsEnabled: row.ttsEnabled,
    ttsVoice: row.ttsVoice,
    employeePrompt: row.employeePrompt,
    qualificationPrompt: row.qualificationPrompt?.trim()
      ? row.qualificationPrompt
      : QUALIFICATION_SYSTEM_PROMPT,
    systemPrompt: row.systemPrompt,
    openAiApiKey: openAiKey,
    openAiKeyMasked: maskSecret(openAiKey, 'sk-'),
    openAiKeyConfigured: Boolean(openAiKey),
    evolutionBaseUrl: row.evolutionBaseUrl ?? '',
    evolutionApiKey: evoKey,
    evolutionApiKeyMasked: maskSecret(evoKey),
    evolutionApiKeyConfigured: Boolean(evoKey),
    evolutionInstance: row.evolutionInstance ?? '',
    evolutionWebhookSecret: row.evolutionWebhookSecret ?? '',
    appPublicUrl: row.appPublicUrl ?? '',
    updatedAt: row.updatedAt,
  };
}
