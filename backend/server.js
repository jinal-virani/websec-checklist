const fs = require("fs");
const path = require("path");

// Tiny .env loader (no extra dependency). Real environment variables win.
function loadEnvFile(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  } catch {
    // No .env file: fall back to the shell environment.
  }
}
loadEnvFile(path.join(__dirname, ".env"));

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("./db");
const checklist = require("./data/checklist");
const { normalizeEmail, validateEmail, validateName, validatePassword } = require("./utils/validation");
const { isConfigured: mailerConfigured, sendMail } = require("./utils/mailer");

const app = express();
const PORT = process.env.PORT || 5000;
const PROD = process.env.NODE_ENV === "production";
const APP_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const STATUSES = ["Pass", "Fail", "N/A", "Pending"];
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 2 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 30 * 60 * 1000;       // 30 minutes

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(48).toString("hex");
  console.warn("WARNING: JWT_SECRET not set. Using a random one (logins reset on restart).");
}

// ---- Security middleware ----
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 120 }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: "Too many attempts, try later" } });
const emailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many email requests, try later" } });

// ---- Helpers ----
const clean = (s, max) => String(s || "").trim().slice(0, max);
const idOk = (id) => /^[a-f0-9-]{36}$/.test(id);
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");
function createToken() {
  const token = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  return { token, hash: hashToken(token) };
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

async function sendVerificationEmail(user, token) {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const text = `Hi ${user.name},\n\nVerify your WebSec Checklist email address by opening this link:\n${link}\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.`;
  const html = `<p>Hi ${escapeHtml(user.name)},</p>
<p>Verify your WebSec Checklist email address:</p>
<p><a href="${link}">Verify my email</a></p>
<p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>`;
  try {
    await sendMail({ to: user.email, subject: "Verify your WebSec Checklist email", text, html });
  } catch (err) {
    console.error("[email] verification email failed:", err.message);
  }
}

async function sendResetEmail(user, token) {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const text = `Hi ${user.name},\n\nReset your WebSec Checklist password by opening this link:\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email.`;
  const html = `<p>Hi ${escapeHtml(user.name)},</p>
<p>Reset your WebSec Checklist password:</p>
<p><a href="${link}">Choose a new password</a></p>
<p>This link expires in 30 minutes and can be used once. If you did not request this, ignore this email.</p>`;
  try {
    await sendMail({ to: user.email, subject: "Reset your WebSec Checklist password", text, html });
  } catch (err) {
    console.error("[email] reset email failed:", err.message);
  }
}

// Checklist items added after an assessment was created would otherwise be
// missing from it. INSERT OR IGNORE only fills the gaps, so answers are safe.
function syncChecklistItems() {
  const ids = db.prepare("SELECT id FROM assessments").all();
  if (ids.length === 0) return;
  const insert = db.prepare("INSERT OR IGNORE INTO assessment_items (assessment_id, item_id) VALUES (?, ?)");
  db.transaction(() => {
    for (const { id } of ids) for (const item of checklist) insert.run(id, item.id);
  })();
}
syncChecklistItems();

function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "2h", algorithm: "HS256" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: PROD, maxAge: SESSION_MS });
}

function requireAuth(req, res, next) {
  try {
    const p = jwt.verify(req.cookies.token || "", JWT_SECRET, { algorithms: ["HS256"] });
    const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(p.sub);
    if (!user) throw new Error("no user");
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Please log in" });
  }
}

function summarize(assessmentId) {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM assessment_items WHERE assessment_id = ? GROUP BY status").all(assessmentId);
  const c = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const pass = c["Pass"] || 0, fail = c["Fail"] || 0, na = c["N/A"] || 0;
  const applicable = checklist.length - na;
  return {
    total: checklist.length, pass, fail, na,
    pending: checklist.length - pass - fail - na,
    score: applicable > 0 ? Math.round((pass / applicable) * 100) : 0,
  };
}

