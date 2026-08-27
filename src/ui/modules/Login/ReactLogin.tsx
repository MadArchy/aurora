/**
 * SPEC-010 · React Login (wave 1, T-010-111).
 *
 * Authority: presentation only. The form collects credentials and forwards them
 * to the command seam, which delegates to the trusted auth runtime. This module
 * never decides whether a login succeeds and never assigns a role.
 *
 * Zod validates SHAPE ONLY (present, well-formed). Passing validation is not
 * authorization: `sessionCommands.login` still runs the full trusted auth path,
 * and its verdict is the only thing rendered (acceptance A13, threat T-010-18).
 *
 * SCOPE NOTE — invitation acceptance is intentionally absent (AUDIT010-09). The
 * legacy flow completes it with `dbService` business writes that have no
 * canonical use case, so it stays on the legacy interface rather than being
 * reproduced here through a forbidden path. Legacy remains the served
 * presentation by default, so the capability is not lost.
 */

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { sessionCommands } from '../../commands/commandSeam';
import { applyUiMode } from '../../mount';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Introduce tu correo.').email('Correo no válido.'),
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

type LoginFields = z.infer<typeof loginSchema>;

const VALUE_POINTS = [
  'Tesis de posicionamiento clara, aprobada por el cliente.',
  'Radar de señales puntuadas contra esa tesis, no ruido genérico.',
  'Contenido listo para grabar con teleprompter integrado.',
  'Resultados medidos con KPIs de negocio, no vanity metrics.',
];

export function ReactLogin() {
  const [rejection, setRejection] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    defaultValues: { email: 'manager@postura.internal', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRejection('');

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setRejection(parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.');
      return;
    }

    // Shape was valid; authorization is still decided entirely by the trusted runtime.
    const result = await sessionCommands.login(parsed.data.email, parsed.data.password);
    if (!result.ok) setRejection(result.message);
  });

  return (
    <div className="login-shell" data-testid="react-login">
      <aside className="login-aside">
        <div className="login-aside-top">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span className="brand-logo">POSTURA</span>
        </div>

        <div>
          <h1 className="login-headline">Autoridad profesional, construida con método.</h1>
          <p className="login-lede">
            Plataforma de posicionamiento asistida por IA con control humano en cada entrega. Del
            análisis a la publicación, sin improvisar.
          </p>
          <ul className="login-points">
            {VALUE_POINTS.map((text) => (
              <li key={text}>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="login-aside-foot">Positioning Intelligence &amp; Management System · v1.1</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <h1>Entrar a la plataforma</h1>
          <p>Cada cuenta es un usuario real con permisos propios.</p>

          {rejection ? (
            <div className="login-error" role="alert" data-testid="react-login-error">
              <span>{rejection}</span>
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="react-login-email">
                Correo
              </label>
              <input
                className="form-input"
                type="email"
                id="react-login-email"
                autoComplete="username"
                placeholder="tu@empresa.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'react-login-email-error' : undefined}
                {...register('email')}
              />
              {errors.email ? (
                <span className="form-hint" id="react-login-email-error" role="alert">
                  {errors.email.message}
                </span>
              ) : null}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="react-login-password">
                Contraseña
              </label>
              <input
                className="form-input"
                type="password"
                id="react-login-password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'react-login-password-error' : undefined}
                {...register('password')}
              />
              {errors.password ? (
                <span className="form-hint" id="react-login-password-error" role="alert">
                  {errors.password.message}
                </span>
              ) : null}
            </div>

            <button
              className="btn btn-gradient btn-lg btn-block"
              type="submit"
              disabled={isSubmitting}
              data-testid="react-login-submit"
            >
              {isSubmitting ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="login-hint">
            ¿Tienes un token de invitación? Ese flujo continúa en la interfaz anterior.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void applyUiMode('legacy')}
            data-testid="react-login-to-legacy"
          >
            Volver a la interfaz anterior
          </button>
        </div>
      </main>
    </div>
  );
}
