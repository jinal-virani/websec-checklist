/**
 * Registration validation rules (backend source of truth).
 * Keep in sync with frontend/lib/validation.js.
 */

const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72; // bcrypt only uses the first 72 bytes

const LOCAL_PART_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const TLD_RE = /^[a-z]{2,63}$/i;
const WHITESPACE_OR_CONTROL_RE = /[\s\u0000-\u001f\u007f]/;

// Throwaway inboxes are rejected so accounts are tied to a real mailbox.
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "dispostable.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

const PASSWORD_POLICY_TEXT =
  "Password must be 10-72 characters and include a lowercase letter, an uppercase letter, a digit and a special character (e.g. ! @ # $ % ^ & *).";

function fail(error, value = "") {
  return { ok: false, value, error };
}

function validateName(raw) {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (value.length < 2) return fail("Name must be at least 2 characters.", value);
  if (value.length > 60) return fail("Name must be at most 60 characters.", value);
  if (/[\u0000-\u001f\u007f]/.test(value)) return fail("Name contains invalid characters.", value);
  return { ok: true, value, error: "" };
}

function normalizeEmail(raw) {
  return String(raw ?? "").trim().toLowerCase();
}

function validateEmail(raw, { allowDisposable = false } = {}) {
  const value = normalizeEmail(raw);

  if (!value) return fail("Email is required.", value);
  if (value.length > EMAIL_MAX_LENGTH) return fail("Email is too long (maximum 254 characters).", value);
  if (WHITESPACE_OR_CONTROL_RE.test(value))
    return fail("Enter a valid email address without spaces.", value);

  // Exactly one @, with content on both sides.
  const at = value.lastIndexOf("@");
  if (at < 1 || at !== value.indexOf("@"))
    return fail("Enter a valid email address (e.g. name@example.com).", value);

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  if (!local || !domain) return fail("Enter a valid email address (e.g. name@example.com).", value);
  if (local.length > EMAIL_LOCAL_MAX_LENGTH)
    return fail("The part before @ must be at most 64 characters.", value);
  if (local.startsWith(".") || local.endsWith(".") || local.includes(".."))
    return fail("Email cannot start/end with a dot or contain two dots in a row.", value);
  if (!LOCAL_PART_RE.test(local))
    return fail("Email contains characters that are not allowed.", value);

  if (domain.length > 253 || !domain.includes("."))
    return fail("Enter a valid email domain (e.g. example.com).", value);

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_RE.test(label)))
    return fail("Enter a valid email domain (e.g. example.com).", value);
  if (!TLD_RE.test(labels[labels.length - 1]))
    return fail("Enter a valid email domain with a real-looking TLD (e.g. .com, .in, .org).", value);

  for (const blocked of DISPOSABLE_DOMAINS) {
    if (!allowDisposable && (domain === blocked || domain.endsWith("." + blocked)))
      return fail("Disposable/temporary email addresses are not allowed. Use a permanent email.", value);
  }

  return { ok: true, value, error: "" };
}

function passwordChecks(raw) {
  const value = String(raw ?? "");
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: value.length >= PASSWORD_MIN_LENGTH },
    { id: "lowercase", label: "A lowercase letter (a-z)", ok: /[a-z]/.test(value) },
    { id: "uppercase", label: "An uppercase letter (A-Z)", ok: /[A-Z]/.test(value) },
    { id: "digit", label: "A digit (0-9)", ok: /\d/.test(value) },
    { id: "special", label: "A special character (e.g. ! @ # $ % ^ & *)", ok: /[^A-Za-z0-9\s]/.test(value) },
  ];
}

function validatePassword(raw) {
  const value = String(raw ?? "");
  const checks = passwordChecks(value);

  if (!value) return { ok: false, value, checks, error: "Password is required." };
  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES)
    return { ok: false, value, checks, error: "Password must be at most 72 bytes (characters)." };
  if (checks.some((check) => !check.ok))
    return { ok: false, value, checks, error: PASSWORD_POLICY_TEXT };

  return { ok: true, value, checks, error: "" };
}

module.exports = {
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_POLICY_TEXT,
  normalizeEmail,
  passwordChecks,
  validateEmail,
  validateName,
  validatePassword,
};
