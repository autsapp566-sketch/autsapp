import { getAiSettings } from './aiSettings.js';
import { getOpenAIClient } from './openaiClient.js';
import { listKnowledgeItems } from './knowledgeBase.js';

/** Best dialect accuracy first; whisper-1 is the safety net. */
const STT_MODELS = ['gpt-4o-transcribe', 'whisper-1'];

const DARIJA_GLOSSARY =
  'بغيت، بغينا، شحال، شحال الثمن، واش كاين، فين، كيفاش، دابا، ديال، حيت، بزاف، شوية، لاباس، ' +
  'التوصيل، الدفع عند الاستلام، المقاس، اللون، الكولور، جاكيط، قميجة، تريكو، سروال، جينز، صباط، ' +
  'كوستيم، معطف، كبوط، تشورت، الموديل، الصورة، الفيديو، الوكيل، مكناس، فاس، الدار البيضاء، مراكش، ' +
  'طنجة، الرباط، أكادير، وجدة، تطوان، القنيطرة، سلا، تمارة، العنوان، رقم الهاتف، الكوموند، التأكيد';

async function catalogHint() {
  try {
    const items = await listKnowledgeItems('product');
    return items
      .slice(0, 25)
      .map((i) => i.title)
      .filter(Boolean)
      .join('، ');
  } catch {
    return '';
  }
}

async function buildTranscriptionPrompt() {
  const catalog = await catalogHint();
  return (
    'تسجيل صوتي من واتساب لزبون مغربي يتكلم بالدارجة المغربية (وأحياناً بكلمات فرنسية) ' +
    'مع متجر ملابس. فرّغ الكلام كما قيل بالضبط دون ترجمة. ' +
    `كلمات متوقعة: ${DARIJA_GLOSSARY}.` +
    (catalog ? ` منتجات المتجر: ${catalog}.` : '')
  );
}

/**
 * Second pass: fix obvious mishearings using the store catalog, without
 * inventing anything. Falls back to the raw transcript on any problem.
 */
async function refineDarijaTranscript(client, settings, raw) {
  if (raw.length < 6) return raw;
  try {
    const catalog = await catalogHint();
    const completion = await client.chat.completions.create({
      model: settings.textModel && settings.textModel.startsWith('gpt-4') ? settings.textModel : 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'أنت مصحح تفريغ صوتي لرسائل زبائن مغاربة (دارجة مغربية) على واتساب لمتجر ملابس. ' +
            'النص القادم من نظام التعرف على الكلام وقد يحتوي على كلمات مسموعة بشكل خاطئ أو مشوّهة. ' +
            'مهمتك: أعد كتابة النص بدارجة مغربية سليمة ومنطقية في سياق الشراء، مصححاً فقط الكلمات التي يظهر أنها أخطاء سمع ' +
            '(مثل: "قميرة" ← "قميجة"، "طف اي لون" ← "تفاي لون"، حسب السياق). ' +
            'استعن بأسماء منتجات المتجر والمدن المغربية وكلمات التجارة المعتادة. ' +
            'لا تغيّر الكلمات الدارجة الصحيحة (مثل: لي، فين، دابا، ديال، غادي) ولا تستبدلها بالفصحى. ' +
            'ممنوع: إضافة معلومات جديدة، تغيير المعنى، الترجمة إلى الفصحى أو لغة أخرى، أو الإجابة على الزبون. ' +
            'إذا كان المقطع غير مفهوم فاتركه كما هو. حافظ على الأرقام كما هي. أرجع النص المصحح فقط بلا شرح.' +
            (catalog ? `\nمنتجات المتجر: ${catalog}` : ''),
        },
        { role: 'user', content: raw },
      ],
    });
    const fixed = completion.choices[0]?.message?.content?.trim();
    if (!fixed || fixed.length > raw.length * 2 + 20 || fixed.length < raw.length * 0.4) {
      return raw;
    }
    return fixed;
  } catch (err) {
    console.error('[voice] refine failed:', err.message);
    return raw;
  }
}

/**
 * @param {Buffer} audioBuffer
 * @param {string} [mimeType]
 */
export async function transcribeWhatsAppAudio(audioBuffer, mimeType = 'audio/ogg') {
  const settings = await getAiSettings();
  if (!settings.sttEnabled) {
    throw new Error('Speech-to-text is disabled in AI settings');
  }

  const client = await getOpenAIClient();
  const ext = mimeType.includes('mpeg')
    ? 'mp3'
    : mimeType.includes('wav')
      ? 'wav'
      : mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')
          ? 'm4a'
          : 'ogg';
  const prompt = await buildTranscriptionPrompt();

  let raw = '';
  let lastError = null;
  for (const model of STT_MODELS) {
    try {
      const file = new File([audioBuffer], `voice.${ext}`, { type: mimeType });
      const result = await client.audio.transcriptions.create({
        file,
        model,
        language: 'ar',
        prompt,
        temperature: 0,
      });
      raw = result.text?.trim() ?? '';
      if (raw) break;
    } catch (err) {
      lastError = err;
      console.error(`[voice] ${model} failed:`, err.message);
    }
  }
  if (!raw) {
    if (lastError) throw lastError;
    return '';
  }

  const refined = await refineDarijaTranscript(client, settings, raw);
  if (refined !== raw) {
    console.log(`[voice] raw: ${raw}\n[voice] refined: ${refined}`);
  }
  return refined;
}

/**
 * @param {string} text
 */
export async function synthesizeWhatsAppSpeech(text) {
  const settings = await getAiSettings();
  if (!settings.ttsEnabled) {
    return null;
  }

  const client = await getOpenAIClient();
  const speech = await client.audio.speech.create({
    model: 'tts-1',
    voice: settings.ttsVoice,
    input: text.slice(0, 4096),
  });

  const arrayBuffer = await speech.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
