"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clearUser, useStoredUser } from "@/lib/session";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const user = useStoredUser();

  const isActive = (href: string) => {
    if (href === "/biblioteca")
      return pathname === "/biblioteca" || pathname.startsWith("/juego/");
    return pathname === href;
  };

  const close = () => setOpen(false);

  const handleSignOut = () => {
    clearUser();
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("/") ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isActive("/biblioteca") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link
            href="/salon-de-la-fama"
            className={isActive("/salon-de-la-fama") ? "active" : ""}
          >
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isActive("/") ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isActive("/biblioteca") ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          href="/salon-de-la-fama"
          className={isActive("/salon-de-la-fama") ? "active" : ""}
          onClick={close}
        >
          Salón de la Fama
        </Link>
        {user ? (
          <a onClick={handleSignOut}>Cuenta</a>
        ) : (
          <Link
            href="/login"
            className={isActive("/login") ? "active" : ""}
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