// Ownership check: only returns the assessment if it belongs to the logged-in user (prevents IDOR)
const getOwned = (id, userId) => db.prepare("SELECT * FROM assessments WHERE id = ? AND user_id = ?").get(id, userId);

// ---- Auth routes ----
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const nameCheck = validateName(req.body.name);
  if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });

  const emailCheck = validateEmail(req.body.email);
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

  const passwordCheck = validatePassword(req.body.password);
  if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error });

  const name = nameCheck.value;
  const email = emailCheck.value;
  const password = passwordCheck.value;

  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))
    return res.status(409).json({ error: "Could not register with these details" });

  const id = crypto.randomUUID();
  const { token, hash } = createToken();
  db.prepare(`INSERT INTO users
      (id, name, email, password_hash, email_verified, verify_token_hash, verify_expires, created_at)
      VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, name, email, bcrypt.hashSync(password, 12), 0, hash, Date.now() + VERIFY_TTL_MS, new Date().toISOString());

  // No session yet: the account becomes usable only after the email link is opened.
  await sendVerificationEmail({ id, name, email }, token);
  res.status(201).json({
    requiresVerification: true,
    email,
    devMail: !mailerConfigured() && !PROD,
  });
});

app.post("/api/auth/login", authLimiter, (req, res) => {
  const email = normalizeEmail(clean(req.body.email, 254));
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const generic = { error: "Invalid email or password" };

  if (user && user.locked_until > Date.now())
    return res.status(429).json({ error: "Account temporarily locked. Try again in a few minutes." });

  // compare against a dummy hash when the user doesn't exist (same timing, no user enumeration)
  const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    if (user) {
      const fails = user.failed_attempts + 1;
      if (fails >= MAX_FAILS) db.prepare("UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?").run(Date.now() + LOCK_MS, user.id);
      else db.prepare("UPDATE users SET failed_attempts = ? WHERE id = ?").run(fails, user.id);
      console.warn(`[security] failed login for user ${user.id}`);
    }
    return res.status(401).json(generic);
  }

  db.prepare("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?").run(user.id);

  if (user.email_verified === 0) {
    return res.status(403).json({
      error: "Please verify your email address before logging in. Check your inbox for the verification link.",
      needsVerification: true,
      email: user.email,
      devMail: !mailerConfigured() && !PROD,
    });
  }

  setSession(res, user.id); // fresh token on every login
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post("/api/auth/verify-email", authLimiter, (req, res) => {
  const token = String(req.body.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: "Invalid or expired verification link" });

  const user = db.prepare("SELECT * FROM users WHERE verify_token_hash = ?").get(hashToken(token));
  if (!user || user.verify_expires < Date.now())
    return res.status(400).json({ error: "Invalid or expired verification link" });

  db.prepare("UPDATE users SET email_verified = 1, verify_token_hash = NULL, verify_expires = 0 WHERE id = ?").run(user.id);
  setSession(res, user.id);
  console.log(`[security] email verified for user ${user.id}`);
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post("/api/auth/resend-verification", emailLimiter, async (req, res) => {
  const email = normalizeEmail(clean(req.body.email, 254));
  if (!email) return res.status(400).json({ error: "Email is required" });

  const generic = {
    ok: true,
    message: "If an unverified account exists for this email, a new verification link has been sent.",
    devMail: !mailerConfigured() && !PROD,
  };
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || user.email_verified === 1) return res.json(generic);

  const { token, hash } = createToken();
  db.prepare("UPDATE users SET verify_token_hash = ?, verify_expires = ? WHERE id = ?")
    .run(hash, Date.now() + VERIFY_TTL_MS, user.id);
  await sendVerificationEmail(user, token);
  res.json(generic);
});

app.post("/api/auth/forgot-password", emailLimiter, async (req, res) => {
  const email = normalizeEmail(clean(req.body.email, 254));
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Always the same answer, so this endpoint cannot be used to enumerate accounts.
  const generic = {
    ok: true,
    message: "If an account exists for this email, a password reset link has been sent.",
    devMail: !mailerConfigured() && !PROD,
  };
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.json(generic);

  const { token, hash } = createToken();
  db.prepare("UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?")
    .run(hash, Date.now() + RESET_TTL_MS, user.id);
  await sendResetEmail(user, token);
  res.json(generic);
});

app.post("/api/auth/reset-password", authLimiter, (req, res) => {
  const token = String(req.body.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: "Invalid or expired reset link" });

  const passwordCheck = validatePassword(req.body.password);
  if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error });

  const user = db.prepare("SELECT * FROM users WHERE reset_token_hash = ?").get(hashToken(token));
  if (!user || user.reset_expires < Date.now())
    return res.status(400).json({ error: "Invalid or expired reset link" });

  db.prepare(`UPDATE users SET password_hash = ?, email_verified = 1,
      reset_token_hash = NULL, reset_expires = 0, failed_attempts = 0, locked_until = 0
      WHERE id = ?`)
    .run(bcrypt.hashSync(passwordCheck.value, 12), user.id);

  console.warn(`[security] password reset completed for user ${user.id}`);
  res.json({ ok: true });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax", secure: PROD });
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json(req.user));

// ---- Checklist + assessments (all require login) ----
app.get("/api/checklist", requireAuth, (req, res) => res.json(checklist));

app.get("/api/assessments", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(rows.map((a) => ({ id: a.id, name: a.name, target: a.target, createdAt: a.created_at, summary: summarize(a.id) })));
});

app.post("/api/assessments", requireAuth, (req, res) => {
  const name = clean(req.body.name, 100);
  const target = clean(req.body.target, 200);
  if (!name) return res.status(400).json({ error: "Name is required" });
  const id = crypto.randomUUID();
  const create = db.transaction(() => {
    db.prepare("INSERT INTO assessments (id, user_id, name, target, created_at) VALUES (?,?,?,?,?)")
      .run(id, req.user.id, name, target, new Date().toISOString());
    const ins = db.prepare("INSERT INTO assessment_items (assessment_id, item_id) VALUES (?, ?)");
    checklist.forEach((c) => ins.run(id, c.id));
  });
  create();
  res.status(201).json({ id });
});

app.get("/api/assessments/:id", requireAuth, (req, res) => {
  if (!idOk(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const a = getOwned(req.params.id, req.user.id);
  if (!a) return res.status(404).json({ error: "Not found" });
  const items = {};
  db.prepare("SELECT item_id, status, notes FROM assessment_items WHERE assessment_id = ?").all(a.id)
    .forEach((r) => (items[r.item_id] = { status: r.status, notes: r.notes }));
  res.json({ id: a.id, name: a.name, target: a.target, createdAt: a.created_at, items, summary: summarize(a.id) });
});

app.put("/api/assessments/:id/items/:itemId", requireAuth, (req, res) => {
  const { id, itemId } = req.params;
  if (!idOk(id) || !checklist.some((c) => c.id === itemId)) return res.status(400).json({ error: "Invalid id" });
  if (!getOwned(id, req.user.id)) return res.status(404).json({ error: "Not found" });
  const { status, notes } = req.body;
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
    db.prepare("UPDATE assessment_items SET status = ? WHERE assessment_id = ? AND item_id = ?").run(status, id, itemId);
  }
  if (notes !== undefined)
    db.prepare("UPDATE assessment_items SET notes = ? WHERE assessment_id = ? AND item_id = ?").run(clean(notes, 1000), id, itemId);
  const item = db.prepare("SELECT status, notes FROM assessment_items WHERE assessment_id = ? AND item_id = ?").get(id, itemId);
  res.json({ item, summary: summarize(id) });
});

app.delete("/api/assessments/:id", requireAuth, (req, res) => {
  if (!idOk(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  db.prepare("DELETE FROM assessments WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.status(204).end();
});

// Generic error handler (no stack trace leak)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  if (!mailerConfigured()) {
    console.warn("[email] SMTP not configured. In development, verification/reset links are printed in this console.");
  }
});
