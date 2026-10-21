import OpenAI from 'openai';
import { getAiSettings, MOROCCAN_DARIJA_PERSONA_TEMPLATE } from './aiSettings.js';
import { isLeadAiPaused } from './leadTakeover.js';
import { buildKnowledgeContextForPrompt } from './knowledgeBase.js';
import {
  JSON_OUTPUT_FORMAT_RULES,
  QUALIFICATION_SCORING_RULES,
  QUALIFICATION_SYSTEM_PROMPT,
} from './qualificationPrompt.js';

export { QUALIFICATION_SYSTEM_PROMPT };

const MODEL = 'gpt-4o-mini';

const VALID_STATUSES = new Set(['QUALIFIED', 'QUALIFYING', 'REJECTED']);

const SENDER_LABELS = {
  USER: 'العميل',
  BOT: 'البوت',
  AGENT: 'الوكيل',
};

/**
 * @param {import('@prisma/client').AiSettings} settings
 */
export async function buildQualifierSystemInstruction(settings) {
  const base =
    settings.employeePrompt?.trim() ||
    settings.systemPrompt?.trim() ||
    MOROCCAN_DARIJA_PERSONA_TEMPLATE;

  const scoringRules = settings.qualificationPrompt?.trim() || QUALIFICATION_SCORING_RULES;
  const knowledge = await buildKnowledgeContextForPrompt();

  return `${base}
${knowledge ? `\n\n${knowledge}` : ''}

---

${scoringRules}

${JSON_OUTPUT_FORMAT_RULES}`;
}

/**
 * @param {import('@prisma/client').AiSettings} settings
 */
function createOpenAIClientFromSettings(settings) {
  const apiKey = settings.openAiApiKey?.trim();
  if (!apiKey) {
    throw new Error('مفتاح OpenAI غير مضبوط — أضفه من إعدادات الصوت والذكاء');
  }
  return new OpenAI({ apiKey });
}

/**
 * @param {Array<{ sender: 'USER' | 'BOT' | 'AGENT', content: string, createdAt?: string | Date }>} messages
 */
export function formatConversationTranscript(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '(لا توجد رسائل بعد)';
  }

  const sorted = [...messages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  return sorted
    .map((m) => {
      const label = SENDER_LABELS[m.sender] ?? m.sender;
      const text = typeof m.content === 'string' ? m.content.trim() : '';
      return `${label}: ${text}`;
    })
    .join('\n');
}

function clampScore(score) {
  const n = Number(score);
  if (Number.isNaN(n)) {
    return 5;
  }
  return Math.min(10, Math.max(1, Math.round(n)));
}

function normalizeStatus(status, score) {
  if (score >= 8) {
    return 'QUALIFIED';
  }
  if (VALID_STATUSES.has(status)) {
    return status;
  }
  if (score <= 3) {
    return 'REJECTED';
  }
  return 'QUALIFYING';
}

function normalizeExtractedInfo(raw) {
  const info = raw && typeof raw === 'object' ? raw : {};
  const pick = (key) => {
    const v = info[key];
    if (v == null || v === '') {
      return null;
    }
    return String(v).trim();
  };

  return {
    name: pick('name'),
    product: pick('product'),
    urgency: pick('urgency'),
    budget: pick('budget'),
    city: pick('city'),
    address: pick('address'),
  };
}

/**
 * @param {unknown} raw
 * @returns {{ score: number, status: string, summary: string, extractedInfo: object, botResponse: string }}
 */
export function parseQualificationResult(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    data = JSON.parse(raw);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('AI qualification response is not a JSON object');
  }

  const score = clampScore(data.score);
  const status = normalizeStatus(data.status, score);
  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  const botResponse = typeof data.botResponse === 'string' ? data.botResponse.trim() : '';

  if (!summary || !botResponse) {
    throw new Error('AI qualification response missing summary or botResponse');
  }

  return {
    score,
    status,
    summary,
    extractedInfo: normalizeExtractedInfo(data.extractedInfo),
    botResponse,
  };
}

/**
 * Evaluates WhatsApp lead conversation history and returns qualification JSON.
 *
 * @param {Array<{ sender: 'USER' | 'BOT' | 'AGENT', content: string, createdAt?: string | Date }>} conversationHistory
 * @param {{ leadName?: string | null, leadPhone?: string | null }} [context]
 */
export async function qualifyLead(conversationHistory, context = {}) {
  if (context.lead && isLeadAiPaused(context.lead)) {
    const err = new Error('AI responses are paused — human agent takeover is active');
    err.code = 'AI_PAUSED';
    throw err;
  }
  if (context.aiPaused === true) {
    const err = new Error('AI responses are paused — human agent takeover is active');
    err.code = 'AI_PAUSED';
    throw err;
  }

  const settings = await getAiSettings();
  const systemPrompt = await buildQualifierSystemInstruction(settings);
  const client = createOpenAIClientFromSettings(settings);
  const transcript = formatConversationTranscript(conversationHistory);

  const contextLines = [];
  if (context.leadName) {
    contextLines.push(`اسم مسجل مسبقاً: ${context.leadName}`);
  }
  if (context.leadPhone) {
    contextLines.push(`رقم الهاتف: ${context.leadPhone}`);
  }

  const userContent = [
    contextLines.length ? contextLines.join('\n') : null,
    '--- المحادثة ---',
    transcript,
  ]
    .filter(Boolean)
    .join('\n\n');

  const completion = await client.chat.completions.create({
    model: settings.textModel || MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return parseQualificationResult(content);
}
