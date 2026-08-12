'use client';

export default function ConfirmMarkButton() {
  return (
    <button
      type="submit"
      className="link-action text-xs hover:underline"
      onClick={(e) => {
        const ok = window.confirm(
          'Отметить цель выполненной вручную?\nЭто тренерский override: результат может ещё не соответствовать цели.'
        );
        if (!ok) e.preventDefault();
      }}
    >
      Отметить выполненной
    </button>
  );
}