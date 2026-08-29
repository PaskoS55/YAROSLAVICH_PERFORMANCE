'use client';
import { useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

// Existing server-action form; no nested form or unsupported window.prompt.
export default function ConfirmFormButton({ label, description, confirmation, reasons, className }: {
  label: string; description: string; confirmation?: string;
  reasons?: { value: string; label: string }[]; className?: string;
}) {
  const id=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  const {pending}=useFormStatus();
  const [open,setOpen]=useState(false);
  const [text,setText]=useState('');
  const [reason,setReason]=useState(reasons?.[0]?.value ?? '');
  function close(){setOpen(false);setText('');trigger.current?.focus();}
  return <>
    <button ref={trigger} type="button" className={className} disabled={pending} onClick={()=>setOpen(true)}>{label}</button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby={id} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={event=>{if(event.key==='Escape' && !pending)close();}}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 text-left text-gray-900 shadow-xl">
        <h3 id={id} className="text-lg font-semibold">{label}</h3>
        <p className="mt-3 text-sm">{description}</p>
        {confirmation && <label className="mt-4 block text-sm">Введите {confirmation}<input autoFocus value={text} onChange={event=>setText(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>}
        {reasons && <label className="mt-4 block text-sm">Причина<select autoFocus value={reason} onChange={event=>setReason(event.target.value)} className="mt-1 w-full rounded border p-2">{reasons.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={close} className="btn-secondary">Отмена</button>
          <button type="button" disabled={pending || (!!confirmation && text!==confirmation)} className="btn-primary disabled:opacity-50" onClick={()=>{
            const form=trigger.current?.form;
            if(!form || (confirmation && text!==confirmation))return;
            if(reasons){const input=form.elements.namedItem('reason');if(input instanceof HTMLInputElement)input.value=reason;}
            form.requestSubmit();close();
          }}>Подтвердить</button>
        </div>
      </div>
    </div>}
  </>;
}
