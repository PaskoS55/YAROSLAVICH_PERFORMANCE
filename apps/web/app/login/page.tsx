import { login } from './actions';
import Image from 'next/image';
import { PRODUCT_ASSETS, PRODUCT_IDENTITY } from '@pasko-performance/core/product';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="login-wrap">
      <div className="login-card">
        <Image
          src={PRODUCT_ASSETS.logoLight}
          alt={PRODUCT_IDENTITY.display}
          width={2172}
          height={724}
          priority
          className="login-product-logo"
        />
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
        <div className="login-note">{PRODUCT_IDENTITY.creator.creditRu}</div>
      </div>
    </div>
  );
}
