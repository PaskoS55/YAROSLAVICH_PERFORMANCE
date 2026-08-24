"use client";

import { useActionState, useState } from "react";
import { updateOrganization, type OrganizationFormState } from "./actions";

const hex = /^#[0-9A-F]{6}$/;
const field = "mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
const fallback = { primary: "#C8102E", secondary: "#111618" };

export function readableText(color: string) {
  if (!hex.test(color)) return "#FFFFFF";
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111618" : "#FFFFFF";
}

function ColorControl({ label, description, name, value, defaultColor, setValue }: { label: string; description: string; name: string; value: string; defaultColor: string; setValue: (value: string) => void }) {
  return <div className="rounded-xl border border-gray-200 p-4">
    <label htmlFor={`${name}-hex`} className="text-sm font-bold text-gray-800">{label}</label>
    <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
    <div className="mt-3 flex items-center gap-3">
      <input aria-label={`Выбрать ${label.toLowerCase()}`} type="color" value={hex.test(value) ? value : defaultColor} onChange={(e) => setValue(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1" />
      <input id={`${name}-hex`} name={name} value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="#RRGGBB" maxLength={7} className={`${field} mt-0 font-mono uppercase`} aria-invalid={Boolean(value && !hex.test(value))} />
    </div>
    {value && !hex.test(value) && <p className="mt-2 text-xs font-medium text-red-700">Введите цвет в формате #RRGGBB.</p>}
  </div>;
}

type Organization = { name: string; shortName: string | null; logoAssetKey: string | null; code: string; primaryColor: string | null; secondaryColor: string | null };

export function OrganizationBrandingForm({ organization }: { organization: Organization }) {
  const [state, action, pending] = useActionState(updateOrganization, {} as OrganizationFormState);
  const [primary, setPrimary] = useState(organization.primaryColor ?? "");
  const [secondary, setSecondary] = useState(organization.secondaryColor ?? "");
  const previewPrimary = hex.test(primary) ? primary : fallback.primary;
  const previewSecondary = hex.test(secondary) ? secondary : fallback.secondary;
  const valid = (!primary || hex.test(primary)) && (!secondary || hex.test(secondary));
  return <form action={action} className="space-y-4">
    {state.error && <div className="login-error" role="alert">{state.error}</div>}
    {state.success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{state.success}</div>}
    <div><label htmlFor="org-name" className="block text-sm font-semibold text-gray-700">Полное название</label><input id="org-name" name="name" defaultValue={organization.name} required className={field} /></div>
    <div><label htmlFor="org-short" className="block text-sm font-semibold text-gray-700">Короткое название</label><input id="org-short" name="shortName" defaultValue={organization.shortName ?? ""} className={field} /></div>
    <input type="hidden" name="logoAssetKey" value={organization.logoAssetKey ?? ""} />
    <div className="grid gap-4 xl:grid-cols-2">
      <ColorControl label="Основной цвет клуба" description="Используется для основных акцентов интерфейса и отчётов." name="primaryColor" value={primary} defaultColor={fallback.primary} setValue={setPrimary} />
      <ColorControl label="Дополнительный цвет клуба" description="Используется для вторичных элементов оформления." name="secondaryColor" value={secondary} defaultColor={fallback.secondary} setValue={setSecondary} />
    </div>
    <button type="button" className="setup-secondary" onClick={() => { setPrimary(""); setSecondary(""); }}>Вернуть цвета по умолчанию</button>
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Предпросмотр</p><div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="h-2" style={{ background: previewPrimary }} /><div className="p-5"><h3 className="break-words text-lg font-bold">{organization.shortName || organization.name}</h3><div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-lg px-4 py-2 text-sm font-bold" style={{ background: previewPrimary, color: readableText(previewPrimary) }}>Основная кнопка</span><span className="flex items-center gap-2 text-sm"><i className="h-3 w-3 rounded-full" style={{ background: previewSecondary }} />Активный элемент</span></div></div></div></div>
    <details className="text-sm text-gray-500"><summary className="cursor-pointer font-semibold">Техническая информация</summary><p className="mt-2 font-mono">Organization code: {organization.code}</p></details>
    <button disabled={pending || !valid} className="btn-primary">{pending ? "Сохраняем…" : "Сохранить оформление"}</button>
  </form>;
}
