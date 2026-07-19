"use client";

import { useState, type FormEvent } from "react";

interface ContactFormValues {
  name: string;
  email: string;
  message: string;
}

type ContactStatus = "idle" | "sending" | "success" | "error";

const EMPTY_FORM: ContactFormValues = { name: "", email: "", message: "" };

export function ContactForm() {
  const [form, setForm] = useState<ContactFormValues>(EMPTY_FORM);
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [shake, setShake] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setStatus(data.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r"></span>
          <span className="dot y"></span>
          <span className="dot g"></span>
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim">[OK] Conectando con servidor…</div>
          <div className="line dim">[OK] Validando contenido…</div>
          <div className="line dim">[OK] Transmitiendo paquete…</div>
          <div className="line success">
            &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {form.name.trim().toUpperCase()}.
            <span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM);
                setStatus("idle");
              }}
            >
              ENVIAR OTRO MENSAJE
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "sending") {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r"></span>
          <span className="dot y"></span>
          <span className="dot g"></span>
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim fade-in" style={{ animationDelay: "0ms" }}>
            [OK] Conectando con servidor…
          </div>
          <div className="line dim fade-in" style={{ animationDelay: "350ms" }}>
            [OK] Validando contenido…
          </div>
          <div className="line dim fade-in" style={{ animationDelay: "700ms" }}>
            [OK] Transmitiendo paquete…<span className="caret">_</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r"></span>
          <span className="dot y"></span>
          <span className="dot g"></span>
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim">[OK] Conectando con servidor…</div>
          <div className="line dim">[OK] Validando contenido…</div>
          <div className="line" style={{ color: "var(--magenta)" }}>
            &gt; [ERROR] NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.
            <span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={() => setStatus("idle")}>
              REINTENTAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      <div className="field">
        <label>NOMBRE</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="px_kai"
        />
      </div>
      <div className="field">
        <label>CORREO ELECTRÓNICO</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="jugador@vault.gg"
        />
      </div>
      <div className="field">
        <label>MENSAJE</label>
        <textarea
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Cuéntanos qué tienes en mente…"
        ></textarea>
      </div>
      <button className="btn xl press" type="submit" style={{ width: "100%" }}>
        ▶ ENVIAR MENSAJE
      </button>
    </form>
  );
}
