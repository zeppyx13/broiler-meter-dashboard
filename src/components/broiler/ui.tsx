"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBroiler } from "./broiler-provider";
import { readData, queryScope, metric } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";

export const inputStyle = "w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2.5 text-sm focus:border-[#7B1113] outline-none";
export const buttonStyle = "inline-flex items-center justify-center rounded-xl bg-[#7B1113] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#5A0B0C]";
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="rounded-3xl border border-[#EAEAEA] bg-white p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-poppins text-lg font-semibold">{title}</h2>{action}</div>{children}</section>; }
export function Notice({ children }: { children: ReactNode }) { return <p role="status" className="my-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{children}</p>; }
export function Failure({ error }: { error: unknown }) { return error ? <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{apiErrorMessage(error)}. Periksa akses, koneksi, atau kebutuhan migrasi server.</p> : null; }
export function Badge({ children }: { children: ReactNode }) { return <span className="inline-block rounded-full bg-[#F5F0E8] px-3 py-1 text-xs font-medium text-[#7B1113]">{children}</span>; }
export function PageControls({ page, change, more, label }: { page: number; change: (page: number) => void; more: boolean; label: string }) { return <nav aria-label={label} className="my-3 flex gap-3"><button disabled={page <= 1} onClick={() => change(page - 1)} className="rounded-lg border p-2 text-sm disabled:opacity-40">Sebelumnya</button><span className="self-center text-xs">Halaman {page}</span><button disabled={!more} onClick={() => change(page + 1)} className="rounded-lg border p-2 text-sm disabled:opacity-40">Berikutnya</button></nav>; }
export function Value({ label, value, unit = "", hint }: { label: string; value: unknown; unit?: string; hint?: string }) { return <div className="rounded-2xl bg-[#FAFAFA] p-4"><p className="text-xs text-[#777]">{label}</p><p className="my-2 font-poppins text-xl font-semibold">{metric(value, 2, unit)}</p>{hint && <p className="text-xs text-[#777]">{hint}</p>}</div>; }
export function Evidence({ value }: { value: unknown }) { return <details className="my-2 text-xs text-[#666]"><summary className="cursor-pointer">Bukti, metode & batas interpretasi</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#FAFAFA] p-3">{JSON.stringify(value, null, 2)}</pre></details>; }
export function useResource<T>(name: string, path: string | null, params?: Record<string, unknown>, interval?: number) { const b = useBroiler(); return useQuery({ queryKey: [...queryScope(b.user?.id, b.farmId, b.coopId, b.source), name, path, params], queryFn: () => readData<T>(path!, params), enabled: Boolean(b.user && path), refetchInterval: interval, retry: false }); }

export type FormField = { key: string; label: string; type?: "text" | "number" | "date" | "textarea" | "checkbox" | "json"; required?: boolean; value?: unknown; options?: { value: string; label: string }[]; min?: number; max?: number; step?: string };
export function EditForm({ title, fields, submit, onDone, button = "Simpan" }: { title: string; fields: FormField[]; submit: (values: Record<string, unknown>) => Promise<unknown>; onDone?: () => void; button?: string }) {
    const [error, setError] = useState<unknown>(null);
    const [pending, setPending] = useState(false);
    const [saved, setSaved] = useState(false);
    return <form aria-label={title} className="space-y-3" onSubmit={async event => {
        event.preventDefault(); setError(null); setPending(true); setSaved(false);
        const data = new FormData(event.currentTarget); const values: Record<string, unknown> = {};
        try { for (const field of fields) { const raw = data.get(field.key); if (field.type === "checkbox") values[field.key] = raw === "on"; else if (raw !== null && String(raw).trim() !== "") values[field.key] = field.type === "number" ? Number(raw) : field.type === "json" ? JSON.parse(String(raw)) : String(raw); else if (field.value !== undefined) values[field.key] = null; }
            await submit(values); setSaved(true); onDone?.();
        } catch (err) { setError(err); } finally { setPending(false); }
    }}><h3 className="font-semibold">{title}</h3><div className="grid gap-3 sm:grid-cols-2">{fields.map(f => <label key={f.key} className={`block text-sm ${f.type === "textarea" || f.type === "json" ? "sm:col-span-2" : ""}`}><span className="mb-1 block text-[#666]">{f.label}</span>{f.options ? <select name={f.key} defaultValue={String(f.value ?? "")} required={f.required} className={inputStyle}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === "textarea" || f.type === "json" ? <textarea name={f.key} defaultValue={typeof f.value === "object" ? JSON.stringify(f.value) : String(f.value ?? "")} required={f.required} className={inputStyle} rows={3} /> : <input name={f.key} type={f.type ?? "text"} step={f.step ?? "any"} min={f.min} max={f.max} defaultChecked={f.type === "checkbox" ? Boolean(f.value) : undefined} defaultValue={f.type !== "checkbox" ? String(f.value ?? "") : undefined} required={f.required} className={f.type === "checkbox" ? "h-5 w-5" : inputStyle} />}</label>)}</div><Failure error={error} />{saved && <p role="status" className="text-sm text-green-700">Tersimpan di server.</p>}<button disabled={pending} className={buttonStyle}>{pending ? "Menyimpan…" : button}</button></form>;
}
export function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
    return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[90dvh] w-[min(95vw,640px)] overflow-auto rounded-3xl p-6 backdrop:bg-black/40"><div className="mb-4 flex justify-between gap-4"><h2 className="font-poppins text-lg font-semibold">{title}</h2><button type="button" onClick={close} aria-label="Tutup dialog" className="rounded-lg border px-3 py-1">×</button></div>{children}</dialog>;
}
