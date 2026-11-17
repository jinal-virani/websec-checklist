/**
 * Tiny mailer with SMTP + console fallback.
 *
 * - SMTP_HOST set  -> real email via nodemailer
 * - No SMTP_HOST   -> link is printed to the backend console (development/demo)
 *
 * This keeps the project usable for a college demo without SMTP credentials.
 */

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  // Dependency missing: console fallback still works.
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "WebSec Checklist <no-reply@localhost>";
const PROD = process.env.NODE_ENV === "production";

const transporter = nodemailer && SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

function isConfigured() {
  return transporter !== null;
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    if (PROD) {
      console.error(`[email] SMTP not configured; cannot send "${subject}" to ${to}.`);
    } else {
      console.log(`\n[email] SMTP not configured - email for ${to}\nSubject: ${subject}\n${text}\n`);
    }
    return { delivered: false };
  }

  await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
  return { delivered: true };
}

module.exports = { isConfigured, sendMail };
