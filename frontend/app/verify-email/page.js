"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

// Module-level cache so React StrictMode's double effect does not consume the
// single-use token twice.
const verifyCache = new Map();

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("checking"); // checking | success | error
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Open the link from your email again.");
      return;
    }

    let active = true;
    let request = verifyCache.get(token);
    if (!request) {
      request = api.verifyEmail(token);
      verifyCache.set(token, request);
    }

    request
      .then(() => {
        if (!active) return;
        setStatus("success");
        setMessage("Your email is verified. You are now logged in.");
      })
      .catch((err) => {
        if (!active) return;
        setStatus("error");
        setMessage(err.message || "This verification link is invalid or expired.");
      });

    return () => { active = false; };
  }, []);

  return (
    <div className="auth-wrap">
      <h1>Email verification</h1>
      <p className="muted">One-time link verification for your WebSec Checklist account.</p>

      <div className={`panel auth-form status-${status}`}>
        {status === "checking" && <p>Verifying your email…</p>}
        {status === "success" && <p className="field-ok">✓ {message}</p>}
        {status === "error" && <p className="error">{message}</p>}

        {status === "success" && (
          <a className="btn" href="/">Continue to dashboard</a>
        )}
        {status !== "success" && (
          <a className="btn ghost" href="/login">Back to login</a>
        )}
      </div>

      {status === "error" && (
        <p className="muted">
          Links expire after 24 hours. Log in with your email and password to request a new
          verification email, or register again with a different address.
        </p>
      )}
    </div>
  );
}
