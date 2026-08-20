import { esc } from '../lib/escape';
import { icon } from '../lib/icons';

const VALUE_POINTS: { icon: string; text: string }[] = [
  { icon: 'target', text: 'Tesis de posicionamiento clara, aprobada por el cliente.' },
  { icon: 'radar', text: 'Radar de señales puntuadas contra esa tesis, no ruido genérico.' },
  { icon: 'film', text: 'Contenido listo para grabar con teleprompter integrado.' },
  { icon: 'chart', text: 'Resultados medidos con KPIs de negocio, no vanity metrics.' },
];

export function renderLogin(error = '', inviteToken = ''): string {
  return `
    <div class="login-shell">
      <aside class="login-aside">
        <div class="login-aside-top">
          <span class="brand-mark" aria-hidden="true">P</span>
          <span class="brand-logo">POSTURA</span>
        </div>

        <div>
          <h1 class="login-headline">Autoridad profesional, construida con método.</h1>
          <p class="login-lede">
            Plataforma de posicionamiento asistida por IA con control humano en cada
            entrega. Del análisis a la publicación, sin improvisar.
          </p>
          <ul class="login-points">
            ${VALUE_POINTS.map((p) => `<li>${icon(p.icon, 18)}<span>${esc(p.text)}</span></li>`).join('')}
          </ul>
        </div>

        <p class="login-aside-foot">Positioning Intelligence &amp; Management System · v1.1</p>
      </aside>

      <main class="login-main">
        <div class="login-card">
          <h1>Entrar a la plataforma</h1>
          <p>Cada cuenta es un usuario real con permisos propios.</p>

          ${error ? `<div class="login-error" role="alert">${icon('shield', 16)}<span>${esc(error)}</span></div>` : ''}

          <form id="form-login" novalidate>
            <div class="form-group">
              <label class="form-label" for="login-email">Correo</label>
              <input class="form-input" type="email" id="login-email" required
                autocomplete="username" placeholder="tu@empresa.com"
                value="manager@postura.internal" />
            </div>
            <div class="form-group">
              <label class="form-label" for="login-password">Contraseña</label>
              <input class="form-input" type="password" id="login-password" required
                autocomplete="current-password" placeholder="••••••••" />
            </div>
            <button class="btn btn-gradient btn-lg btn-block" type="submit">Iniciar sesión</button>
          </form>

          <p class="login-hint">
            Cuentas de demostración: <code>manager@postura.internal</code> ·
            <code>juan.vasquez@lexfirm.com</code><br />
            Contraseña: <code>Postura2026!</code>
          </p>

          <div class="login-divider">o</div>

          <details class="login-collapse" ${inviteToken ? 'open' : ''}>
            <summary>Tengo un token de invitación</summary>
            <div class="login-collapse-body">
              <form id="form-accept-invite" novalidate>
                <div class="form-group">
                  <label class="form-label" for="invite-token">Token de invitación</label>
                  <input class="form-input" id="invite-token" value="${esc(inviteToken)}" required
                    placeholder="inv_..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="invite-name">Nombre para mostrar</label>
                  <input class="form-input" id="invite-name" required placeholder="Nombre y apellido" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="invite-password">Elige contraseña</label>
                  <input class="form-input" type="password" id="invite-password" minlength="8" required
                    placeholder="Mínimo 8 caracteres" />
                  <span class="form-hint">Mínimo 8 caracteres.</span>
                </div>
                <button class="btn btn-secondary btn-block" type="submit">Crear cuenta de cliente</button>
              </form>
            </div>
          </details>
        </div>
      </main>
    </div>
  `;
}
