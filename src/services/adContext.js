import dns from 'node:dns/promises';
import net from 'node:net';
import { getOpenAIClient } from './openaiClient.js';
import { getAiSettings } from './aiSettings.js';
import { prisma } from '../lib/prisma.js';
import { parseJsonStringArray } from './knowledgeBase.js';
import { toVisionImage } from './productVision.js';

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 600 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Facebook / Instagram only serve link previews (og:*) to their own crawler.
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

/* ------------------------------------------------------------------ safe fetching */

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

/** The URL comes from a customer: refuse anything that resolves to a private / local address. */
async function assertPublicUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('unsupported protocol');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error('blocked address');
  }
  return url;
}

async function safeGet(rawUrl, { accept, maxBytes }) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': CRAWLER_UA, Accept: accept, 'Accept-Language': 'ar,fr;q=0.8,en;q=0.6' },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = new URL(response.headers.get('location'), url).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const chunks = [];
    let total = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(value);
      if (total >= maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '',
      finalUrl: url.toString(),
    };
  }
  throw new Error('too many redirects');
}

/* ------------------------------------------------------------------ link preview parsing */

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function metaContent(html, names) {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*?content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${name}["']`, 'i');
    const m = re1.exec(html) ?? re2.exec(html);
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
  }
  return '';
}

/** @returns {Promise<{ title: string, description: string, imageUrl: string }>} */
export async function fetchLinkPreview(url) {
  const { buffer, contentType, finalUrl } = await safeGet(url, {
    accept: 'text/html,application/xhtml+xml',
    maxBytes: MAX_HTML_BYTES,
  });
  if (contentType.startsWith('image/')) {
    return { title: '', description: '', imageUrl: finalUrl };
  }
  const html = buffer.toString('utf8');
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ||
    decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '');
  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  const image = metaContent(html, ['og:image', 'og:image:url', 'twitter:image']);
  let imageUrl = '';
  if (image) {
    try {
      imageUrl = new URL(image, finalUrl).toString();
    } catch {
      imageUrl = '';
    }
  }
  return { title, description, imageUrl };
}

