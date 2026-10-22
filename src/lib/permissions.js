/**
 * Per-agent permissions. The ADMIN role always has every permission;
 * these only apply to CONFIRMATION_AGENT accounts.
 */
export const PERMISSIONS = [
  { key: 'analytics', label: 'الرئيسية والتحليلات', hint: 'رؤية الإحصائيات ولوحة النشاط' },
  { key: 'leads', label: 'إدارة الطلبات والعملاء', hint: 'رؤية العملاء المؤهلين والمسلّمين' },
  { key: 'chats', label: 'محادثات الواتساب الحية', hint: 'قراءة المحادثات المباشرة' },
  { key: 'takeover', label: 'الاستلام البشري', hint: 'إيقاف البوت وإعادة تفعيله في محادثة' },
  { key: 'reply', label: 'الرد على العملاء', hint: 'إرسال رسائل ونوت صوتي من الداشبورد' },
  { key: 'knowledge', label: 'الكتالوج والأسئلة (قراءة)', hint: 'رؤية المنتجات والأسئلة الشائعة' },
  { key: 'knowledgeEdit', label: 'تعديل الكتالوج', hint: 'إضافة وتعديل وحذف المنتجات والأسئلة' },
  { key: 'playground', label: 'اختبار البوت', hint: 'استعمال Playground' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** Ready-made roles the admin can pick, then fine-tune. */
export const ROLE_PRESETS = [
  {
    id: 'confirmation',
    label: 'وكيل تأكيد',
    permissions: ['analytics', 'leads', 'chats', 'takeover', 'reply', 'knowledge', 'playground'],
  },
  {
    id: 'supervisor',
    label: 'مشرف',
    permissions: PERMISSION_KEYS,
  },
  {
    id: 'observer',
    label: 'مراقب (قراءة فقط)',
    permissions: ['analytics', 'leads', 'chats', 'knowledge'],
  },
  {
    id: 'catalog',
    label: 'مسؤول الكتالوج',
    permissions: ['knowledge', 'knowledgeEdit', 'playground'],
  },
];

/** Agents created before this feature keep exactly what they could do before. */
export const DEFAULT_AGENT_PERMISSIONS = ROLE_PRESETS[0].permissions;

export function permissionMap(keys) {
  const set = new Set(keys);
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, set.has(k)]));
}

export function allPermissions() {
  return permissionMap(PERMISSION_KEYS);
}

/** Accepts `{key: bool}` or `string[]`; unknown keys are dropped. */
export function normalizePermissions(input) {
  if (Array.isArray(input)) {
    return permissionMap(input.filter((k) => typeof k === 'string'));
  }
  if (input && typeof input === 'object') {
    return permissionMap(PERMISSION_KEYS.filter((k) => input[k] === true));
  }
  return permissionMap(DEFAULT_AGENT_PERMISSIONS);
}
