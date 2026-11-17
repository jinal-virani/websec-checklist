"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { passwordChecks, validateEmail, validatePassword } from "../../lib/validation";

const EMPTY = { name: "", email: "", password: "" };

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | register | forgot | mailSent
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");            // form / server level error
  const [emailError, setEmailError] = useState("");  // shown under the email field
  const [passwordError, setPasswordError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [mailKind, setMailKind] = useState("verify"); // verify | reset
  const [devMail, setDevMail] = useState(false);
  const [busy, setBusy] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isMailSent = mode === "mailSent";

  const checks = useMemo(() => passwordChecks(form.password), [form.password]);
  const emailFormat = form.email.trim()
    ? validateEmail(form.email, { allowDisposable: !isRegister })
    : null;

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");

    if (key === "email") {
      setEmailError("");
      // Live feedback after the first blur or once the user has typed "@".
      if (emailTouched || value.includes("@")) {
        const result = validateEmail(value, { allowDisposable: !isRegister });
        setEmailError(value.trim() && !result.ok ? result.error : "");
      }
    }
    if (key === "password" && passwordError) setPasswordError("");
  };

  function onEmailBlur() {
    setEmailTouched(true);
    if (!form.email.trim()) return setEmailError("");
    const result = validateEmail(form.email, { allowDisposable: !isRegister });
    setEmailError(result.ok ? "" : result.error);
  }

  function onPasswordBlur() {
    if (!isRegister || !form.password) return;
    const result = validatePassword(form.password);
    setPasswordError(result.ok ? "" : result.error);
  }

  // Already logged in? go to the main page.
  useEffect(() => { api.me().then(() => { window.location.href = "/"; }).catch(() => {}); }, []);

  function switchMode(next) {
    setMode(next);
    setForm(EMPTY);
    setError("");
    setEmailError("");
    setPasswordError("");
    setEmailTouched(false);
    setNotice("");
    setDevMail(false);
    setBusy(false);
  }

  async function resendVerification() {
    setBusy(true);
    setNotice("");
    try {
      const res = await api.resendVerification({ email: pendingEmail });
      setDevMail(!!res.devMail);
      setNotice(res.message || "Verification email sent.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");
    setEmailTouched(true);

    if (isForgot) {
      if (!form.email.trim()) return setEmailError("Email is required.");
      const emailCheck = validateEmail(form.email, { allowDisposable: true });
      if (!emailCheck.ok) {
        setEmailError(emailCheck.error);
        emailRef.current?.focus();
        return;
      }
      setBusy(true);
      try {
        const res = await api.forgotPassword({ email: emailCheck.value });
        setPendingEmail(emailCheck.value);
        setMailKind("reset");
        setDevMail(!!res.devMail);
        setNotice(res.message || "If an account exists for this email, a password reset link has been sent.");
        setMode("mailSent");
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (isRegister && form.name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      nameRef.current?.focus();
      return;
    }

    const emailCheck = validateEmail(form.email, { allowDisposable: !isRegister });
    if (!emailCheck.ok) {
      setEmailError(emailCheck.error);
      emailRef.current?.focus();
      return;
    }

    if (isRegister) {
      const passwordCheck = validatePassword(form.password);
      if (!passwordCheck.ok) {
        setPasswordError(passwordCheck.error);
        passwordRef.current?.focus();
        return;
      }
    } else if (!form.password) {
      setPasswordError("Password is required.");
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        const res = await api.register({ name: form.name.trim(), email: emailCheck.value, password: form.password });
        setPendingEmail(res.email || emailCheck.value);
        setMailKind("verify");
        setDevMail(!!res.devMail);
        setNotice("We sent a verification link to your email. Open it to activate your account.");
        setMode("mailSent");
      } else {
        await api.login({ email: emailCheck.value, password: form.password });
        window.location.href = "/";
        return;
      }
    } catch (err) {
      if (isRegister && /email/i.test(err.message)) setEmailError(err.message);
      else if (isRegister && /password/i.test(err.message)) setPasswordError(err.message);
      else if (err.status === 403 && err.data?.needsVerification) {
        setPendingEmail(err.data.email || emailCheck.value);
        setMailKind("verify");
        setDevMail(!!err.data.devMail);
        setNotice("This account is not verified yet. Open the link in your inbox, or resend it below.");
        setMode("mailSent");
      } else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (isMailSent) {
    return (
      <div className="auth-wrap">
        <h1>{mailKind === "verify" ? "Verify your email" : "Check your email"}</h1>
        <p className="muted">
          {mailKind === "verify"
            ? "Your account is created but not active yet."
            : "Password reset link request received."}
        </p>

        <div className="panel auth-form">
          <p>
            <strong>{pendingEmail}</strong>
          </p>
          <p className="muted">{notice}</p>

          {devMail && (
            <p className="notice">
              SMTP is not configured, so the link was printed in the <strong>backend terminal</strong>.
              Copy it from there to continue.
            </p>
          )}

          {mailKind === "verify" && (
            <>
              <button type="button" onClick={resendVerification} disabled={busy}>
                {busy ? "Sending…" : "Resend verification email"}
              </button>
              <button type="button" className="ghost" onClick={() => switchMode("register")}>
                Use a different email
              </button>
            </>
          )}
          <button type="button" className="ghost auth-switch" onClick={() => switchMode("login")}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <h1>{isRegister ? "Create account" : isForgot ? "Forgot password" : "Log in"}</h1>
      <p className="muted">
        {isRegister
          ? "Your assessments are private to your account. Email verification is required."
          : isForgot
            ? "Enter your account email and we will send a reset link."
            : "Your assessments are private to your account."}
      </p>

      {/* key remounts the form when the mode changes, so fields are always empty */}
      <form key={mode} className="panel auth-form" onSubmit={submit} noValidate>
        {isRegister && (
          <label>Name
            <input ref={nameRef} name="fullname" value={form.name} onChange={set("name")} required
              minLength={2} maxLength={60} autoComplete="name" />
          </label>
        )}

        <label>Email
          <input ref={emailRef} name="user-email" type="email" inputMode="email" value={form.email}
            onChange={set("email")} onBlur={onEmailBlur} required maxLength={254}
            autoComplete={isRegister ? "email" : "username"} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            aria-invalid={emailError ? "true" : "false"} aria-describedby={emailError ? "email-error" : undefined}
            className={emailError ? "invalid" : ""} />
        </label>
        {isRegister && (
          <span id="email-help" className="muted">
            Use a valid, permanent email address. Disposable/temporary domains are blocked.
            We send a verification link — you can log in only after opening it.
          </span>
        )}
        {emailError && <span id="email-error" className="field-error" role="alert">{emailError}</span>}
        {!emailError && emailTouched && emailFormat?.ok && (
          <span className="field-ok">
            ✓ Email format is valid{isRegister ? " — a verification link will be sent." : "."}
          </span>
        )}

        {!isForgot && (
          <>
            <label>Password
              <input ref={passwordRef} name="user-pass" type="password" value={form.password}
                onChange={set("password")} onBlur={onPasswordBlur} required
                minLength={isRegister ? 10 : 1} maxLength={72}
                autoComplete={isRegister ? "new-password" : "current-password"}
                autoCapitalize="none" spellCheck={false}
                aria-invalid={passwordError ? "true" : "false"} aria-describedby={passwordError ? "password-error" : undefined}
                className={passwordError ? "invalid" : ""} />
            </label>
            {isRegister && (
              <ul className="pw-rules" aria-label="Password requirements">
                {checks.map((check) => (
                  <li key={check.id} className={check.ok ? "ok" : "bad"}>
                    <span aria-hidden="true">{check.ok ? "✓" : "○"}</span> {check.label}
                  </li>
                ))}
              </ul>
            )}
            {passwordError && <span id="password-error" className="field-error" role="alert">{passwordError}</span>}
          </>
        )}

        {error && <span className="error" role="alert">{error}</span>}

        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : isRegister ? "Create account" : isForgot ? "Send reset link" : "Log in"}
        </button>

        <div className="auth-links">
          {isLogin && (
            <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>
          )}
          {isForgot && (
            <button type="button" className="link-btn" onClick={() => switchMode("login")}>Back to login</button>
          )}
        </div>
      </form>

      {!isForgot && (
        <button className="ghost auth-switch" onClick={() => switchMode(isRegister ? "login" : "register")}>
          {isRegister ? "Have an account? Log in" : "New here? Create an account"}
        </button>
      )}
    </div>
  );
}
