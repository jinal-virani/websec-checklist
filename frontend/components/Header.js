"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "../lib/api";

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState(undefined); // undefined = still checking, null = logged out
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)); }, [pathname]);

  async function logout() {
    await api.logout();
    window.location.href = "/login"; // back to first page after logout
  }

  return (
    <header className="site-header">
      <a href="/" className="brand">WebSec Checklist</a>
      <span className="tag">OWASP-based audit sheet</span>
      <span className="user">
        {user && (
          <>
            <span className="user-name" title={user.name}>{user.name}</span>
            <button className="ghost light" onClick={logout}>Log out</button>
          </>
        )}
        {user === null && pathname !== "/login" && (
          <a className="btn login-btn" href="/login">Login</a>
        )}
      </span>
    </header>
  );
}
