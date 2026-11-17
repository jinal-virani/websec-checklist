"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { passwordChecks, validatePassword } from "../../lib/validation";

export default function ResetPasswordPage() {
  const [token, setToken] = useState(null); // null = reading URL, "" = missing
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setPasswordError("");
    setConfirmError("");

    const check = validatePassword(password);
    if (!check.ok) return setPasswordError(check.error);
    if (password !== confirm) return setConfirmError("Passwords do not match.");

    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (token === null) {
    return <p className="muted">Loading…</p>;
  }

  if (!token) {
    return (
      <div className="auth-wrap">
        <h1>Reset password</h1>
        <div className="panel auth-form">
          <p className="error">Reset link is missing or incomplete.</p>
          <a className="btn" href="/login">Back to login</a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <h1>Password updated</h1>
        <div className="panel auth-form">
          <p className="field-ok">✓ Your password has been changed successfully.</p>
          <p className="muted">Log in with your new password. All old reset links are now invalid.</p>
          <a className="btn" href="/login">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <h1>Choose a new password</h1>
      <p className="muted">This reset link can be used once and expires after 30 minutes.</p>

      <form className="panel auth-form" onSubmit={submit} noValidate>
        <label>New password
          <input name="new-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
            required minLength={10} maxLength={72} autoComplete="new-password" autoCapitalize="none" spellCheck={false}
            aria-invalid={passwordError ? "true" : "false"} className={passwordError ? "invalid" : ""} />
        </label>
        <ul className="pw-rules" aria-label="Password requirements">
          {checks.map((check) => (
            <li key={check.id} className={check.ok ? "ok" : "bad"}>
              <span aria-hidden="true">{check.ok ? "✓" : "○"}</span> {check.label}
            </li>
          ))}
        </ul>
        {passwordError && <span className="field-error" role="alert">{passwordError}</span>}

        <label>Confirm new password
          <input name="confirm-password" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setConfirmError(""); }}
            required maxLength={72} autoComplete="new-password" autoCapitalize="none" spellCheck={false}
            aria-invalid={confirmError ? "true" : "false"} className={confirmError ? "invalid" : ""} />
        </label>
        {confirmError && <span className="field-error" role="alert">{confirmError}</span>}

        {error && <span className="error" role="alert">{error}</span>}

        <button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
      </form>

      <a className="muted" href="/login">Back to login</a>
    </div>
  );
}
