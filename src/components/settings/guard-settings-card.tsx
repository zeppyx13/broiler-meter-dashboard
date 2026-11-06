"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { BellRing, ShieldAlert } from "lucide-react";
import { getGuardSettings, setGuardSettings, type GuardSettings } from "@/lib/guard-settings";
import { notificationSupported, playAlertSound, showAlertNotification } from "@/lib/alert-notify";
import { allPages, writeData } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { apiErrorMessage } from "@/lib/api-error";

type NumberKey = "waterMax" | "waterRecovery" | "noFlowMax" | "powerMin" | "powerRecovery" | "offlineMinutes" | "voltageMin" | "voltageMax";
type ActiveKey = "waterEnabled" | "powerEnabled" | "offlineEnabled" | "voltageEnabled" | "noFlowEnabled";
type RuleForm = Record<NumberKey, string> & Record<ActiveKey, boolean> & Pick<GuardSettings, "notifyBrowser" | "notifySound"> & { expectedFlowUntil: string; contextNote: string };
const ACTIVE_FIELDS: Record<string, ActiveKey> = { suspected_water_anomaly: "waterEnabled", no_water_flow: "noFlowEnabled", suspected_power_anomaly: "powerEnabled", device_offline: "offlineEnabled", voltage_abnormal: "voltageEnabled" };
const ACTIVE_GROUPS: Record<string, ActiveKey> = { waterMax: "waterEnabled", powerMin: "powerEnabled", offlineMinutes: "offlineEnabled", voltageMin: "voltageEnabled" };
type Rule = { id: number; rule_code: string; severity: string; is_active: boolean; parameters_json: Record<string, unknown> };
const emptyForm = (): RuleForm => ({ waterMax: "", waterRecovery: "", noFlowMax: "", powerMin: "", powerRecovery: "", offlineMinutes: "", voltageMin: "", voltageMax: "", notifyBrowser: false, notifySound: true, waterEnabled: false, powerEnabled: false, offlineEnabled: false, voltageEnabled: false, noFlowEnabled: false, expectedFlowUntil: "", contextNote: "" });

const GROUPS: { title: string; fields: { key: NumberKey; label: string; suffix: string }[] }[] = [
    {
        title: "Aliran inlet tandon di atas ambang",
        fields: [
            { key: "waterMax", label: "Ambang atas", suffix: "L/mnt" },
            { key: "waterRecovery", label: "Pemulihan", suffix: "L/mnt" },
        ],
    },
    { title: "Aliran inlet minimum (perlu konteks pengisian)", fields: [{ key: "noFlowMax", label: "Ambang", suffix: "L/mnt" }] },
    {
        title: "Daya panel di bawah ambang",
        fields: [
            { key: "powerMin", label: "Ambang bawah", suffix: "W" },
            { key: "powerRecovery", label: "Pemulihan", suffix: "W" },
        ],
    },
    { title: "Perangkat dianggap offline setelah", fields: [{ key: "offlineMinutes", label: "Tanpa data", suffix: "menit" }] },
    {
        title: "Tegangan listrik normal",
        fields: [
            { key: "voltageMin", label: "Minimum", suffix: "V" },
            { key: "voltageMax", label: "Maksimum", suffix: "V" },
        ],
    },
];

