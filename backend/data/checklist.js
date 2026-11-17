// Master checklist.
// Each category lists the security tools used to test it. Every item inherits
// its category's tools so the API/UI can show "what to test with".
// Item format: [title, severity, owasp reference, remediation]
const raw = {
  Authentication: {
    tools: [
      "Burp Suite (Intruder / Repeater)",
      "Hydra",
      "Hashcat",
      "John the Ripper",
      "OWASP ZAP",
      "Browser DevTools",
    ],
    items: [
      ["Strong password policy enforced (length, upper/lower/digit/special)", "High", "A07 / ASVS V2", "Minimum 10 chars with lowercase, uppercase, digit and special character; cap at 72 bytes for bcrypt; block common passwords."],
      ["Multi-factor authentication available for users/admins", "High", "A07 / ASVS V2", "Offer TOTP/WebAuthn; mandatory for admin accounts."],
      ["Account lockout / throttling on repeated login failures", "Medium", "A07 / WSTG-ATHN-03", "Progressive delays, CAPTCHA, alerting on brute-force patterns."],
      ["Secure password reset (single-use, expiring token)", "High", "A07 / WSTG-ATHN-09", "Random token, 15-30 min expiry, invalidate after use, no user enumeration."],
    ],
  },
  "Session Management": {
    tools: [
      "Burp Suite (Proxy / Repeater)",
      "OWASP ZAP",
      "Browser DevTools (Application > Storage)",
      "Cookie-Editor",
      "jwt.io",
    ],
    items: [
      ["Cookies use Secure, HttpOnly and SameSite flags", "High", "A07 / WSTG-SESS-02", "Set Secure; HttpOnly; SameSite=Lax/Strict on session cookies."],
      ["Session ID regenerated after login", "High", "A07 / WSTG-SESS-03", "Issue a new session ID on privilege change to stop session fixation."],
      ["Session timeout and proper logout invalidation", "Medium", "A07 / WSTG-SESS-07", "Idle + absolute timeouts; destroy session server-side on logout."],
    ],
  },
  "Access Control": {
    tools: [
      "Burp Suite (Autorize extension)",
      "OWASP ZAP",
      "ffuf",
      "Postman",
    ],
    items: [
      ["No IDOR: object access checked against the logged-in user", "High", "A01 / WSTG-ATHZ-04", "Verify ownership server-side on every request; use unguessable IDs as defence in depth."],
      ["Role-based access enforced on server for every endpoint", "High", "A01 / ASVS V4", "Deny by default; centralise authorisation checks."],
      ["Forced browsing to admin/hidden pages blocked", "Medium", "A01 / WSTG-ATHZ-02", "Protect admin routes with auth + role check, not by obscurity."],
      ["Least privilege for DB users and services", "Medium", "A01 / ASVS V4", "Separate DB accounts, only required permissions."],
    ],
  },
  "Input Validation & Injection": {
    tools: [
      "Burp Suite (Scanner / Repeater)",
      "sqlmap",
      "XSStrike",
      "Commix",
      "OWASP ZAP",
    ],
    items: [
      ["SQL injection prevented (parameterised queries / ORM)", "High", "A03 / WSTG-INPV-05", "Use prepared statements; never concatenate user input into queries."],
      ["Cross-site scripting (XSS) prevented via output encoding", "High", "A03 / WSTG-INPV-01", "Context-aware encoding, avoid innerHTML, add CSP."],
      ["OS command injection prevented", "High", "A03 / WSTG-INPV-12", "Avoid shell calls; use safe APIs with allow-listed arguments."],
      ["File upload validated (type, size, content, storage location)", "High", "A04 / WSTG-BUSL-09", "Allow-list extensions + MIME, rename files, store outside web root, scan."],
      ["Server-side validation of all inputs (not only client-side)", "Medium", "A03 / ASVS V5", "Schema validation (e.g. Zod/Joi) on every API input."],
    ],
  },
  "Cryptography & Transport": {
    tools: [
      "testssl.sh",
      "SSLyze",
      "Qualys SSL Labs",
      "OpenSSL",
      "Wireshark",
    ],
    items: [
      ["HTTPS enforced with modern TLS (1.2+)", "High", "A02 / WSTG-CRYP-01", "Redirect HTTP->HTTPS, disable old protocols, test with SSL Labs."],
      ["HSTS header enabled", "Medium", "A05 / WSTG-CONF-07", "Strict-Transport-Security: max-age=31536000; includeSubDomains."],
      ["Passwords hashed with bcrypt / Argon2 / scrypt", "High", "A02 / ASVS V2", "Use slow salted hashes; never MD5/SHA1 or plaintext."],
      ["No hard-coded secrets or API keys in code/repo", "High", "A02 / A05", "Use environment variables / secret manager; rotate leaked keys."],
    ],
  },
  "Security Misconfiguration": {
    tools: [
      "Nmap",
      "Nikto",
      "Gobuster",
      "Nuclei",
      "Burp Suite",
    ],
    items: [
      ["Default credentials changed / default accounts removed", "High", "A05 / WSTG-CONF-02", "Remove sample accounts, enforce credential change at install."],
      ["Debug mode and verbose errors disabled in production", "Medium", "A05 / WSTG-ERRH", "NODE_ENV=production; disable stack traces for users."],
      ["Directory listing disabled", "Low", "A05 / WSTG-CONF-04", "Disable autoindex on web server."],
      ["Unnecessary services, ports and sample files removed", "Medium", "A05 / WSTG-CONF-01", "Run port scan, close unused services, delete test pages."],
    ],
  },
  "Security Headers": {
    tools: [
      "securityheaders.com",
      "Mozilla Observatory",
      "curl",
      "Burp Suite",
    ],
    items: [
      ["Content-Security-Policy configured", "Medium", "A05 / WSTG-CONF-12", "Restrictive CSP; avoid unsafe-inline where possible."],
      ["X-Frame-Options / frame-ancestors set (clickjacking)", "Medium", "A05 / WSTG-CLNT-09", "X-Frame-Options: DENY or CSP frame-ancestors 'none'."],
      ["X-Content-Type-Options: nosniff set", "Low", "A05", "Add header on all responses."],
      ["Referrer-Policy and Permissions-Policy set", "Low", "A05", "Referrer-Policy: strict-origin-when-cross-origin."],
    ],
  },
  "API Security": {
    tools: [
      "Postman",
      "Burp Suite",
      "OWASP ZAP",
      "jwt_tool",
      "k6",
    ],
    items: [
      ["Rate limiting applied on APIs", "Medium", "API4 / A04", "Per-IP and per-user limits; stricter for login and OTP endpoints."],
      ["Token (JWT) validated: signature, expiry, audience", "High", "A07 / WSTG-SESS-10", "Reject 'none' alg, short expiry, verify claims server-side."],
      ["Object and function level authorization on every API call", "High", "API1 / API5", "Check permissions per endpoint and per object."],
      ["Mass assignment prevented (allow-list accepted fields)", "Medium", "API3", "Bind only expected fields; never trust is_admin-type fields."],
      ["CORS restricted to trusted origins", "Medium", "A05 / WSTG-CLNT-07", "No wildcard origin with credentials."],
    ],
  },
  "Error Handling & Logging": {
    tools: [
      "Burp Suite",
      "OWASP ZAP",
      "curl",
      "Browser DevTools",
      "ELK Stack / Graylog",
    ],
    items: [
      ["Generic error messages (no stack trace / SQL error leaks)", "Medium", "A05 / WSTG-ERRH-01", "Log details server-side, show generic message to users."],
      ["Security events logged (login failures, access denied)", "Medium", "A09 / ASVS V7", "Log with timestamp, user, IP; no sensitive data in logs."],
      ["Logs protected and monitored / alerting configured", "Low", "A09", "Central log storage, restricted access, alerts on anomalies."],
    ],
  },
  "Components & Dependencies": {
    tools: [
      "npm audit",
      "OWASP Dependency-Check",
      "Retire.js",
      "Snyk",
      "Dependabot",
    ],
    items: [
      ["Dependencies scanned for known vulnerabilities", "High", "A06", "Run npm audit / Dependabot / OWASP Dependency-Check in CI."],
      ["Frameworks, server and OS patched and up to date", "High", "A06", "Patch schedule; subscribe to security advisories."],
      ["Only trusted packages used (supply chain checked)", "Medium", "A08", "Lock files, verify integrity, avoid abandoned packages."],
    ],
  },
  "CSRF / SSRF": {
    tools: [
      "Burp Suite (CSRF PoC generator)",
      "OWASP ZAP",
      "interactsh / Burp Collaborator",
      "curl",
    ],
    items: [
      ["Anti-CSRF tokens or SameSite cookies on state-changing requests", "High", "A01 / WSTG-SESS-05", "CSRF token per session/request, check Origin header."],
      ["SSRF prevented: URL allow-list, internal ranges blocked", "High", "A10", "Validate outbound URLs, block 127.0.0.1/169.254.169.254/private IPs."],
    ],
  },
  "Business Logic": {
    tools: [
      "Burp Suite (Repeater / Intruder)",
      "Postman",
      "OWASP ZAP",
      "Browser DevTools",
    ],
    items: [
      ["Price / quantity / discount tampering prevented server-side", "High", "A04 / WSTG-BUSL-01", "Recalculate totals on server; never trust client values."],
      ["Race conditions handled (coupons, balance, stock)", "Medium", "A04 / WSTG-BUSL-07", "Use DB transactions, locking, idempotency keys."],
      ["Workflow steps cannot be skipped or replayed", "Medium", "A04 / WSTG-BUSL-06", "Enforce state machine on server for multi-step flows."],
    ],
  },
};

const checklist = [];
const categories = [];
let n = 1;
for (const [category, group] of Object.entries(raw)) {
  categories.push({ name: category, tools: group.tools });
  for (const [title, severity, owasp, remediation] of group.items) {
    checklist.push({
      id: "C" + String(n++).padStart(3, "0"),
      category,
      tools: group.tools,
      title,
      severity,
      owasp,
      remediation,
    });
  }
}

// New items are appended AFTER the original 44 so their IDs (C045+) never
// collide with rows already stored in assessment_items. Existing answers keep
// pointing at the same IDs; old assessments get the new rows via
// syncChecklistItems() in server.js.
const additionalItems = [
  {
    category: "Authentication",
    tools: raw.Authentication.tools,
    item: [
      "Email address validated and normalised before account creation",
      "Medium",
      "A07 / ASVS V2",
      "Check format, length and domain labels server-side; normalise to lowercase; block disposable domains.",
    ],
  },
];

for (const { category, tools, item: [title, severity, owasp, remediation] } of additionalItems) {
  checklist.push({
    id: "C" + String(n++).padStart(3, "0"),
    category,
    tools,
    title,
    severity,
    owasp,
    remediation,
  });
}

module.exports = checklist;
module.exports.categories = categories;
