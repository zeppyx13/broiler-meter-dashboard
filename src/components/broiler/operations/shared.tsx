"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { readData, writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { useBroiler } from "../broiler-provider";

export const controlClass = "w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2.5 text-sm text-[#2F2F2F] outline-none focus:border-[#7B1113] disabled:opacity-50";
export const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#7B1113] px-4 py-2.5 text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45";
export const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-[#EAEAEA] px-3 py-2 text-sm font-medium text-[#555] hover:bg-[#FAFAFA] disabled:opacity-45";

export type UserRow = { id: number; name: string; email?: string; phone?: string | null; role: string };
export type FarmRow = { id: number; name: string; location_text?: string | null; timezone?: string; member_role?: string; owner_user_id?: number; electricity_rate_idr_per_kwh?: number; water_rate_idr_per_m3?: number; is_active?: boolean | number };
export type DeviceRow = { id: number; name: string; device_uid: string; mqtt_topic_key?: string; device_type: string; firmware_version?: string | null; is_active: boolean | number; connectivity_status?: string; last_seen_at?: string | null; stale_after_seconds?: number };
export type MeterRow = { id: number; device_id: number; meter_uid: string; type: "water" | "electricity"; channel: string; unit: "liter" | "kwh"; is_active: boolean | number; installed_at?: string | null };
export type RelayRow = { id: number; device_id: number; channel: number; name: string; purpose?: string; is_enabled: boolean | number; desired_state?: string | null; reported_state?: string | null; reported_status?: string; last_reported_at?: string | null; physical_state_confirmed?: boolean; device_acknowledged?: boolean };
export type CommandRow = { id: number; command: string; status: string; requested_at?: string; published_at?: string; failure_reason?: string | null; timeout_at?: string | null; pending?: boolean; device_acknowledged?: boolean; physical_state_confirmed?: boolean };

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return <section className="space-y-4 rounded-3xl border border-[#EAEAEA] bg-white p-5 sm:p-6"><div><h2 className="font-poppins text-lg font-semibold text-[#2F2F2F]">{title}</h2>{description && <p className="mt-1 text-sm leading-relaxed text-[#777]">{description}</p>}</div>{children}</section>;
}

export function InputField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return <label className="block space-y-1.5 text-sm font-medium text-[#555]"><span>{label}</span>{children}{hint && <span className="block text-xs font-normal leading-relaxed text-[#888]">{hint}</span>}</label>;
}

export function StatusMessage({ error, success }: { error?: string | null; success?: string | null }) {
    if (error) return <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>;
    if (success) return <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{success}</p>;
    return null;
}

export function DataState({ loading, error, empty, children }: { loading: boolean; error: unknown; empty?: boolean; children: ReactNode }) {
    if (loading) return <p role="status" className="flex items-center gap-2 py-4 text-sm text-[#777]"><LoaderCircle size={16} className="animate-spin" />Memuat data server…</p>;
    if (error) return <StatusMessage error={apiErrorMessage(error, "Data server belum tersedia. Coba muat ulang.")} />;
    if (empty) return <p className="rounded-2xl border border-dashed border-[#DDD] p-5 text-sm text-[#888]">Belum ada data pada cakupan ini.</p>;
    return <>{children}</>;
}

export function useScopedQuery<T>(name: string, path: string, params?: Record<string, string | number | boolean | undefined>, enabled = true, interval?: number) {
    const context = useBroiler();
    return useQuery({
        queryKey: ["broiler", context.user?.id, context.farmId, context.coopId, context.source, name, path, params],
        queryFn: ({ signal }) => readData<T>(path, params, { signal }),
        enabled: Boolean(context.user && enabled),
        retry: false,
        refetchInterval: interval,
    });
}

export function useAction() {
    const inFlight = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const context = useBroiler();
    async function run(action: () => Promise<unknown>, message = "Perubahan tersimpan di server.") {
        if (inFlight.current) return false;
        inFlight.current = true;
        setBusy(true); setError(null); setSuccess(null);
        try {
            await action();
            await context.refresh();
            setSuccess(message);
            return true;
        } catch (err) {
            setError(apiErrorMessage(err));
            // A failed/ambiguous mutation response may still have created an audit record.
            // Recover server state without ever replaying the mutation.
            await context.refresh().catch(() => {});
            return false;
        } finally { inFlight.current = false; setBusy(false); }
    }
    return { busy, error, success, run, setError };
}

export function formObject(event: FormEvent<HTMLFormElement>): FormData {
    event.preventDefault();
    return new FormData(event.currentTarget);
}

export function str(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
export function num(form: FormData, name: string) { return Number(str(form, name)); }
export function yes(value: boolean | number | undefined) { return value === true || Number(value) === 1; }
export function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) : "Belum tersedia"; }
export function scalar(value: unknown, digits = 2) { return value == null || value === "" || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("id-ID", { maximumFractionDigits: digits }); }
export function saveData(method: "post" | "put" | "patch" | "delete", path: string, body?: unknown) { return writeData(method, path, body); }
