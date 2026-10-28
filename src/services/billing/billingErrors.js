/**
 * Machine-readable billing/entitlement failures. The dashboard switches on `code`
 * (e.g. show an "Upgrade" dialog); `error` is a human message (Arabic, like the rest of the API).
 */
export const BILLING_MESSAGES = {
  NO_SUBSCRIPTION: 'لا يوجد اشتراك نشط لهذه المؤسسة. اختر باقة للمتابعة.',
  SUBSCRIPTION_PAST_DUE: 'فشل تجديد الاشتراك (دفعة متأخرة). حدّث وسيلة الدفع لإعادة التفعيل.',
  SUBSCRIPTION_CANCELED: 'تم إلغاء الاشتراك. جدّده لمتابعة استخدام الخدمة.',
  SUBSCRIPTION_EXPIRED: 'انتهت فترة الاشتراك. جدّده لمتابعة استخدام الخدمة.',
  ACCOUNT_SUSPENDED: 'تم تعليق هذا الحساب من قِبل إدارة المنصة. تواصل مع الدعم.',
  PLAN_LIMIT_WHATSAPP_INSTANCES: 'وصلت للحد الأقصى لأرقام واتساب في باقتك. رقّ الباقة لربط رقم إضافي.',
  PLAN_LIMIT_AI_MESSAGES: 'استهلكت كل رسائل الذكاء الاصطناعي في باقتك لهذه الفترة. رقّ الباقة لمتابعة الردود الآلية.',
};

export class BillingError extends Error {
  /**
   * @param {keyof typeof BILLING_MESSAGES} code
   * @param {Record<string, unknown>} [details] safe-to-expose extras (limit, used, planTier, ...)
   */
  constructor(code, details = {}) {
    super(BILLING_MESSAGES[code] ?? 'Billing error');
    this.name = 'BillingError';
    this.code = code;
    this.billing = true;
    this.status = 402;
    this.expose = true;
    this.details = details;
  }
}