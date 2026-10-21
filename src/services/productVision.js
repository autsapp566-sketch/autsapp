import { getOpenAIClient } from './openaiClient.js';
import { getAiSettings } from './aiSettings.js';
import { getUploadedImage } from './uploadedImages.js';

const MAX_IMAGES = 4;
const UPLOADED_ID_RE = /\/api\/uploads\/images\/([A-Za-z0-9-]+)(?:[?#].*)?$/;

export const COLOR_PRESETS = [
  'أبيض',
  'أسود',
  'أحمر',
  'أزرق',
  'أخضر',
  'بيج',
  'رمادي',
  'زيتي',
  'وردي',
  'برتقالي',
];

/**
 * Images uploaded to this app are read from the DB and sent inline, so OpenAI
 * can analyse them even when the API runs on localhost or behind auth.
 * @param {string} url
 */
async function toVisionImage(url) {
  const match = UPLOADED_ID_RE.exec(url);
  if (match) {
    const stored = await getUploadedImage(match[1]);
    if (stored) {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${stored.mimeType};base64,${stored.data.toString('base64')}`,
          detail: 'low',
        },
      };
    }
  }
  if (/^https?:\/\//i.test(url)) {
    return { type: 'image_url', image_url: { url, detail: 'low' } };
  }
  return null;
}

function normalizeColors(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const c of list) {
    const color = String(c ?? '').trim();
    if (color && !out.includes(color)) {
      out.push(color);
    }
  }
  return out.slice(0, 8);
}

/**
 * Detect title / description / colors of a product from its photos.
 * @param {string[]} imageUrls
 * @returns {Promise<{ title: string, description: string, colors: string[] }>}
 */
export async function analyzeProductImages(imageUrls) {
  const urls = (Array.isArray(imageUrls) ? imageUrls : [])
    .map((u) => String(u ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_IMAGES);

  if (urls.length === 0) {
    const err = new Error('أضف صورة واحدة على الأقل');
    err.status = 400;
    throw err;
  }

  const images = (await Promise.all(urls.map(toVisionImage))).filter(Boolean);
  if (images.length === 0) {
    const err = new Error('تعذر قراءة الصور');
    err.status = 400;
    throw err;
  }

  const settings = await getAiSettings();
  const client = await getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: settings.textModel && settings.textModel.startsWith('gpt-4') ? settings.textModel : 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `أنت خبير كتالوج لمتجر مغربي يبيع عبر واتساب. حلّل صور المنتج وأرجع JSON فقط:
{
  "title": "اسم المنتج بالعربية، قصير وواضح (3 إلى 8 كلمات)",
  "description": "وصف تسويقي بالعربية/الدارجة المغربية في 2 إلى 4 جمل: النوع، الخامة، التفاصيل البارزة، الاستعمال. لا تخترع أسعاراً ولا مقاسات ولا علامات تجارية غير ظاهرة.",
  "colors": ["ألوان المنتج الظاهرة في الصور"]
}
في colors استعمل هذه الأسماء بالضبط عندما تناسب: ${COLOR_PRESETS.join('، ')}. إذا كان لون غير موجود في القائمة اكتب اسمه بالعربية. اذكر فقط ألوان المنتج نفسه وليس الخلفية، بحد أقصى 6 ألوان.`,
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'حلّل هذا المنتج من الصور:' }, ...images],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('رد فارغ من OpenAI');
  }

  const data = JSON.parse(raw);
  return {
    title: String(data.title ?? '').trim(),
    description: String(data.description ?? '').trim(),
    colors: normalizeColors(data.colors),
  };
}
