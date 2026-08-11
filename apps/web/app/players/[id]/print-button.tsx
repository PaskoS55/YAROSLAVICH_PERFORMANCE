'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200"
    >
      Печать
    </button>
  );
}