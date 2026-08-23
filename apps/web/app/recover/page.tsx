import { RecoveryForm } from "./recovery-form";
import { PRODUCT_IDENTITY } from "@pasko-performance/core/product";
export default function RecoveryPage() {
  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1 className="text-2xl font-bold">Восстановление доступа</h1>
        <p className="login-sub">
          Ключ сбрасывает пароль локального администратора, но не
          восстанавливает защищённые машинные секреты.
        </p>
        <RecoveryForm />
        <p className="login-note">{PRODUCT_IDENTITY.creator.creditRu}</p>
      </div>
    </main>
  );
}
