import { QUALIFICATION_SYSTEM_PROMPT } from './qualificationPrompt.js';
import { prisma } from '../lib/prisma.js';

export const MOROCCAN_DARIJA_PERSONA_TEMPLATE = `أنت مساعد مبيعات على واتساب لمتجر مغربي. تهضر غير بالدارجة المغربية بالحروف العربية، بشكل محترم، قصير وودود.

مهمتك: تجاوب على أسئلة الزبون من الكتالوج، تعطي المعلومة قبل ما تسول، وتعرف شكون الجاد فالشراء باش تحوّلو للزميلة المكلفة بتأكيد الطلبات. نتا ما كتأكدش الطلبات وما كتاخدش الأداء.

1) فهم الزبون كيفما كتب: دارجة بالحروف العربية، دارجة بالحروف اللاتينية (بحال 3arfa و bghit و chhal)، فرنسية، أو إنجليزية. الرد ديالك دائماً بالدارجة بالحروف العربية، ماشي الفصحى وماشي الفرنسية وماشي الإنجليزية.
2) جاوب أولاً على اللي سول أو قال، من الكتالوج والأسئلة الشائعة فقط. ما تخترعش أثمنة ولا مواصفات. إلا ما لقيتش الجواب قولها بصراحة واقترح أقرب منتج.
3) إذا طلب الزبون صورة منتج، أو كان المنتج واضح من إعلان أو صورة، استعمل لكل صورة: [IMAGE: رابط_الصورة]
4) سؤال واحد قصير كحد أقصى فالرد، وغير إلا نقصات معلومة ضرورية (اللون أو المقاس أو المدينة). إلا عطاها الزبون، أكّدها وكمل، ما تعاودش تسولو.
5) إذا كان الزبون غير كيتفرج، جاوبو بإيجاز وما تلحّش عليه.
6) حوّل الزبون للزميلة المكلفة بالتأكيد فهاد الحالات:
   - الزبون جاد فالشراء: حدّد المنتج وعطى المعلومات ديالو، أو قال باغي نطلب / نشري / نأكد.
   - قال "بغيت نهضر مع الوكيل / موظف حقيقي / شي بنادم / البنت".
   - طلب مكالمة فيديو أو فيديو مباشر للمنتج أو "رحلي بالفيديو".
7) فرسالة التحويل قول بإيجاز أنك غادي تحوّلو دابا للزميلة المكلفة بتأكيد الطلبات وأنها غادي تتواصل معاه فهاد المحادثة. ما تسولوش أسئلة أخرى، وما تعطيش وقت محدد، وما تجاوبش من بعد.
8) إذا وصلت رسالة صوتية أو صورة منتج، فهمها وردّ باختصار على اللي باين فيها.
9) كون مختصراً: جوج أو ثلاثة أسطر. ما تضيّعش وقت الزبون بجمل عامة بحال "أنا هنا للمساعدة".`;

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
    appPublicUrl: process.env.APP_PUBLIC_URL?.trim() || '',
    greenApiInstanceId: process.env.GREEN_API_INSTANCE_ID?.trim() || '',
    greenApiToken: process.env.GREEN_API_TOKEN?.trim() || '',
    greenApiUrl: process.env.GREEN_API_URL?.trim() || '',
  };

  const patch = {};
  if (!row.openAiApiKey?.trim() && envSnapshot.openAiApiKey) {
    patch.openAiApiKey = envSnapshot.openAiApiKey;
  }
  if (!row.appPublicUrl?.trim() && envSnapshot.appPublicUrl) {
    patch.appPublicUrl = envSnapshot.appPublicUrl;
  }
  if (!row.greenApiInstanceId?.trim() && envSnapshot.greenApiInstanceId) {
    patch.greenApiInstanceId = envSnapshot.greenApiInstanceId;
  }
  if (!row.greenApiToken?.trim() && envSnapshot.greenApiToken) {
    patch.greenApiToken = envSnapshot.greenApiToken;
  }
  if (!row.greenApiUrl?.trim() && envSnapshot.greenApiUrl) {
    patch.greenApiUrl = envSnapshot.greenApiUrl;
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
 * @param {Partial<{ openAiApiKey: string, appPublicUrl: string, greenApiInstanceId: string, greenApiToken: string, greenApiUrl: string, textModel: string, sttEnabled: boolean, ttsEnabled: boolean, ttsVoice: string, employeePrompt: string, qualificationPrompt: string, systemPrompt: string }>} input
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
  if (typeof input.appPublicUrl === 'string') {
    data.appPublicUrl = input.appPublicUrl.trim();
  }
  if (typeof input.greenApiInstanceId === 'string') {
    data.greenApiInstanceId = input.greenApiInstanceId.trim();
  }
  if (typeof input.greenApiToken === 'string') {
    const token = input.greenApiToken.trim();
    if (token && !token.includes('••••')) {
      data.greenApiToken = token;
    }
  }
  if (typeof input.greenApiUrl === 'string') {
    data.greenApiUrl = input.greenApiUrl.trim() || null;
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

  if (
    data.greenApiInstanceId !== undefined ||
    data.greenApiToken !== undefined ||
    data.greenApiUrl !== undefined
  ) {
    const { invalidateGreenApiConfigCache, refreshGreenApiConfigCache } = await import(
      './greenApiConfig.js'
    );
    invalidateGreenApiConfigCache();
    await refreshGreenApiConfigCache();
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
  const greenToken = row.greenApiToken?.trim() || '';

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
    greenApiInstanceId: row.greenApiInstanceId ?? '',
    greenApiUrl: row.greenApiUrl ?? '',
    greenApiTokenMasked: maskSecret(greenToken),
    greenApiConfigured: Boolean(row.greenApiInstanceId?.trim() && greenToken),
    appPublicUrl: row.appPublicUrl ?? '',
    updatedAt: row.updatedAt,
  };
}
