"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { BellRing, ShieldAlert } from "lucide-react";
import { DEFAULT_GUARD_SETTINGS, getGuardSettings, setGuardSettings, type GuardSettings } from "@/lib/guard-settings";
import { notificationSupported, playAlertSound, showAlertNotification } from "@/lib/alert-notify";

type NumberKey = Exclude<keyof GuardSettings, "notifyBrowser" | "notifySound">;

const GROUPS: { title: string; fields: { key: NumberKey; label: string; suffix: string }[] }[] = [
    {
        title: "Air minum di bawah pola normal",
        fields: [
            { key: "waterWarnPct", label: "Waspada", suffix: "%" },
            { key: "waterCritPct", label: "Kritis", suffix: "%" },
        ],
    },
    { title: "Air di atas pola (indikasi bocor)", fields: [{ key: "waterLeakPct", label: "Waspada", suffix: "%" }] },
    {
        title: "Daya di bawah daya seharusnya",
        fields: [
            { key: "powerWarnPct", label: "Waspada", suffix: "%" },
            { key: "powerCritPct", label: "Kritis", suffix: "%" },
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

function validate(s: GuardSettings): string | null {
    const numbers = GROUPS.flatMap((g) => g.fields.map((f) => s[f.key]));
    if (numbers.some((n) => !Number.isFinite(n) || n <= 0)) return "Semua angka harus lebih dari 0.";
    if (s.waterWarnPct >= s.waterCritPct) return "Ambang kritis air harus lebih besar dari ambang waspada.";
    if (s.powerWarnPct >= s.powerCritPct) return "Ambang kritis daya harus lebih besar dari ambang waspada.";
    if (s.voltageMin >= s.voltageMax) return "Tegangan minimum harus lebih kecil dari maksimum.";
    return null;
}

export default function GuardSettingsCard() {
    const [form, setForm] = useState<GuardSettings>(getGuardSettings);
    const [saved, setSaved] = useState<GuardSettings>(getGuardSettings);
    const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => notificationSupported() ? Notification.permission : "unsupported");


    const dirty = JSON.stringify(form) !== JSON.stringify(saved);
    const error = validate(form);

    function persist(next: GuardSettings) {
        setGuardSettings(next);
        setSaved(next);
        setForm(next);
    }

    async function handleEnableNotifications() {
        if (!notificationSupported()) return;
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === "granted") persist({ ...saved, notifyBrowser: true });
    }

    function handleTest() {
        showAlertNotification({
            key: "test", roomId: 0, tier: "kritis", roomNumber: "Contoh",
            title: "Ini notifikasi uji", action: "Notifikasi Guard sudah berfungsi",
        });
        if (form.notifySound) playAlertSound();
    }

    function handleSave() {
        if (error) return;
        persist(form);
        Swal.fire({ icon: "success", title: "Pengaturan Guard tersimpan", timer: 1300, showConfirmButton: false });
    }

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <ShieldAlert size={20} className="text-[#7B1113]" />
                </div>
                <div>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Guard & Notifikasi</h3>
                    <p className="mt-1 font-inter text-sm text-[#666]">Kapan peringatan muncul, dan bagaimana Anda diberi tahu.</p>
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
                                            onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                                            suppressHydrationWarning
                                            className="w-full bg-transparent font-poppins text-sm font-semibold text-[#2F2F2F] outline-none"
                                        />
                                        <span className="shrink-0 text-[#999]">{f.suffix}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {error && <p className="mt-4 font-inter text-sm text-[#B42318]">{error}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                    onClick={() => setForm({ ...DEFAULT_GUARD_SETTINGS, notifyBrowser: form.notifyBrowser, notifySound: form.notifySound })}
                    suppressHydrationWarning
                    className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                >
                    Kembalikan default
                </button>
                <button
                    onClick={handleSave}
                    disabled={!dirty || Boolean(error)}
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
