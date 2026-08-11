import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl font-extrabold" style={{ color: 'var(--red)' }}>
        404
      </div>
      <h1 className="text-xl font-bold">Такой страницы нет</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Возможно, игрок в архиве или ссылка устарела. Вернитесь на главную и
        продолжите работу.
      </p>
      <Link href="/" className="rounded bg-blue-600 px-4 py-2 text-sm text-white">
        На главную
      </Link>
      <div className="mt-6 text-[10px] uppercase tracking-[0.22em] text-gray-400">
        PASKO PERFORMANCE · ВК «Ярославич»
      </div>
    </div>
  );
}