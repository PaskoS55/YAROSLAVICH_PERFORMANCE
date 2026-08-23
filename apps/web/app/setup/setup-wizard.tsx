"use client";

import { useActionState, useState, type ReactNode } from "react";
import { completeSetup, type SetupState } from "./actions";
import { SETUP_COPY } from "./setup-copy";

type Existing = { organization?: string; team?: string; season?: string };
type Values = Record<string, string>;
const field = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm";
const steps = ["Клуб", "Команда", "Сезон", "Администратор"];

function seasonDefaults() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { seasonName: `${year}/${String(year + 1).slice(-2)}`, startDate: `${year}-07-01`, endDate: `${year + 1}-06-30` };
}

export function SetupWizard({ existing }: { existing: Existing }) {
  const [step, setStep] = useState(existing.organization && existing.team && existing.season ? 3 : -1);
  const [values, setValues] = useState<Values>(() => seasonDefaults());
  const [clientError, setClientError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [complete, setComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(completeSetup, {} as SetupState);
  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));

  const validate = () => {
    if (step === 0 && !existing.organization && !values.organizationName?.trim()) return "Название клуба обязательно.";
    if (step === 1 && !existing.team && !values.teamName?.trim()) return "Название команды обязательно.";
    if (step === 2 && !existing.season) {
      if (!values.seasonName?.trim()) return "Название сезона обязательно.";
      if (!values.startDate || !values.endDate || values.startDate > values.endDate) return "Дата начала не может быть позже даты окончания.";
    }
    return "";
  };
  const next = () => { const error = validate(); setClientError(error); if (!error) setStep((value) => value + 1); };

  if (state.recoveryKey && state.summary) {
    if (complete) return <Complete summary={state.summary} />;
    return <section className="space-y-5" aria-labelledby="recovery-title">
      <div className="setup-step-badge">Шаг 5 из 5</div>
      <h2 id="recovery-title" className="text-2xl font-bold">Ключ восстановления</h2>
      <p className="text-sm leading-6 text-gray-600">Сохраните этот ключ в безопасном месте. Он понадобится для восстановления пароля. Этот ключ нельзя будет показать повторно.</p>
      <code className="block break-all rounded-xl border border-gray-200 bg-gray-50 p-4 text-base font-bold tracking-wide">{state.recoveryKey}</code>
      <button type="button" className="setup-secondary" onClick={async () => { await navigator.clipboard.writeText(state.recoveryKey!); setCopied(true); }}>{copied ? "Скопировано" : "Копировать"}</button>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700"><input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>Я сохранил ключ в безопасном месте.</span></label>
      <button type="button" disabled={!acknowledged} className="btn-primary" onClick={() => setComplete(true)}>Я сохранил ключ →</button>
    </section>;
  }
  if (step < 0) return <section className="py-4 text-center">
    <h1 className="text-3xl font-extrabold tracking-tight">{SETUP_COPY.welcomeTitle}</h1>
    <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-gray-600">{SETUP_COPY.welcomeDescription}</p>
    <p className="mt-2 text-sm text-gray-500">Настройка займёт несколько минут.</p>
    <button type="button" className="btn-primary mt-7" onClick={() => setStep(0)}>Начать настройку</button>
  </section>;

  return <form action={action} className="space-y-5" onSubmit={() => setClientError("")}>
    <Progress step={step} />
    {(clientError || state.error) && <div className="login-error" role="alert">{clientError || state.error}</div>}
    {step === 0 && <StepClub existing={existing.organization} values={values} set={set} />}
    {step === 1 && <StepTeam existing={existing.team} values={values} set={set} />}
    {step === 2 && <StepSeason existing={existing.season} values={values} set={set} />}
    {step === 3 && <StepAdmin values={values} set={set} show={showPassword} toggle={() => setShowPassword((value) => !value)} />}
    {Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
      <button type="button" className="setup-secondary" onClick={() => { setClientError(""); setStep((value) => Math.max(0, value - 1)); }} disabled={pending}>← Назад</button>
      {step < 3 ? <button type="button" className="btn-primary" onClick={next}>Продолжить →</button> : <button disabled={pending} className="btn-primary">{pending ? SETUP_COPY.pending : "Завершить настройку"}</button>}
    </div>
  </form>;
}

function Progress({ step }: { step: number }) { return <div><div className="mb-2 flex justify-between text-xs font-semibold text-gray-500"><span>Шаг {step + 1} из 4</span><span>{steps[step]}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#C8102E] transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div></div>; }
function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) { return <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-700">{children}</label>; }
function Existing({ value }: { value: string }) { return <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Уже настроено</p><p className="mt-1 break-words font-semibold">{value}</p></div>; }
function StepClub({ existing, values, set }: { existing?: string; values: Values; set: (n: string, v: string) => void }) { return <section className="space-y-4"><h2 className="text-2xl font-bold">Клуб</h2>{existing ? <Existing value={existing} /> : <><div><Label htmlFor="organizationName">Полное название клуба</Label><input id="organizationName" required value={values.organizationName ?? ""} onChange={(e) => set("organizationName", e.target.value)} className={field} placeholder="ВК Ярославич" /></div><div><Label htmlFor="organizationShortName">Короткое название</Label><input id="organizationShortName" value={values.organizationShortName ?? ""} onChange={(e) => set("organizationShortName", e.target.value)} className={field} placeholder="Ярославич" /><p className="mt-1 text-xs text-gray-500">Необязательно. Используется в компактных элементах интерфейса.</p></div></>}</section>; }
function StepTeam({ existing, values, set }: { existing?: string; values: Values; set: (n: string, v: string) => void }) { return <section className="space-y-4"><h2 className="text-2xl font-bold">Команда</h2>{existing ? <Existing value={existing} /> : <div><Label htmlFor="teamName">Название команды</Label><input id="teamName" required value={values.teamName ?? ""} onChange={(e) => set("teamName", e.target.value)} className={field} placeholder="Основная команда" /><p className="mt-1 text-xs text-gray-500">Например: Основная команда, Молодёжная команда или U18.</p></div>}</section>; }
function StepSeason({ existing, values, set }: { existing?: string; values: Values; set: (n: string, v: string) => void }) { return <section className="space-y-4"><h2 className="text-2xl font-bold">Сезон</h2>{existing ? <Existing value={existing} /> : <><div><Label htmlFor="seasonName">Название сезона</Label><input id="seasonName" required value={values.seasonName} onChange={(e) => set("seasonName", e.target.value)} className={field} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="startDate">Дата начала</Label><input id="startDate" type="date" required value={values.startDate} onChange={(e) => set("startDate", e.target.value)} className={field} /></div><div><Label htmlFor="endDate">Дата окончания</Label><input id="endDate" type="date" required value={values.endDate} onChange={(e) => set("endDate", e.target.value)} className={field} /></div></div></>}</section>; }
function StepAdmin({ values, set, show, toggle }: { values: Values; set: (n: string, v: string) => void; show: boolean; toggle: () => void }) { return <section className="space-y-4"><h2 className="text-2xl font-bold">Администратор</h2>{[["displayName", "Имя администра", "Сергей Пасько"], ["login", "Логин", "admin"]].map(([name, label, placeholder]) => <div key={name}><Label htmlFor={name}>{label}</Label><input id={name} required autoComplete={name === "login" ? "username" : "name"} value={values[name] ?? ""} onChange={(e) => set(name, e.target.value)} className={field} placeholder={placeholder} /></div>)}<div className="grid gap-4 sm:grid-cols-2">{[["password", "Пароль"], ["confirmPassword", "Подтвердите пароль"]].map(([name, label]) => <div key={name}><Label htmlFor={name}>{label}</Label><input id={name} type={show ? "text" : "password"} required minLength={12} maxLength={256} autoComplete="new-password" value={values[name] ?? ""} onChange={(e) => set(name, e.target.value)} className={field} /></div>)}</div><div className="flex items-center justify-between"><p className="text-xs text-gray-500">Минимум 12 символов.</p><button type="button" className="text-xs font-semibold text-[#A50D24]" onClick={toggle}>{show ? "Скрыть пароли" : "Показать пароли"}</button></div></section>; }
function Complete({ summary }: { summary: NonNullable<SetupState["summary"]> }) { return <section className="space-y-5"><div className="setup-step-badge">Готово</div><h2 className="text-3xl font-extrabold">{SETUP_COPY.completeTitle}</h2><p className="text-sm text-gray-600">{SETUP_COPY.completeSubtitle}</p><dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 rounded-xl bg-gray-50 p-5 text-sm"><dt className="text-gray-500">Клуб</dt><dd className="break-words font-semibold">{summary.organization}</dd><dt className="text-gray-500">Команда</dt><dd className="break-words font-semibold">{summary.team}</dd><dt className="text-gray-500">Сезон</dt><dd className="font-semibold">{summary.season}</dd><dt className="text-gray-500">Администратор</dt><dd className="font-semibold">{summary.administrator}</dd></dl><a href="/login" className="btn-primary inline-block">Перейти ко входу</a></section>; }
