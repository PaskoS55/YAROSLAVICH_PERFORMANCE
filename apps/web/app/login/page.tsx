import { login } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-2 text-center text-2xl font-bold">
          YAROSLAVICH PERFORMANCE
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Введите пароль для входа
        </p>
        {searchParams.error && (
          <div className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-800">
            Неверный пароль
          </div>
        )}
        <form action={login} className="space-y-4">
          <input
            type="password"
            name="password"
            autoFocus
            required
            placeholder="Пароль"
            className="w-full rounded border-2 border-gray-300 px-3 py-2"
          />
          <button className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}