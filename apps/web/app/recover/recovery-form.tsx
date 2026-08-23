"use client";
import { useActionState } from "react";
import { recoverPassword, type RecoveryState } from "./actions";
export function RecoveryForm() {
  const [state, action, pending] = useActionState(
    recoverPassword,
    {} as RecoveryState,
  );
  if (state.recoveryKey)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Новый ключ восстановления</h1>
        <p>Сохраните ключ. Старый ключ больше не действует.</p>
        <code className="block rounded bg-gray-100 p-4">
          {state.recoveryKey}
        </code>
        <a className="btn-primary inline-block" href="/login">
          Перейти ко входу
        </a>
      </div>
    );
  return (
    <form action={action} className="login-form">
      {state.error && <div className="login-error">{state.error}</div>}
      <input
        className="login-input"
        name="login"
        required
        placeholder="Логин"
      />
      <input
        className="login-input"
        name="recoveryKey"
        required
        placeholder="Ключ восстановления"
      />
      <input
        className="login-input"
        type="password"
        name="password"
        minLength={12}
        maxLength={256}
        required
        placeholder="Новый пароль"
      />
      <input
        className="login-input"
        type="password"
        name="confirmPassword"
        required
        placeholder="Подтверждение пароля"
      />
      <button className="login-btn" disabled={pending}>
        Сбросить пароль
      </button>
    </form>
  );
}
