import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="login-wrap">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ВК Ярославич" className="login-logo" />
                <h1 className="login-title">PASKO PERFORMANCE</h1>
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
                <div className="login-note">Для ВК «Ярославич» · доступ только для персонала</div>
      </div>
    </div>
  );
}
