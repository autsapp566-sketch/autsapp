import OpenAI from 'openai';
import { getAiSettings } from './aiSettings.js';
import { prisma } from '../lib/prisma.js';

function notFound() {
  const err = new Error('العنصر غير موجود');
  err.status = 404;
  err.expose = true;
  return err;
}

export function parseJsonStringArray(raw, fallback = []) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return fallback;
}

function productMediaFields(input, existing) {
  let imageUrls =
    input.imageUrls !== undefined
      ? parseJsonStringArray(input.imageUrls)
      : parseJsonStringArray(existing?.imageUrls);

  if (input.imageUrl?.trim()) {
    imageUrls = [...new Set([input.imageUrl.trim(), ...imageUrls])];
  }
  if (imageUrls.length === 0 && existing?.imageUrl?.trim()) {
    imageUrls = [existing.imageUrl.trim()];
  }

  const colors =
    input.colors !== undefined ? parseJsonStringArray(input.colors) : parseJsonStringArray(existing?.colors);
  const sizes =
    input.sizes !== undefined ? parseJsonStringArray(input.sizes) : parseJsonStringArray(existing?.sizes);

  return {
    imageUrls: JSON.stringify(imageUrls),
    colors: JSON.stringify(colors),
    sizes: JSON.stringify(sizes),
    imageUrl: imageUrls[0] ?? null,
  };
}

export function serializeKnowledgeItem(row) {
  const imageUrls = parseJsonStringArray(row.imageUrls);
  const legacy = row.imageUrl?.trim();
  const allImages = imageUrls.length ? imageUrls : legacy ? [legacy] : [];

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    answer: row.answer,
    priceDh: row.priceDh,
    imageUrl: allImages[0] ?? null,
    imageUrls: allImages,
    colors: parseJsonStringArray(row.colors),
    sizes: parseJsonStringArray(row.sizes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listKnowledgeItems(organizationId, filter = 'all') {
  const where = {
    organizationId,
    ...(filter === 'product' ? { type: 'PRODUCT' } : filter === 'faq' ? { type: 'FAQ' } : {}),
  };

  const items = await prisma.knowledgeItem.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return items.map(serializeKnowledgeItem);
}

/**
 * Text block injected into AI system instructions.
 */
export async function buildKnowledgeContextForPrompt(organizationId) {
  const items = await prisma.knowledgeItem.findMany({ where: { organizationId }, orderBy: { updatedAt: 'desc' } });
  if (items.length === 0) {
    return '';
  }

  const products = items.filter((i) => i.type === 'PRODUCT');
  const faqs = items.filter((i) => i.type === 'FAQ');

  const lines = ['--- الكتالوج وقاعدة المعرفة (استخدمها في الردود) ---'];

  if (products.length) {
    lines.push('\n[منتجات / خدمات]');
    for (const p of products) {
      const serialized = serializeKnowledgeItem(p);
      const price = serialized.priceDh != null ? ` — ${serialized.priceDh} DH` : '';
      const colors = serialized.colors.length ? ` — ألوان: ${serialized.colors.join(', ')}` : '';
      const sizes = serialized.sizes.length ? ` — مقاسات: ${serialized.sizes.join(', ')}` : '';
      const imgs = serialized.imageUrls.length
        ? ` — صور: ${serialized.imageUrls.join(' | ')}`
        : '';
      lines.push(`- ${serialized.title}${price}${colors}${sizes}: ${serialized.description || '—'}${imgs}`);
    }
  }

  if (faqs.length) {
    lines.push('\n[أسئلة شائعة]');
    for (const f of faqs) {
      lines.push(`س: ${f.title}\nج: ${f.answer || f.description}`);
    }
  }

  return lines.join('\n');
}

export async function createKnowledgeItem(organizationId, input) {
  const type = input.type === 'FAQ' ? 'FAQ' : 'PRODUCT';
  const title = String(input.title ?? '').trim();
  if (!title) {
    throw new Error('العنوان مطلوب');
  }

  const data = {
    organizationId,
    type,
    title,
    description: String(input.description ?? '').trim(),
    answer: type === 'FAQ' ? String(input.answer ?? input.description ?? '').trim() : '',
    priceDh: null,
    imageUrl: null,
    imageUrls: '[]',
    colors: '[]',
    sizes: '[]',
  };

  if (type === 'PRODUCT') {
    data.priceDh = input.priceDh != null && input.priceDh !== '' ? Number(input.priceDh) : null;
    Object.assign(data, productMediaFields(input, null));
  }

  const row = await prisma.knowledgeItem.create({ data });
  return serializeKnowledgeItem(row);
}

export async function updateKnowledgeItem(organizationId, id, input) {
  const existing = await prisma.knowledgeItem.findFirst({ where: { id, organizationId } });
  if (!existing) {
    throw notFound();
  }

  const title = String(input.title ?? existing.title).trim();
  if (!title) {
    throw new Error('العنوان مطلوب');
  }

  const type = existing.type;
  const data = {
    title,
    description: String(input.description ?? existing.description ?? '').trim(),
  };

  if (type === 'FAQ') {
    data.answer = String(input.answer ?? input.description ?? existing.answer ?? '').trim();
    data.priceDh = null;
    data.imageUrl = null;
    data.imageUrls = '[]';
    data.colors = '[]';
    data.sizes = '[]';
  } else {
    data.answer = '';
    const priceRaw = input.priceDh !== undefined ? input.priceDh : existing.priceDh;
    data.priceDh = priceRaw != null && priceRaw !== '' ? Number(priceRaw) : null;
    Object.assign(data, productMediaFields(input, existing));
  }

  const row = await prisma.knowledgeItem.update({ where: { id }, data });
  return serializeKnowledgeItem(row);
}

export async function deleteKnowledgeItem(organizationId, id) {
  const { count } = await prisma.knowledgeItem.deleteMany({ where: { id, organizationId } });
  if (count === 0) {
    throw notFound();
  }
}

export async function generateKnowledgeWithCopilot(organizationId, brief) {
  const settings = await getAiSettings();
  const apiKey = settings.openAiApiKey?.trim();
  if (!apiKey) {
    throw new Error('مفتاح OpenAI غير مضبوط — أضفه من إعدادات الحساب');
  }

  const client = new OpenAI({ apiKey });
  const userBrief = String(brief ?? '').trim() || 'متجر إلكتروني مغربي للإكسسوارات والتقنية';

  const completion = await client.chat.completions.create({
    model: settings.textModel || 'gpt-4o-mini',
    temperature: 0.5,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `أنت مساعد لبناء كتالوج وFAQ لمتجر واتساب مغربي. أرجع JSON فقط:
{
  "products": [{ "title": string, "description": string, "priceDh": number }],
  "faqs": [{ "question": string, "answer": string }]
}
2-3 منتجات و1-2 أسئلة شائعة بالعربية/الدارجة.`,
      },
      { role: 'user', content: userBrief },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('رد فارغ من OpenAI');
  }

  const data = JSON.parse(raw);
  const created = [];

  for (const p of data.products ?? []) {
    if (!p?.title) continue;
    created.push(await createKnowledgeItem(organizationId, {
      type: 'PRODUCT',
      title: p.title,
      description: p.description ?? '',
      priceDh: p.priceDh,
    }));
  }

  for (const f of data.faqs ?? []) {
    if (!f?.question) continue;
    created.push(await createKnowledgeItem(organizationId, {
      type: 'FAQ',
      title: f.question,
      answer: f.answer ?? '',
    }));
  }

  return created;
}