function validate(s: RuleForm): string | null {
    const numbers = GROUPS.flatMap((g) => g.fields.map((f) => s[f.key])).filter((v) => v !== "");
    if (numbers.some((n) => !Number.isFinite(Number(n)) || Number(n) < 0)) return "Nilai ambang harus berupa angka minimal 0.";
    for (const [first, second] of [["waterMax", "waterRecovery"], ["powerMin", "powerRecovery"], ["voltageMin", "voltageMax"]] as const) {
        if (Boolean(s[first]) !== Boolean(s[second])) return "Lengkapi pasangan ambang dan pemulihannya; kosong berarti aturan belum dikonfigurasi.";
    }
    if (s.waterMax && !(Number(s.waterMax) > Number(s.waterRecovery))) return "Debit pemulihan harus lebih kecil dari ambang atas.";
    if (s.powerMin && !(Number(s.powerRecovery) > Number(s.powerMin) && Number(s.powerMin) > 0)) return "Daya pemulihan harus lebih besar dari ambang bawah yang positif.";
    if (s.offlineMinutes && (Number(s.offlineMinutes) < 0.5 || Number(s.offlineMinutes) > 1440 || !Number.isInteger(Number(s.offlineMinutes) * 60))) return "Ambang offline harus 0,5–1440 menit dalam detik bulat.";
    if (s.voltageMin && !(Number(s.voltageMin) > 0 && Number(s.voltageMin) < Number(s.voltageMax))) return "Tegangan minimum harus positif dan lebih kecil dari maksimum.";
    if ((s.waterEnabled && !s.waterMax) || (s.powerEnabled && !s.powerMin) || (s.offlineEnabled && !s.offlineMinutes) || (s.voltageEnabled && !s.voltageMin)) return "Aktivasi aturan memerlukan parameter ambang yang lengkap.";
    if ((s.noFlowEnabled || s.contextNote || s.expectedFlowUntil) && s.noFlowMax === "") return "Isi ambang no-flow sebelum mengatur konteks pengisian.";
    if (s.noFlowEnabled && (!s.noFlowMax || s.contextNote.trim().length < 8 || !Number.isFinite(Date.parse(s.expectedFlowUntil)) || Date.parse(s.expectedFlowUntil) <= Date.now() || Date.parse(s.expectedFlowUntil) > Date.now() + 86400000)) return "Aktivasi no-flow memerlukan ambang, alasan minimal 8 karakter, dan expiry dalam 24 jam ke depan.";
    return null;
}

