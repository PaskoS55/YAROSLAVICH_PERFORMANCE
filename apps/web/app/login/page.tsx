import { login } from './actions';
import { PRODUCT_IDENTITY } from '@pasko-performance/core/product';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo flex items-center justify-center rounded-full bg-gray-100 text-4xl font-extrabold text-red-700" aria-label="PASKO product placeholder">P</div>
        <h1 className="login-title">{PRODUCT_IDENTITY.canonical}</h1>
        <p className="login-sub">Система функциональной и кондиционной подготовки</p>
        {query.error && (
          <div className="login-error">Неверный пароль. Попробуйте ещё раз.</div>
        )}
        <form action={login} className="login-form">
          <input
            type="password"
            name="password"
            autoFocus
            required
            placeholder="Пароль"
            className="login-input"
          />
          <button className="login-btn" type="submit">
            Войти в систему
          </button>
        </form>
        <div className="login-note">{PRODUCT_IDENTITY.vertical} · доступ только для персонала</div>
      </div>
    </div>
  );
}