async function downloadImageAsDataUrl(imageUrl) {
  const { buffer, contentType } = await safeGet(imageUrl, { accept: 'image/*', maxBytes: MAX_IMAGE_BYTES });
  if (!buffer.length || !contentType.startsWith('image/')) {
    throw new Error('not an image');
  }
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/* ------------------------------------------------------------------ AI analysis */

const MAX_CATALOG_IMAGES = 12;

async function loadCatalogProducts() {
  const rows = await prisma.knowledgeItem.findMany({ where: { type: 'PRODUCT' }, orderBy: { updatedAt: 'desc' } });
  return rows.map((r) => {
    const images = parseJsonStringArray(r.imageUrls);
    return {
      title: r.title,
      description: (r.description ?? '').slice(0, 200),
      colors: parseJsonStringArray(r.colors),
      imageUrl: images[0] ?? r.imageUrl ?? null,
    };
  });
}

/**
 * Ask OpenAI (vision) what product the ad is about and which catalog product it is.
 * The ad picture is shown next to the catalog pictures so the model can compare them visually.
 * @returns {Promise<{ productName: string, description: string, colors: string[], matchedTitle: string | null }>}
 */
async function analyzeAdWithAi({ title, description, url, imageDataUrl }, catalog) {
  const settings = await getAiSettings();
  const client = await getOpenAIClient();

  const textParts = [
    url ? `رابط الإعلان: ${url}` : null,
    title ? `عنوان الإعلان: ${title}` : null,
    description ? `نص/وصف الإعلان: ${description}` : null,
  ].filter(Boolean);

  const userContent = [{ type: 'text', text: `=== الإعلان ===\n${textParts.join('\n') || '(لا يوجد نص — اعتمد على الصورة)'}` }];
  if (imageDataUrl) {
    userContent.push({ type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } });
  }

  userContent.push({ type: 'text', text: '\n=== منتجات الكتالوج ===' });
  let withImages = 0;
  for (let i = 0; i < catalog.length; i += 1) {
    const p = catalog[i];
    userContent.push({
      type: 'text',
      text: `[${i + 1}] ${p.title}${p.colors.length ? ` (ألوان: ${p.colors.join('، ')})` : ''} — ${p.description || '—'}`,
    });
    if (p.imageUrl && imageDataUrl && withImages < MAX_CATALOG_IMAGES) {
      const vision = await toVisionImage(p.imageUrl).catch(() => null);
      if (vision) {
        userContent.push(vision);
        withImages += 1;
      }
    }
  }
  if (!catalog.length) {
    userContent.push({ type: 'text', text: '(الكتالوج فارغ)' });
  }

  const completion = await client.chat.completions.create({
    model: settings.textModel?.startsWith('gpt-4') ? settings.textModel : 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `زبون وصل لمتجر واتساب مغربي من إعلان. حدّد المنتج المعروض في الإعلان (من صورته ونصه) ثم قارنه بمنتجات الكتالوج (نصاً وصورة) لتعرف هل هو واحد منها. أرجع JSON فقط:
{
  "productName": "اسم المنتج كما يظهر في الإعلان بالعربية",
  "description": "وصف قصير لما يظهر (النوع، اللون، التفاصيل)",
  "colors": ["ألوان المنتج الظاهرة"],
  "matchedIndex": رقم منتج الكتالوج المطابق (الرقم بين [ ]) أو null,
  "confidence": رقم بين 0 و 1 يعبّر عن ثقتك في المطابقة
}
اختر matchedIndex إذا كان المنتج في الإعلان هو نفسه منتج الكتالوج (نفس النوع والقصة والتفاصيل الظاهرة، حتى لو اختلفت الزاوية أو الإضاءة أو كان اللون أحد ألوانه). إذا كانت عدة منتجات متشابهة قارن التفاصيل (الياقة، الأزرار، الجيوب، الخامة، اللون) واختر الأقرب. إذا لم يوجد منتج مطابق فعلاً اجعله null ولا تُخمّن. إذا لم تكن هناك صورة فلا تطابق إلا إذا ذكر نص الإعلان اسم المنتج أو وصفه بوضوح؛ نص عام أو لا علاقة له بالمنتجات (مثل عنوان صفحة) يعني null.`,
      },
      { role: 'user', content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('empty ad analysis');
  }
  const data = JSON.parse(raw);

  const index = Number(data.matchedIndex);
  const confident = Number(data.confidence) >= 0.7;
  const matched =
    confident && Number.isInteger(index) && index >= 1 && index <= catalog.length ? catalog[index - 1] : null;

  return {
    productName: String(data.productName ?? '').trim(),
    description: String(data.description ?? '').trim(),
    colors: parseJsonStringArray(data.colors),
    matchedTitle: matched?.title ?? null,
  };
}
/**
 * A photo the customer sent (product they want). Same careful catalog comparison as an ad.
 * Never throws.
 * @param {string} dataUrl
 * @returns {Promise<null | { note: string, prompt: string }>}
 */
export async function describeCustomerProductImage(dataUrl) {
  if (!dataUrl) return null;
  try {
    const catalog = await loadCatalogProducts();
    const analysis = await analyzeAdWithAi(
      { title: 'صورة أرسلها الزبون', description: '', url: null, imageDataUrl: dataUrl },
      catalog
    );
    const lines = ['--- الزبون أرسل صورة منتج ---'];
    if (analysis.productName) lines.push(`ما يظهر في الصورة: ${analysis.productName}`);
    if (analysis.description) lines.push(`التفاصيل: ${analysis.description}`);
    if (analysis.colors.length) lines.push(`ألوان ظاهرة: ${analysis.colors.join('، ')}`);
    if (analysis.matchedTitle) {
      lines.push(`المنتج المطابق في الكتالوج: «${analysis.matchedTitle}»`);
      lines.push(
        'التعليمات: جاوب على هاد المنتج مباشرة من الكتالوج (الثمن، الألوان، المقاسات) وبعث صورته. ما تسولش «أي منتج تقصد؟». الصورة وحدها ماشي طلب مؤكد: score بين 5 و 7 و handoff = false حتى يقول بوضوح أنه باغي ياخذ أو يعطي المدينة.'
      );
    } else {
      lines.push('المنتج المطابق في الكتالوج: لا يوجد تطابق واضح.');
      lines.push(
        'التعليمات: وصف اللي بان فالصورة بالدارجة، وما تخترعش الثمن. إلا كان شي منتج قريب فالكatalog اقترحو وقول أنك ما متأكدش. سؤال واحد فقط إلا بقى غامض.'
      );
    }
    const label = analysis.matchedTitle ?? analysis.productName ?? 'صورة منتج';
    return {
      note: `📷 صورة: ${label}${analysis.matchedTitle ? ' ✅ فالكatalog' : ''}`,
      prompt: lines.join('\n'),
    };
  } catch (err) {
    console.error('[image] customer photo analysis failed:', err.message);
    return null;
  }
}

/* ------------------------------------------------------------------ public API */

/**
 * Turns the link / preview of an incoming WhatsApp message (typically a Click-to-WhatsApp ad)
 * into context for the sales bot. Never throws: a failure just means "no ad context".
 *
 * @param {null | { url: string | null, title: string, description: string, thumbnailBase64: string | null, thumbnailUrl: string | null }} ad
 * @returns {Promise<null | { url: string | null, title: string, productName: string, matchedTitle: string | null, note: string, prompt: string }>}
 */
export async function resolveAdContext(ad) {
  if (!ad) return null;

  try {
    let { title, description } = ad;
    let imageDataUrl = ad.thumbnailBase64 ? `data:image/jpeg;base64,${ad.thumbnailBase64}` : null;
    let linkReadable = false;

    if (ad.url) {
      try {
        const preview = await fetchLinkPreview(ad.url);
        title = title || preview.title;
        description = description || preview.description;
        linkReadable = Boolean(preview.title || preview.description || preview.imageUrl);
        const imageUrl = preview.imageUrl || ad.thumbnailUrl;
        if (imageUrl) {
          imageDataUrl = await downloadImageAsDataUrl(imageUrl).catch(() => imageDataUrl);
        }
      } catch (err) {
        console.warn('[ad] link preview failed:', ad.url, err.message);
      }
    }
    if (!imageDataUrl && ad.thumbnailUrl) {
      imageDataUrl = await downloadImageAsDataUrl(ad.thumbnailUrl).catch(() => null);
    }

    const hasSomething = Boolean(title || description || imageDataUrl);
    let analysis = { productName: '', description: '', colors: [], matchedTitle: null };
    if (hasSomething) {
      const catalog = await loadCatalogProducts();
      analysis = await analyzeAdWithAi({ title, description, url: ad.url, imageDataUrl }, catalog);
    }

    const lines = ['--- العميل جاء من إعلان / رابط ---'];
    if (ad.url) lines.push(`رابط الإعلان: ${ad.url}`);
    if (title) lines.push(`عنوان الإعلان: ${title}`);
    if (description) lines.push(`نص الإعلان: ${description}`);
    if (analysis.productName) lines.push(`المنتج المتعرَّف عليه من الإعلان: ${analysis.productName}`);
    if (analysis.description) lines.push(`ما يظهر في صورة الإعلان: ${analysis.description}`);
    if (analysis.colors.length) lines.push(`ألوان ظاهرة: ${analysis.colors.join('، ')}`);

    if (analysis.matchedTitle) {
      lines.push(`المنتج المطابق في الكتالوج: «${analysis.matchedTitle}»`);
      lines.push(
        'التعليمات: العميل يسأل عن هذا المنتج. جاوبه مباشرة عليه بالمعلومات الموجودة في الكتالوج (الثمن، الألوان، المقاسات، الوصف) وأرسل صورة المنتج من الكتالوج، ثم اسأله سؤالاً واحداً لمتابعة الطلب (اللون/المقاس/المدينة). لا تسأله "أي منتج تقصد؟". مجرد السؤال عن المنتج من الإعلان ليس نية شراء مؤكدة: اجعل score بين 5 و 7 ولا تحوّله للموظفة (handoff = false) حتى يعطي بياناته أو يقول بوضوح أنه يريد الطلب.'
      );
    } else if (hasSomething) {
      lines.push('المنتج المطابق في الكتالوج: لا يوجد تطابق واضح.');
      lines.push(
        'التعليمات: لا تخترع منتجاً أو ثمناً. قل للعميل بلطف أنك ستتأكد من توفر هذا المنتج، واقترح أقرب منتجات الكتالوج إن كانت مشابهة، واطلب منه صورة المنتج أو اسمه لتأكيد الطلب.'
      );
    } else {
      lines.push('تعذّرت قراءة محتوى الرابط.');
      lines.push(
        'التعليمات: لا تخمّن المنتج. رحّب بالعميل واطلب منه أن يخبرك باسم المنتج الذي رآه في الإعلان أو يرسل صورته.'
      );
    }

    const label = analysis.matchedTitle ?? analysis.productName ?? title;
    const note = hasSomething
      ? `📢 إعلان: ${label || title || 'منتج غير محدد'}${analysis.matchedTitle ? ' ✅ موجود في الكتالوج' : ' ⚠️ غير مطابق للكتالوج'}`
      : `📢 رابط إعلان${linkReadable ? '' : ' (تعذّرت قراءته)'}`;

    return {
      url: ad.url,
      title: title ?? '',
      productName: analysis.productName,
      matchedTitle: analysis.matchedTitle,
      note,
      prompt: lines.join('\n'),
    };
  } catch (err) {
    console.error('[ad] resolve failed:', err.message);
    return null;
  }
}
