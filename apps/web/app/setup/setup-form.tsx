"use client";
import { useActionState } from "react";
import { completeSetup, type SetupState } from "./actions";
const field = "w-full rounded-lg border border-gray-200 px-3 py-2";
export function SetupForm({
  existing,
}: {
  existing: { organization?: string; team?: string; season?: string };
}) {
  const [state, action, pending] = useActionState(
    completeSetup,
    {} as SetupState,
  );
  if (state.recoveryKey)
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Ключ восстановления</h2>
        <p>
          Сохраните ключ в безопасном месте. Этот ключ нельзя будет показать
          повторно.
        </p>
        <code className="block rounded bg-gray-100 p-4 text-lg">
          {state.recoveryKey}
        </code>
        <a href="/login" className="btn-primary inline-block">
          Перейти к входу
        </a>
      </div>
    );
  return (
    <form action={action} className="space-y-6">
      {state.error && <div className="login-error">{state.error}</div>}
      <section>
        <h2 className="mb-2 font-bold">Клуб</h2>
        {existing.organization ? (
          <p>{existing.organization}</p>
        ) : (
          <div className="grid gap-2">
            <input
              name="organizationName"
              required
              placeholder="Полное название клуба"
              className={field}
            />
            <input
              name="organizationShortName"
              placeholder="Короткое название"
              className={field}
            />
            <input
              name="organizationCode"
              required
              placeholder="Код клуба"
              className={field}
            />
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-bold">Команда</h2>
        {existing.team ? (
          <p>{existing.team}</p>
        ) : (
          <div className="grid gap-2">
            <input
              name="teamName"
              required
              placeholder="Название команды"
              className={field}
            />
            <input
              name="teamCode"
              required
              placeholder="Код команды"
              className={field}
            />
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-bold">Сезон</h2>
        {existing.season ? (
          <p>{existing.season}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input
              name="seasonName"
              required
              placeholder="2026/27"
              className={`${field} col-span-2`}
            />
            <input type="date" name="startDate" required className={field} />
            <input type="date" name="endDate" required className={field} />
          </div>
        )}
      </section>
      {existing.season && (
        <>
          <input type="hidden" name="startDate" value="2000-01-01" />
          <input type="hidden" name="endDate" value="2000-01-02" />
        </>
      )}
      <section className="grid gap-2">
        <h2 className="font-bold">Администратор</h2>
        <input
          name="displayName"
          required
          placeholder="Имя"
          className={field}
        />
        <input
          name="login"
          required
          autoComplete="username"
          placeholder="Логин"
          className={field}
        />
        <input
          type="password"
          name="password"
          required
          minLength={12}
          maxLength={256}
          autoComplete="new-password"
          placeholder="Пароль (минимум 12 символов)"
          className={field}
        />
        <input
          type="password"
          name="confirmPassword"
          required
          autoComplete="new-password"
          placeholder="Подтверждение пароля"
          className={field}
        />
      </section>
      <button disabled={pending} className="btn-primary">
        {pending ? "Настройка…" : "Завершить настройку"}
      </button>
    </form>
  );
}
