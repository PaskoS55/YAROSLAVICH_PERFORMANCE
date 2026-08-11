'use client';

export default function ArchiveButton() {
  return (
    <button
      type="submit"
      className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      onClick={(e) => {
        if (
          !confirm(
            'Игрок будет скрыт из всех списков и аналитики. История тестирований сохранится. Продолжить?'
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      В архив
    </button>
  );
}