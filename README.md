# Web Application Security Checklist Tool (v2)

College project: OWASP-based security checklist ke saath full-stack audit tool.
Ab isme **login system**, **strong email/password validation** aur **category-wise tools** bhi hain.

**Stack:** Next.js 14 (App Router) + Node.js/Express + SQLite (better-sqlite3)

## Features
- Register / Login / Logout (JWT in httpOnly cookie)
- Valid email required at registration (format + length + domain checks, disposable domains blocked)
- Inline field validation: invalid email/password ke neeche turant red error + red border
- Strong password policy with a live requirement checklist on the register form
- Fully responsive UI (mobile 320px+, tablet, desktop; no horizontal scroll)
- 12 categories, 45 checklist items (OWASP Top 10 / ASVS / WSTG mapped)
- Har category ke saath **recommended testing tools** (e.g. Authentication → Burp Intruder, Hydra, Hashcat)
- Har item: severity, OWASP reference, remediation, Pass/Fail/N-A + notes
- Live compliance score + progress bar
- Printable report (Print -> Save as PDF) with failed findings + tools used
- Har user ke assessments private hote hain (database me user_id se linked)

## Validation rules

### Email (registration)
- Empty/spaces allowed nahi; server-side par bhi validate hota hai
- Max 254 characters, local part max 64 characters
- Exactly one `@`, valid domain labels aur 2-63 letter TLD
- Leading/trailing dot aur `..` reject
- Disposable/temporary domains (mailinator, yopmail, 10minutemail, etc.) blocked
- Email lowercase me normalize hota hai

### Password (registration)
- 10-72 characters (bcrypt sirf first 72 bytes use karta hai)
- Kam se kam ek lowercase letter (a-z)
- Kam se kam ek uppercase letter (A-Z)
- Kam se kam ek digit (0-9)
- Kam se kam ek special character (e.g. `! @ # $ % ^ & *`)
- UI par live checklist batata hai kaunsi requirement pending hai

Errors field ke neeche inline dikhte hain (red border + message), aur form par
`noValidate` hai — isliye browser ka native popup hamare custom validation ko
block nahi karta. Server-side validation phir bhi hamesha chalti hai.

## Responsive design
- Mobile (320px+), tablet aur desktop par tested — koi horizontal scroll nahi
- Header wrap hota hai, mobile par tag hide hota hai
- Create-assessment form 820px se neeche single column ho jata hai
- Login/Register form mobile par full-width buttons ke saath
- Assessment items, tool chips, filter aur Pass/Fail buttons sab wrap hote hain
- Toast mobile par bottom-left/right me aa jata hai
- Print/PDF layout alag `@media print` rules se control hota hai

## Security features (viva me bata sakte ho)
| Checklist item | Is project me kaise implement hua |
|---|---|
| Password hashing | bcrypt (cost 12) |
| Password policy | 10-72 chars + lowercase + uppercase + digit + special |
| Email validation | Format, length, domain labels, disposable blocklist, lowercase normalisation |
| Account lockout | 5 failed logins -> 15 min lock |
| No user enumeration | Generic login error + dummy hash compare |
| Secure cookies | httpOnly + SameSite=Lax (+ Secure in production) |
| JWT validation | HS256 only, 2h expiry, secret from env |
| IDOR prevention | Har query me `user_id` ownership check |
| SQL injection | Sirf prepared statements |
| Rate limiting | General API + stricter on auth routes |
| Security headers | Helmet |
| CORS | Sirf frontend origin allowed |
| Input validation | Shared validators, length limits, id format, status allow-list |
| Error handling | Generic 500, no stack trace leak |
| Logging | Failed logins console me log hote hain |
| Checklist sync | Naye checklist items purane assessments me automatically add hote hain |

## Tools by category
| Category | Recommended tools |
|---|---|
| Authentication | Burp Suite (Intruder/Repeater), Hydra, Hashcat, John the Ripper, OWASP ZAP, Browser DevTools |
| Session Management | Burp Suite, OWASP ZAP, DevTools Storage, Cookie-Editor, jwt.io |
| Access Control | Burp Suite (Autorize), OWASP ZAP, ffuf, Postman |
| Input Validation & Injection | Burp Suite, sqlmap, XSStrike, Commix, OWASP ZAP |
| Cryptography & Transport | testssl.sh, SSLyze, Qualys SSL Labs, OpenSSL, Wireshark |
| Security Misconfiguration | Nmap, Nikto, Gobuster, Nuclei, Burp Suite |
| Security Headers | securityheaders.com, Mozilla Observatory, curl, Burp Suite |
| API Security | Postman, Burp Suite, OWASP ZAP, jwt_tool, k6 |
| Error Handling & Logging | Burp Suite, OWASP ZAP, curl, DevTools, ELK/Graylog |
| Components & Dependencies | npm audit, OWASP Dependency-Check, Retire.js, Snyk, Dependabot |
| CSRF / SSRF | Burp Suite (CSRF PoC), OWASP ZAP, interactsh/Collaborator, curl |
| Business Logic | Burp Suite (Repeater/Intruder), Postman, OWASP ZAP, DevTools |

## Folder structure
```
websec-checklist/
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js              # API + auth + security middleware
│   ├── db.js                  # SQLite schema (users, assessments, assessment_items)
│   ├── utils/validation.js    # Email + password + name validators
│   └── data/checklist.js      # Master checklist + category tools
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── lib/api.js
    ├── lib/validation.js      # Same rules as backend (instant UI feedback)
    ├── components/Header.js
    └── app/
        ├── layout.js, globals.css
        ├── page.js                    # Assessments list
        ├── login/page.js              # Login / Register + live password rules
        └── assessment/[id]/page.js    # Checklist + category tools + report
```

## Run kaise kare
Node.js 18+ chahiye.

```bash
# Terminal 1 - backend
cd backend
cp .env.example .env     # JWT_SECRET change karo (Windows: copy .env.example .env)
npm install
npm start                # http://localhost:5000

# Terminal 2 - frontend
cd frontend
npm install
npm run dev              # http://localhost:3000
```
Agar `.env` use nahi karna to bas `JWT_SECRET=kuch-lamba-random npm start` bhi chalega.
Database file `backend/data/app.db` pehli run par apne aap ban jati hai.
Testing ke liye alag database chahiye to: `DB_PATH=./data/test.db npm start`.

## API
| Method | Endpoint | Auth |
|---|---|---|
| POST | /api/auth/register, /api/auth/login, /api/auth/logout | - |
| GET | /api/auth/me | yes |
| GET | /api/checklist | yes |
| GET/POST | /api/assessments | yes |
| GET/DELETE | /api/assessments/:id | yes (owner only) |
| PUT | /api/assessments/:id/items/:itemId | yes (owner only) |

## Future scope
MongoDB/PostgreSQL migration, role-based admin, PDF export library,
SMTP-based email verification (link/OTP), CI/CD security scanning.

## Note
Testing sirf apni lab ya authorized targets (DVWA, Juice Shop) par karo.
