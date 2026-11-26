import { useState } from "react";
import type { FormEvent } from "react";
import { DEMO_PASSWORD, enabledRoles, LOGIN_MESSAGE, roles } from "../data/users";
import type { LoginResult } from "../data/users";
import { useStore } from "../store/Store";
import ThemeToggle from "../theme/ThemeToggle";

export default function Login() {
  const { login, loginAs } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const show = (r: LoginResult) => setError(r === "ok" ? "" : LOGIN_MESSAGE[r]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    show(login(email, password));
  };
  return (
    <main className="login">
      <section className="card login-card" aria-labelledby="login-title">
        <div className="login-theme"><ThemeToggle /></div>
        <h1 id="login-title" className="brand">EduMaster<small>.ai</small></h1>
        <span className="badge demo">DEMO · autenticación simulada</span>
        <form onSubmit={submit} noValidate>
          <label>Correo
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="estudiante@edumaster.demo" aria-describedby={error ? "login-error" : undefined} />
          </label>
          <label>Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={error ? "login-error" : undefined} />
          </label>
          {error && <p id="login-error" role="alert" className="login-error">{error}</p>}
          <button type="submit">Entrar</button>
        </form>
        <p className="muted small">Contraseña de demostración: <code>{DEMO_PASSWORD}</code> · correo: <code>rol@edumaster.demo</code></p>
        <h2>O entra con un rol de demostración</h2>
        <div className="login-roles">
          {roles.map((r) => {
            const on = enabledRoles.includes(r.id);
            return (
              <button key={r.id} type="button" className="ghost login-role" disabled={!on} onClick={() => show(loginAs(r.id))}>
                <b>{r.label}</b>
                <span className="muted small">{on ? r.desc : "Fuera del alcance del prototipo"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
