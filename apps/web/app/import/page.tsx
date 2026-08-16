import ImportForm from './import-form';

export default function ImportPage() {
  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Импорт</h1>
        <p className="mt-1 text-sm text-gray-500">
          Загрузка результатов тестирования из CSV.
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 text-sm text-gray-600">
          <p className="mb-2">
            Формат: <b>PlayerID;Date;TestCode;Value;Phase</b> (разделитель <b>;</b> или{' '}
            <b>,</b>). Первая строка-заголовок пропускается автоматически. Колонка{' '}
            <b>Phase</b> необязательна (по умолчанию INSEASON).
          </p>
          <p className="text-xs text-gray-500">
            Пример: <code className="font-mono">P001 · 2026-08-11 · PWR_CMJ · 48.2 · INSEASON</code>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Допустимые фазы: PRESEASON, CAMP, INSEASON, POSTSEASON, RECOVERY.
          </p>
        </div>
        <ImportForm />
      </div>
    </div>
  );
}