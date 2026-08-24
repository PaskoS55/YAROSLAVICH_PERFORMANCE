import { login } from "./actions";
import Image from "next/image";
import {
  PRODUCT_ASSETS,
  PRODUCT_IDENTITY,
} from "@pasko-performance/core/product";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  if ((await prisma.localUser.count()) === 0) redirect("/setup");
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
        <p className="login-sub">
          Система функциональной и кондиционной подготовки
        </p>
        {query.error && (
          <div className="login-error">
            {query.error === "rate-limit"
              ? "Слишком много попыток. Повторите позже."
              : "Неверный логин или пароль."}
          </div>
        )}
        <form action={login} className="login-form">
          <input
            type="text"
            name="login"
            autoComplete="username"
            required
            placeholder="Логин"
            className="login-input"
          />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Пароль"
            className="login-input"
          />
          <button className="login-btn" type="submit">
            Войти в систему
          </button>
        </form>
        <Link href="/recover" className="link-action text-sm">
          Забыли пароль?
        </Link>
        <div className="login-note">
          {PRODUCT_IDENTITY.vertical} · доступ только для персонала
        </div>
        <div className="login-note">{PRODUCT_IDENTITY.creator.creditRu}</div>
      </div>
    </div>
  );
}
