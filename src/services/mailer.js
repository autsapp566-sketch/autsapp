import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transport;

function getTransport() {
  if (!env.smtpUrl) return null;
  transport ??= nodemailer.createTransport(env.smtpUrl);
  return transport;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function layout(title, body, ctaLabel, ctaUrl) {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#020617;padding:32px 16px;font-family:Segoe UI,Tahoma,sans-serif;color:#e2e8f0">
<table role="presentation" width="100%" style="max-width:480px;margin:auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;color:#34d399;font-size:13px;font-weight:600">WhatsApp AI Agent</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#fff">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#94a3b8">${escapeHtml(body)}</p>
<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px">${escapeHtml(ctaLabel)}</a>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;word-break:break-all">${escapeHtml(ctaUrl)}</p>
</td></tr></table></body></html>`;
}

/**
 * Sends a message through SMTP. Without SMTP_URL (local dev) the link is logged instead
 * so the flow can be exercised end-to-end. Production without SMTP_URL logs a loud warning and
 * never prints the token.
 */
async function send({ to, subject, text, html, devLink }) {
  const t = getTransport();
  if (!t) {
    if (env.nodeEnv === 'production') {
      console.warn(`[mailer] SMTP_URL is not set — e-mail "${subject}" to ${to} was NOT delivered`);
    } else {
      console.log(`[mailer:dev] To: ${to}\n  Subject: ${subject}\n  Link: ${devLink}`);
    }
    return;
  }
  await t.sendMail({ from: env.mailFrom, to, subject, text, html });
}

export function sendVerificationEmail(to, token) {
  const link = `${env.webPublicUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const title = 'تأكيد بريدك الإلكتروني';
  const body = 'شكراً لتسجيلك. اضغط على الزر لتأكيد بريدك وتفعيل حسابك. الرابط صالح لمدة 24 ساعة.';
  return send({
    to,
    subject: title,
    text: `${body}\n${link}`,
    html: layout(title, body, 'تأكيد البريد', link),
    devLink: link,
  });
}

export function sendPasswordResetEmail(to, token) {
  const link = `${env.webPublicUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const title = 'إعادة تعيين كلمة المرور';
  const body = 'طلبت إعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة واحدة ويُستخدم مرة واحدة. إن لم تطلب ذلك فتجاهل هذه الرسالة.';
  return send({
    to,
    subject: title,
    text: `${body}\n${link}`,
    html: layout(title, body, 'تعيين كلمة مرور جديدة', link),
    devLink: link,
  });
}
