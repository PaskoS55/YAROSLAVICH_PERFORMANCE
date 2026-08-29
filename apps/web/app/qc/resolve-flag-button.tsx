'use client';

import ConfirmFormButton from '../../components/ConfirmFormButton';

export default function ResolveFlagButton() {
  return <ConfirmFormButton label="Отметить решённым" className="link-action text-xs font-medium hover:underline"
    description="Результат будет принят и включён в расчёты. Само значение не изменится. Укажите основание проверки."
    reasons={[
      {value:'manual:verified',label:'Проверено: значение верное'},
      {value:'manual:fixed',label:'Исправлено в исходных данных'},
      {value:'manual:other',label:'Другое: подтверждено тренером'},
    ]} />;
}
