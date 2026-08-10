import ImportForm from './import-form';

export default function ImportPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Импорт данных</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <p className="mb-2 text-sm text-gray-600">
          Формат CSV (разделитель <b>;</b> или <b>,</b>):{' '}
          <b>PlayerID;Дата;TestCode;Значение</b>. Первая строка-заголовок пропускается
          автоматически.
        </p>
        <pre className="mb-4 rounded bg-gray-100 p-3 text-xs">
{`PlayerID;Date;Test;Value
P001;2026-08-11;PWR_CMJ;48.2
P002;2026-08-11;PWR_CMJ;45.1
P003;2026-08-11;SPD_10;1.71`}
        </pre>
        <ImportForm />
      </div>
    </div>
  );
}