export default function GuardSettingsCard() {
    const b = useBroiler();
    const [form, setForm] = useState<RuleForm>(emptyForm);
    const [saved, setSaved] = useState<RuleForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const scope = useRef({ userId: b.user?.id, coopId: b.coopId });
    scope.current = { userId: b.user?.id, coopId: b.coopId };
    const loadedScope = useRef("");
    const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
    const rules = useQuery({ queryKey: ["broiler", b.user?.id, b.coopId, "guard-settings"], queryFn: ({ signal }) => allPages<Rule>("/api/alert-rules", "rules", { coop_id: b.coopId }, { signal }), enabled: Boolean(b.user && b.coopId), retry: false });
    const ruleFor = (code: string) => rules.data?.find((rule) => rule.rule_code === code && rule.severity === "warning" && !rule.parameters_json.device_id) ?? rules.data?.find((rule) => rule.rule_code === code && !rule.parameters_json.device_id);

    useEffect(() => {
        const identity = `${b.user?.id}:${b.coopId}`;
        if (loadedScope.current === identity && JSON.stringify(form) !== JSON.stringify(saved)) return;
        loadedScope.current = identity;
        const preference = getGuardSettings();
        const next = emptyForm();
        next.notifyBrowser = preference.notifyBrowser; next.notifySound = preference.notifySound;
        const parameters = (code: string) => rules.data?.find((rule) => rule.rule_code === code && rule.severity === "warning" && !rule.parameters_json.device_id)?.parameters_json ?? rules.data?.find((rule) => rule.rule_code === code && !rule.parameters_json.device_id)?.parameters_json ?? {};
        const value = (code: string, key: string) => parameters(code)[key] == null ? "" : String(parameters(code)[key]);
        next.waterMax = value("suspected_water_anomaly", "max_flow_lpm"); next.waterRecovery = value("suspected_water_anomaly", "recovery_flow_lpm");
        next.noFlowMax = value("no_water_flow", "max_flow_lpm"); next.powerMin = value("suspected_power_anomaly", "min_power_w"); next.powerRecovery = value("suspected_power_anomaly", "recovery_power_w");
        const noFlow = rules.data?.find((rule) => rule.rule_code === "no_water_flow" && rule.severity === "warning" && !rule.parameters_json.device_id) ?? rules.data?.find((rule) => rule.rule_code === "no_water_flow" && !rule.parameters_json.device_id);
        next.noFlowEnabled = noFlow?.is_active === true && noFlow.parameters_json.expected_flow === true;
        const expires = new Date(String(noFlow?.parameters_json.expected_flow_until ?? ""));
        next.expectedFlowUntil = Number.isFinite(expires.getTime()) ? new Date(expires.getTime() - expires.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
        next.contextNote = String(noFlow?.parameters_json.context_note ?? "");
        const offline = parameters("device_offline").stale_after_seconds; next.offlineMinutes = offline == null ? "" : String(Number(offline) / 60);
        next.voltageMin = value("voltage_abnormal", "min_voltage_v"); next.voltageMax = value("voltage_abnormal", "max_voltage_v");
        for (const [code, key] of Object.entries(ACTIVE_FIELDS)) next[key] = (rules.data?.find((rule) => rule.rule_code === code && rule.severity === "warning" && !rule.parameters_json.device_id) ?? rules.data?.find((rule) => rule.rule_code === code && !rule.parameters_json.device_id))?.is_active === true;
        setForm(next); setSaved(next);
        setPermission(notificationSupported() ? Notification.permission : "unsupported");
    }, [rules.data, b.coopId, b.user?.id]);

    const dirty = JSON.stringify(form) !== JSON.stringify(saved);
    const error = validate(form);

    function persist(next: RuleForm) {
        setGuardSettings({ ...getGuardSettings(), notifyBrowser: next.notifyBrowser, notifySound: next.notifySound });
        setSaved(next);
        setForm(next);
    }

    async function handleEnableNotifications() {
        if (!notificationSupported()) return;
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === "granted") {
            setGuardSettings({ ...getGuardSettings(), notifyBrowser: true });
            setForm((current) => ({ ...current, notifyBrowser: true }));
            setSaved((current) => ({ ...current, notifyBrowser: true }));
        }
    }

    function handleTest() {
        showAlertNotification({
            key: "test", roomId: 0, tier: "kritis", roomNumber: "Contoh",
            title: "Pratinjau notifikasi browser", action: "Contoh tampilan; bukan bukti pengiriman alert atau kondisi perangkat.",
        });
        if (form.notifySound) playAlertSound();
    }

    async function handleSave() {
        if (error || inFlight.current) return;
        inFlight.current = true;
        setSaving(true);
        try {
            const saveRule = async (code: string, fields: (keyof RuleForm)[], parameters: Record<string, unknown>) => {
                fields = [...fields, ACTIVE_FIELDS[code]];
                if (fields.every((key) => form[key] === saved[key])) return;
                if (scope.current.userId !== b.user?.id || scope.current.coopId !== b.coopId) throw new Error("Sesi atau kandang berubah; periksa ulang perubahan pada cakupan yang dipilih.");
                if (!b.coopId || !b.canManage) throw new Error("Perubahan aturan memerlukan hak Manage pada kandang terpilih.");
                if (fields.some((key) => key !== "expectedFlowUntil" && key !== "contextNote" && typeof form[key] === "string" && form[key] === "")) throw new Error("Ambang kosong tidak menghapus aturan; masukkan parameter yang sah.");
                const existing = ruleFor(code);
                const body = { parameters_json: { ...existing?.parameters_json, ...parameters }, is_active: form[ACTIVE_FIELDS[code]] };
                if (existing) await writeData("patch", `/api/alert-rules/${existing.id}`, body);
                else await writeData("post", "/api/alert-rules", { coop_id: b.coopId, rule_code: code, name: `${code} · ${b.coop?.code ?? b.coopId}`, severity: "warning", evaluation_window_sec: code === "no_water_flow" ? 300 : 60, cooldown_sec: 900, ...body });
            };
            await saveRule("suspected_water_anomaly", ["waterMax", "waterRecovery"], { max_flow_lpm: Number(form.waterMax), recovery_flow_lpm: Number(form.waterRecovery) });
            const noFlow = ruleFor("no_water_flow");
            await saveRule("no_water_flow", ["noFlowMax", "noFlowEnabled", "expectedFlowUntil", "contextNote"], { max_flow_lpm: Number(form.noFlowMax), recovery_flow_lpm: Math.max(Number(noFlow?.parameters_json.recovery_flow_lpm ?? 0.5), Number(form.noFlowMax) + 0.1), expected_flow: form.noFlowEnabled, ...(form.expectedFlowUntil ? { expected_flow_until: new Date(form.expectedFlowUntil).toISOString() } : {}), ...(form.contextNote.trim() ? { context_note: form.contextNote.trim() } : {}) });
            await saveRule("suspected_power_anomaly", ["powerMin", "powerRecovery"], { min_power_w: Number(form.powerMin), recovery_power_w: Number(form.powerRecovery) });
            await saveRule("device_offline", ["offlineMinutes"], { stale_after_seconds: Number(form.offlineMinutes) * 60 });
            const min = Number(form.voltageMin), max = Number(form.voltageMax), band = max - min;
            const voltage = ruleFor("voltage_abnormal")?.parameters_json;
            const recoveryMin = Number(voltage?.recovery_min_voltage_v), recoveryMax = Number(voltage?.recovery_max_voltage_v);
            const validRecovery = min < recoveryMin && recoveryMin < recoveryMax && recoveryMax < max;
            await saveRule("voltage_abnormal", ["voltageMin", "voltageMax"], { min_voltage_v: min, max_voltage_v: max, recovery_min_voltage_v: validRecovery ? recoveryMin : min + band * 0.2, recovery_max_voltage_v: validRecovery ? recoveryMax : max - band * 0.2 });
            persist(form);
            await b.refresh();
            await Swal.fire({ icon: "success", title: "Pengaturan tersimpan", text: "Aturan tersimpan di server; preferensi bunyi/browser hanya di browser ini. Aktivasi no-flow mengikuti konfirmasi konteks dan expiry yang Anda isi.", confirmButtonColor: "#7B1113" });
        } catch (err) {
            await b.refresh();
            await Swal.fire({ icon: "error", title: "Pengaturan belum lengkap", text: `${apiErrorMessage(err)} Sebagian perubahan sebelumnya mungkin sudah tersimpan; nilai server dimuat ulang.`, confirmButtonColor: "#7B1113" });
        } finally { inFlight.current = false; setSaving(false); }
    }

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <ShieldAlert size={20} className="text-[#7B1113]" />
                </div>
                <div>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Guard & Notifikasi</h3>
                    <p className="mt-1 font-inter text-sm text-[#666]">Aturan backend untuk kandang terpilih; nilai kosong belum dikonfigurasi. Air adalah inlet tandon, daya adalah panel agregat.</p>
                </div>
            </div>

            {/* Notifikasi */}
            <div className="mt-6 space-y-3 rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                        <BellRing size={18} className="mt-0.5 text-[#7B1113]" />
                        <div>
                            <p className="font-inter text-sm font-medium text-[#2F2F2F]">Notifikasi browser</p>
                            <p className="font-inter text-xs text-[#999]">
                                {permission === "unsupported" && "Browser ini tidak mendukung notifikasi."}
                                {permission === "denied" && "Diblokir browser. Izinkan notifikasi untuk situs ini di pengaturan browser."}
                                {permission === "default" && "Muncul di layar untuk peringatan waspada & kritis baru selama dashboard terbuka."}
                                {permission === "granted" && "Muncul di layar untuk peringatan waspada & kritis baru selama dashboard terbuka."}
                            </p>
                        </div>
                    </div>
                    {permission === "default" && (
                        <button onClick={handleEnableNotifications} suppressHydrationWarning className="rounded-2xl bg-[#7B1113] px-4 py-2 font-inter text-sm font-medium text-[#C6A971] transition hover:opacity-90">
                            Izinkan
                        </button>
                    )}
                    {permission === "granted" && (
                        <Toggle checked={form.notifyBrowser} onChange={(v) => setForm({ ...form, notifyBrowser: v })} label="Notifikasi browser" />
                    )}
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className="pl-6">
                        <p className="font-inter text-sm font-medium text-[#2F2F2F]">Bunyi untuk peringatan kritis</p>
                        <p className="font-inter text-xs text-[#999]">Tiga bunyi pendek saat ada peringatan kritis baru.</p>
                    </div>
                    <Toggle checked={form.notifySound} onChange={(v) => setForm({ ...form, notifySound: v })} label="Bunyi" />
                </div>
                <button onClick={handleTest} suppressHydrationWarning className="ml-6 font-inter text-sm font-semibold text-[#7B1113] hover:underline">
                    Tes notifikasi
                </button>
            </div>

            {/* Ambang */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {GROUPS.map((group) => (
                    <div key={group.title} className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                        <p className="font-inter text-sm font-medium text-[#2F2F2F]">{group.title}</p>
                        {ACTIVE_GROUPS[group.fields[0].key] && <label className="mt-2 flex items-center gap-2 font-inter text-xs text-[#777]"><input type="checkbox" checked={form[ACTIVE_GROUPS[group.fields[0].key]]} disabled={!b.canManage || rules.isPending || rules.isError || saving} onChange={(event) => setForm({ ...form, [ACTIVE_GROUPS[group.fields[0].key]]: event.target.checked })} />Aturan aktif</label>}
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            {group.fields.map((f) => (
                                <label key={f.key} className="font-inter text-xs text-[#999]">
                                    {f.label}
                                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 focus-within:border-[#7B1113]">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="any"
                                            value={form[f.key]}
                                            disabled={!b.canManage || rules.isPending || rules.isError || saving}
                                            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                            suppressHydrationWarning
                                            className="w-full bg-transparent font-poppins text-sm font-semibold text-[#2F2F2F] outline-none"
                                        />
                                        <span className="shrink-0 text-[#999]">{f.suffix}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {group.fields.some((field) => field.key === "noFlowMax") && <details className="mt-3 font-inter text-xs text-[#777]"><summary className="cursor-pointer font-medium text-[#7B1113]">Konteks dan aktivasi no-flow</summary><fieldset disabled={!b.canManage || rules.isPending || rules.isError || saving} className="mt-3 space-y-3"><label className="flex items-center gap-2"><input type="checkbox" checked={form.noFlowEnabled} onChange={(event) => setForm({ ...form, noFlowEnabled: event.target.checked })} />Aliran inlet memang diharapkan; aktifkan aturan</label><label className="block">Berlaku sampai (waktu browser, maksimal 24 jam)<input type="datetime-local" value={form.expectedFlowUntil} onChange={(event) => setForm({ ...form, expectedFlowUntil: event.target.value })} className="mt-1 w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 outline-none focus:border-[#7B1113]" /></label><label className="block">Alasan pengisian (minimal 8 karakter)<input value={form.contextNote} maxLength={255} onChange={(event) => setForm({ ...form, contextNote: event.target.value })} className="mt-1 w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 outline-none focus:border-[#7B1113]" /></label></fieldset></details>}
                    </div>
                ))}
            </div>

            {error && <p className="mt-4 font-inter text-sm text-[#B42318]">{error}</p>}
            {rules.error && <p className="mt-4 font-inter text-sm text-[#B42318]">{apiErrorMessage(rules.error)}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                    onClick={() => setForm({ ...saved, notifyBrowser: form.notifyBrowser, notifySound: form.notifySound })}
                    suppressHydrationWarning
                    className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                >
                    Kembalikan default
                </button>
                <button
                    onClick={handleSave}
                    disabled={!dirty || Boolean(error) || saving || Boolean(b.coopId && (rules.isPending || rules.isError))}
                    suppressHydrationWarning
                    className="rounded-2xl bg-[#7B1113] px-6 py-2.5 font-inter text-sm font-medium text-[#C6A971] transition hover:opacity-90 disabled:opacity-40"
                >
                    Simpan
                </button>
            </div>
        </div>
    );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            suppressHydrationWarning
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#7B1113]" : "bg-[#D9D9D9]"}`}
        >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
        </button>
    );
}
