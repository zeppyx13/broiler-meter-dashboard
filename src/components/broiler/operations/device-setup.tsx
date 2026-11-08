"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Cpu, Plus } from "lucide-react";
import Swal from "sweetalert2";
import { allPages, readData, writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { getToken } from "@/lib/auth";
import { useBroiler } from "../broiler-provider";
import { Card, DataState, InputField, StatusMessage, buttonClass, controlClass, dateTime, formObject, saveData, secondaryClass, str, useAction, useScopedQuery, yes, type DeviceRow, type MeterRow, type RelayRow } from "./shared";

type RegistryDevice = DeviceRow & { coop_id?: number; data_provenance?: string };
const identityPattern = "[A-Za-z0-9][A-Za-z0-9._:\\-]*";

export function DeviceRegistry({ onNavigate }: { onNavigate: (tab: string) => void }) {
    const context = useBroiler();
    const [page, setPage] = useState(1);
    const [setup, setSetup] = useState<RegistryDevice | "new" | null>(null);
    const devices = useScopedQuery<{ devices: RegistryDevice[] }>("devices-register", "/api/devices", { coop_id: context.coopId, page, limit: 20 });
    const rows = devices.data?.devices.filter(device => device.data_provenance !== "simulation") ?? [];
    return <div className="space-y-5"><Card title="Kelola Alat" description="Tambah ESP32, hubungkan sensor air dan listrik, lalu atur satu relay opsional dari tempat yang sama.">
        {context.canAdminIot ? <button className={buttonClass} onClick={() => setSetup("new")} disabled={setup !== null}><Plus size={16} />Tambah Alat</button> : <p className="text-sm text-[#888]">Pengelolaan alat tersedia bagi Admin dan Owner farm.</p>}
        <DataState loading={devices.isLoading} error={devices.error} empty={rows.length === 0}><div className="space-y-4">{rows.map(device => <DeviceCard key={`${device.id}:${device.name}:${device.is_active}`} device={device} onSetup={() => setSetup(device)} />)}</div></DataState>
        <nav aria-label="Halaman alat" className="flex items-center justify-between gap-2 pt-3 text-xs text-[#888]"><span>Halaman {page}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className={secondaryClass}>Sebelumnya</button><button disabled={(devices.data?.devices.length ?? 0) < 20} onClick={() => setPage(page + 1)} className={secondaryClass}>Berikutnya</button></div></nav>
    </Card>{setup && <DeviceSetup key={setup === "new" ? "new" : setup.id} device={setup === "new" ? undefined : setup} onClose={() => setSetup(null)} onNavigate={onNavigate} />}</div>;
}

function DeviceCard({ device, onSetup }: { device: RegistryDevice; onSetup: () => void }) {
    const context = useBroiler();
    const action = useAction();
    const confirming = useRef(false);
    const dialogVisible = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (dialogVisible.current) Swal.close(); }; }, []);
    const meters = useScopedQuery<{ meters: MeterRow[] }>(`device-meters-${device.id}`, "/api/meters", { device_id: device.id, limit: 100 });
    const relays = useScopedQuery<{ relays: RelayRow[] }>(`device-relays-${device.id}`, "/api/relays", { device_id: device.id, limit: 100 });
    const outputs = relays.data?.relays.filter(relay => relay.channel === 1) ?? [];
    async function submit(event: FormEvent<HTMLFormElement>) {
        const form = formObject(event);
        await action.run(() => saveData("patch", `/api/devices/${device.id}`, { name: str(form, "name"), firmware_version: str(form, "firmware_version") || null, is_active: yes(device.is_active) || form.get("active") === "on" }));
    }
    async function disable() {
        if (action.busy || confirming.current) return;
        const sessionToken = getToken();
        if (!sessionToken) return;
        confirming.current = true;
        try {
            dialogVisible.current = true;
            const answer = await Swal.fire({ title: "Nonaktifkan alat?", text: `${device.name} · ${context.coop?.name}. Monitoring dan kontrol relay alat ini dihentikan; histori tetap tersimpan.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, Nonaktifkan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
            dialogVisible.current = false;
            if (answer.isConfirmed && mounted.current && getToken() === sessionToken) await action.run(() => saveData("delete", `/api/devices/${device.id}`), "Alat dinonaktifkan. Histori tetap tersimpan.");
        } finally { confirming.current = false; dialogVisible.current = false; }
    }
    return <article className="rounded-2xl border border-[#EAEAEA] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="flex items-center gap-2 font-semibold"><Cpu size={16} />{device.name}</p><p className="mt-1 text-xs text-[#777]">{context.coop?.name} · {device.device_type.toUpperCase()} · {device.connectivity_status ?? "unknown"}</p><p className="mt-1 text-xs text-[#888]">Receipt terakhir: {dateTime(device.last_seen_at)}</p></div><span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-xs">{yes(device.is_active) ? "Terdaftar aktif" : "Nonaktif · histori tetap"}</span></div>
        <DataState loading={meters.isLoading || relays.isLoading} error={meters.error || relays.error}><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">{[["water", "Air inlet · YF-S201"], ["electricity", "Panel listrik · PZEM-004T"]].map(([type, label]) => <div className="rounded-xl bg-[#FAFAFA] p-3" key={type}><p className="font-semibold">{label}</p><p className="mt-1 break-all text-[#777]">{meters.data?.meters.filter(meter => meter.type === type).map(meter => `${meter.meter_uid} (${yes(meter.is_active) ? "aktif" : "nonaktif"})`).join(", ") || "Belum dipasangkan"}</p></div>)}<div className="rounded-xl bg-[#FAFAFA] p-3"><p className="font-semibold">Relay opsional · kanal 1</p><p className="mt-1 text-[#777]">{outputs.map(relay => `${relay.name} (${yes(relay.is_enabled) ? "enabled" : "disabled"})`).join(", ") || "Belum diatur"}</p></div></div></DataState>
        <details className="mt-3 text-xs text-[#888]"><summary className="cursor-pointer">Identitas pairing dan MQTT</summary><p className="mt-2 break-all">UID: {device.device_uid} · topic key: {device.mqtt_topic_key ?? "—"} · firmware: {device.firmware_version ?? "—"}</p><p className="mt-1">UID, kandang, topic key, tipe/unit/channel meter terkunci untuk menjaga atribusi histori. Untuk penggantian, nonaktifkan alat lama lalu tambahkan identitas perangkat pengganti.</p></details>
        {context.canAdminIot && <div className="mt-3 flex flex-wrap gap-2"><button className={secondaryClass} disabled={!yes(device.is_active) || device.device_type !== "esp32"} onClick={onSetup}>Lengkapi sensor / relay</button><button className={secondaryClass} disabled={action.busy || !yes(device.is_active)} onClick={() => { void disable(); }}>Nonaktifkan</button></div>}
        {context.canAdminIot && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-[#7B1113]">Edit</summary><form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2"><InputField label="Nama perangkat"><input name="name" defaultValue={device.name} required maxLength={120} className={controlClass} /></InputField><InputField label="Versi firmware sesuai perangkat"><input name="firmware_version" defaultValue={device.firmware_version ?? ""} maxLength={60} className={controlClass} /></InputField>{!yes(device.is_active) && <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" />Aktifkan kembali registry (bukan perintah relay)</label>}<button disabled={action.busy} className={buttonClass}>Simpan metadata</button></form><div className="mt-4 space-y-3">{meters.data?.meters.map(meter => <MeterEditor key={`${meter.id}:${meter.is_active}:${meter.installed_at}`} meter={meter} />)}{outputs.map(relay => <RelayEditor key={`${relay.id}:${relay.name}:${relay.is_enabled}`} relay={relay} />)}</div></details>}
        <div className="mt-3"><StatusMessage error={action.error} success={action.success} /></div>
    </article>;
}

function MeterEditor({ meter }: { meter: MeterRow }) {
    const action = useAction();
    const locked = useRef(false);
    const mounted = useRef(true);
    const dialogVisible = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (dialogVisible.current) Swal.close(); }; }, []);
    const installed = meter.installed_at ? new Date(meter.installed_at) : null;
    const localValue = installed && Number.isFinite(installed.getTime()) ? new Date(installed.getTime() - installed.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    async function submit(event: FormEvent<HTMLFormElement>) {
        const form = formObject(event);
        if (locked.current) return;
        const sessionToken = getToken();
        if (!sessionToken) return;
        const active = form.get("active") === "on";
        locked.current = true;
        try {
            if (yes(meter.is_active) && !active) {
                dialogVisible.current = true;
                const answer = await Swal.fire({ title: "Nonaktifkan meter?", text: `${meter.meter_uid}. Pembacaan baru meter dihentikan; histori tetap tersimpan.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, Nonaktifkan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
                dialogVisible.current = false;
                if (!answer.isConfirmed) return;
            }
            if (!mounted.current || getToken() !== sessionToken) return;
            await action.run(() => saveData("patch", `/api/meters/${meter.id}`, { is_active: active, installed_at: str(form, "installed_at") ? new Date(str(form, "installed_at")).toISOString() : null }));
        } finally { locked.current = false; dialogVisible.current = false; }
    }
    return <form onSubmit={submit} className="grid gap-3 rounded-xl bg-[#FAFAFA] p-3 sm:grid-cols-2"><p className="text-xs text-[#777] sm:col-span-2">{meter.meter_uid} · {meter.type} · {meter.channel} · {meter.unit} (identitas terkunci)</p><InputField label="Waktu pemasangan"><input type="datetime-local" name="installed_at" defaultValue={localValue} className={controlClass} /></InputField><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="active" defaultChecked={yes(meter.is_active)} />Meter aktif</label><button disabled={action.busy} className={secondaryClass}>Simpan meter</button><StatusMessage error={action.error} success={action.success} /></form>;
}

function RelayEditor({ relay }: { relay: RelayRow }) {
    const action = useAction();
    const locked = useRef(false);
    const mounted = useRef(true);
    const dialogVisible = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (dialogVisible.current) Swal.close(); }; }, []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        const form = formObject(event);
        if (locked.current) return;
        const sessionToken = getToken();
        if (!sessionToken) return;
        const enabled = form.get("enabled") === "on";
        locked.current = true;
        try {
            if (yes(relay.is_enabled) && !enabled) {
                dialogVisible.current = true;
                const answer = await Swal.fire({ title: "Nonaktifkan mapping relay?", text: `${relay.name}. Kontrol baru diblokir; state fisik tidak diubah dan histori tetap tersimpan.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, Nonaktifkan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
                dialogVisible.current = false;
                if (!answer.isConfirmed) return;
            }
            if (!mounted.current || getToken() !== sessionToken) return;
            await action.run(() => saveData("patch", `/api/relays/${relay.id}`, { name: str(form, "name"), purpose: str(form, "purpose"), is_enabled: enabled }));
        } finally { locked.current = false; dialogVisible.current = false; }
    }
    return <form onSubmit={submit} className="flex flex-wrap items-end gap-2"><InputField label="Nama relay · kanal 1"><input name="name" required maxLength={100} defaultValue={relay.name} className={controlClass} /></InputField><InputField label="Tujuan"><select name="purpose" defaultValue={relay.purpose ?? "other"} className={controlClass}><option value="light">Lampu</option><option value="heater">Pemanas</option><option value="other">Lainnya</option></select></InputField><label className="py-3 text-xs"><input name="enabled" type="checkbox" defaultChecked={yes(relay.is_enabled)} />Enabled</label><button className={secondaryClass} disabled={action.busy}>Simpan relay</button><p className="w-full text-xs text-[#888]">Menyimpan mapping tidak mengirim ON/OFF.</p><StatusMessage error={action.error} success={action.success} /></form>;
}

type SetupProps = { device?: RegistryDevice; onClose: () => void; onNavigate: (tab: string) => void };
function DeviceSetup({ device: initialDevice, onClose, onNavigate }: SetupProps) {
    const context = useBroiler();
    const [step, setStep] = useState(initialDevice ? 2 : 1);
    const [device, setDevice] = useState(initialDevice);
    const [coopId, setCoopId] = useState(initialDevice?.coop_id ?? context.coopId);
    const [deviceName, setDeviceName] = useState(initialDevice?.name ?? "");
    const [uid, setUid] = useState(initialDevice?.device_uid ?? "");
    const [topic, setTopic] = useState(initialDevice?.mqtt_topic_key ?? "");
    const [firmware, setFirmware] = useState(initialDevice?.firmware_version ?? "");
    const [waterUid, setWaterUid] = useState("");
    const [electricUid, setElectricUid] = useState("");
    const [meters, setMeters] = useState<MeterRow[]>([]);
    const [relay, setRelay] = useState<RelayRow>();
    const [relayWanted, setRelayWanted] = useState(false);
    const [relayName, setRelayName] = useState("");
    const [relayPurpose, setRelayPurpose] = useState("other");
    const [relayEnabled, setRelayEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(Boolean(initialDevice));
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [recoveryRequired, setRecoveryRequired] = useState(false);
    const lock = useRef(false);
    const mounted = useRef(true);
    const sessionToken = useRef(getToken());
    const currentSession = () => mounted.current && getToken() === sessionToken.current;
    const coop = context.coops.find(row => row.id === coopId);
    const targetFarm = context.farms.find(farm => farm.id === coop?.farm_id);
    const allowed = Boolean(context.user && coop && targetFarm?.capabilities?.["device:manage"] === true);
    const selectedWater = meters.find(meter => meter.type === "water");
    const selectedElectric = meters.find(meter => meter.type === "electricity");

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    async function recover(target: RegistryDevice | undefined = device) {
        if (!currentSession()) return undefined;
        let current = target;
        if (!current) {
            const rows = await allPages<RegistryDevice>("/api/devices", "devices", { coop_id: coopId });
            current = rows.find(row => row.device_uid === uid.trim());
            if (current && (current.mqtt_topic_key !== topic.trim() || current.coop_id !== coopId || current.device_type !== "esp32" || current.data_provenance === "simulation")) throw new Error("UID sudah terdaftar dengan pairing berbeda. Gunakan kartu alat yang benar atau identitas perangkat pengganti.");
        }
        if (!current || !currentSession()) return undefined;
        const latestDevice = await readData<{ device: RegistryDevice }>(`/api/devices/${current.id}`);
        const [savedMeters, savedRelays] = await Promise.all([allPages<MeterRow>("/api/meters", "meters", { device_id: current.id }), allPages<RelayRow>("/api/relays", "relays", { device_id: current.id })]);
        if (currentSession()) {
            const output = savedRelays.find(row => row.channel === 1);
            setDevice(latestDevice.device); setMeters(savedMeters); setRelay(output);
            const water = savedMeters.find(row => row.type === "water");
            const electric = savedMeters.find(row => row.type === "electricity");
            if (water) setWaterUid(water.meter_uid);
            if (electric) setElectricUid(electric.meter_uid);
            if (output) { setRelayWanted(true); setRelayName(output.name); setRelayPurpose(output.purpose ?? "other"); setRelayEnabled(yes(output.is_enabled)); }
        }
        return { device: latestDevice.device, meters: savedMeters, relay: savedRelays.find(row => row.channel === 1) };
    }
    useEffect(() => {
        if (!initialDevice) return;
        void recover(initialDevice).catch(err => { if (currentSession()) { setError(apiErrorMessage(err)); setRecoveryRequired(true); } }).finally(() => { if (currentSession()) setLoading(false); });
        // The setup is keyed by device and remounted when the active coop changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialDevice]);
    async function perform(operation: () => Promise<void>) {
        if (lock.current || !currentSession() || !allowed || recoveryRequired) return;
        lock.current = true; setBusy(true); setError(null); setNotice(null);
        try { await operation(); if (currentSession()) await context.refresh(); }
        catch (err) {
            if (!currentSession()) return;
            setError(apiErrorMessage(err));
            try { await recover(); if (currentSession()) setNotice("Status tersimpan telah dibaca ulang. Lanjutkan langkah yang belum selesai; identitas yang sudah tersimpan tidak dibuat ulang."); }
            catch { if (currentSession()) { setRecoveryRequired(true); setNotice("Status server belum dapat dipastikan. Baca ulang status sebelum melanjutkan agar tidak membuat pairing ganda."); } }
            if (currentSession()) await context.refresh().catch(() => { });
        } finally { lock.current = false; if (currentSession()) setBusy(false); }
    }
    async function createDevice(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await perform(async () => {
            const existing = await recover();
            if (!currentSession()) return;
            const saved = existing?.device ?? (await writeData<{ device: RegistryDevice }>("post", "/api/devices", { coop_id: coopId, name: deviceName.trim(), device_uid: uid.trim(), mqtt_topic_key: topic.trim(), device_type: "esp32", firmware_version: firmware.trim() || null, is_active: true })).device;
            if (!currentSession()) return;
            setDevice(saved); setStep(2);
            setNotice(existing ? "Perangkat sudah terdaftar dengan pairing yang sama. Lanjutkan pemasangan sensor." : "ESP32 terdaftar. Status online menunggu heartbeat nyata perangkat.");
        });
    }
    async function pairMeters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await perform(async () => {
            if (!device) throw new Error("Simpan ESP32 terlebih dahulu.");
            const snapshot = await recover(device);
            if (!currentSession() || !snapshot) return;
            if (!yes(snapshot.device.is_active)) throw new Error("Aktifkan registry alat melalui Edit sebelum melanjutkan.");
            for (const [type, meterUid, unit] of [["water", waterUid.trim(), "liter"], ["electricity", electricUid.trim(), "kwh"]]) {
                if (!currentSession()) return;
                const existing = snapshot.meters.find(meter => meter.type === type);
                if (existing) {
                    if (existing.meter_uid !== meterUid || existing.unit !== unit) throw new Error("Meter sudah mempunyai identitas berbeda. Kelola melalui Edit; pairing yang ada tidak dipindahkan.");
                    if (!yes(existing.is_active)) throw new Error("Meter yang sudah dipasangkan nonaktif. Aktifkan melalui Edit pada kartu alat.");
                    continue;
                }
                const saved = await writeData<{ meter: MeterRow }>("post", "/api/meters", { device_id: device.id, meter_uid: meterUid, type, channel: "main", unit, is_active: true, installed_at: null });
                snapshot.meters.push(saved.meter);
                if (currentSession()) setMeters([...snapshot.meters]);
            }
            if (currentSession()) { setStep(3); setNotice("Dua sensor sudah terhubung ke ESP32 yang sama. Mapping tidak membuat data pengukuran."); }
        });
    }
    async function saveRelay(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await perform(async () => {
            if (!device) throw new Error("Simpan ESP32 terlebih dahulu.");
            if (relayWanted) {
                const snapshot = await recover(device);
                if (!currentSession() || !snapshot) return;
                const payload = { name: relayName.trim(), purpose: relayPurpose, is_enabled: relayEnabled };
                const saved = snapshot.relay ? await writeData<{ relay: RelayRow }>("patch", `/api/relays/${snapshot.relay.id}`, payload) : await writeData<{ relay: RelayRow }>("post", "/api/relays", { device_id: device.id, channel: 1, ...payload });
                if (currentSession()) setRelay(saved.relay);
            }
            if (currentSession()) { setStep(4); setNotice("Pengaturan tersimpan. Tidak ada perintah ON/OFF atau maintenance yang dikirim."); }
        });
    }
    async function readRecovery() {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(null);
        try { await recover(); if (currentSession()) { setRecoveryRequired(false); setNotice("Status server berhasil dibaca. Lanjutkan langkah yang belum selesai."); } }
        catch (err) { if (currentSession()) setError(apiErrorMessage(err)); }
        finally { lock.current = false; if (currentSession()) setBusy(false); }
    }
    function navigate(tab: string) { if (coopId && coopId !== context.coopId) context.selectCoop(coopId); onNavigate(tab); }
    const disabled = busy || loading || recoveryRequired || !allowed;
    const relaySupported = device?.device_type === "esp32" && ["3.1", "v3.1"].includes(device.firmware_version ?? "");
    return <Card title={initialDevice ? `Lengkapi ${initialDevice.name}` : "Tambah Alat"} description="Satu alur pendaftaran perangkat dan sensor. Terminal bukan prasyarat monitoring.">
        <ol className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{["ESP32", "Sensor air & listrik", "Relay opsional", "Selesai"].map((label, index) => <li key={label} className={`rounded-xl px-3 py-2 ${step === index + 1 ? "bg-[#7B1113] text-[#C6A971]" : "bg-[#FAFAFA] text-[#888]"}`}>{index + 1}. {label}</li>)}</ol>
        <StatusMessage error={error} /><StatusMessage success={notice} />
        {!allowed && <StatusMessage error="Pengelolaan alat memerlukan Admin atau Owner farm pada kandang tujuan." />}
        {loading && <p className="text-sm text-[#888]">Membaca pairing perangkat…</p>}
        {recoveryRequired && <button className={secondaryClass} disabled={busy} onClick={() => { void readRecovery(); }}>Baca ulang status server</button>}
        {step === 1 && <form onSubmit={createDevice} className="grid gap-3 sm:grid-cols-2"><InputField label="Kandang"><select value={coopId ?? ""} onChange={event => setCoopId(Number(event.target.value))} required disabled={busy || Boolean(device)} className={controlClass}><option value="">Pilih kandang</option>{context.coops.filter(row => row.status === "active").map(row => <option value={row.id} key={row.id}>{row.name} · {row.code}</option>)}</select></InputField><InputField label="Nama ESP32"><input value={deviceName} onChange={event => setDeviceName(event.target.value)} required maxLength={120} disabled={busy || Boolean(device)} className={controlClass} /></InputField><InputField label="UID perangkat" hint="Sesuai identitas ESP32; terkunci setelah pendaftaran."><input value={uid} onChange={event => setUid(event.target.value)} required maxLength={120} pattern={identityPattern} disabled={busy || Boolean(device)} className={controlClass} /></InputField><InputField label="MQTT topic key" hint="Sesuai konfigurasi ESP32, satu segmen tanpa slash atau wildcard."><input value={topic} onChange={event => setTopic(event.target.value)} required maxLength={120} pattern={identityPattern} disabled={busy || Boolean(device)} className={controlClass} /></InputField><InputField label="Versi firmware (opsional)" hint="Isi versi nyata perangkat. Relay memerlukan 3.1 atau v3.1."><input value={firmware} onChange={event => setFirmware(event.target.value)} maxLength={60} disabled={busy || Boolean(device)} className={controlClass} /></InputField><button className={`${buttonClass} self-end`} disabled={disabled}>{device ? "Lanjut ke sensor" : "Simpan ESP32 & Lanjut"}</button></form>}
        {step === 2 && <form onSubmit={pairMeters} className="grid gap-3 sm:grid-cols-2"><InputField label="Meter UID air · YF-S201" hint={`Unit liter · channel ${selectedWater?.channel ?? "main"} · inlet tandon`}><input value={waterUid} onChange={event => setWaterUid(event.target.value)} required maxLength={120} pattern={identityPattern} readOnly={Boolean(selectedWater)} disabled={busy} className={controlClass} /></InputField><InputField label="Meter UID listrik · PZEM-004T" hint={`Unit kwh · channel ${selectedElectric?.channel ?? "main"} · panel agregat`}><input value={electricUid} onChange={event => setElectricUid(event.target.value)} required maxLength={120} pattern={identityPattern} readOnly={Boolean(selectedElectric)} disabled={busy} className={controlClass} /></InputField><p className="text-xs text-[#888] sm:col-span-2">{selectedWater ? "Air sudah tersimpan." : "Air belum tersimpan."} {selectedElectric ? "Listrik sudah tersimpan." : "Listrik belum tersimpan."} UID harus sesuai konfigurasi meter perangkat; tidak dibuat otomatis. Identitas yang sudah dipasangkan tetap terkunci.</p><button className={buttonClass} disabled={disabled}>Hubungkan sensor & Lanjut</button></form>}
        {step === 3 && <form onSubmit={saveRelay} className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={relayWanted} onChange={event => setRelayWanted(event.target.checked)} disabled={busy || !relaySupported || Boolean(relay)} />Atur satu output relay kanal 1 (opsional)</label>{!relaySupported && <p className="text-xs text-[#888] sm:col-span-2">Relay belum tersedia: versi firmware terdaftar harus 3.1/v3.1. Monitoring tetap dapat digunakan.</p>}{relayWanted && <><InputField label="Nama output / peralatan"><input value={relayName} onChange={event => setRelayName(event.target.value)} required maxLength={100} disabled={busy} className={controlClass} /></InputField><InputField label="Tujuan"><select value={relayPurpose} onChange={event => setRelayPurpose(event.target.value)} disabled={busy} className={controlClass}><option value="light">Lampu</option><option value="heater">Pemanas</option><option value="other">Lainnya</option></select></InputField><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={relayEnabled} onChange={event => setRelayEnabled(event.target.checked)} disabled={busy} />Mapping enabled</label></>}<p className="text-xs text-[#888] sm:col-span-2">Menyimpan mapping tidak menyalakan relay. ON/OFF hanya melalui Kontrol Manual dengan preflight server.</p><button className={buttonClass} disabled={disabled || (relayWanted && !relaySupported)}>{relayWanted ? "Simpan relay & Selesai" : "Lewati relay & Selesai"}</button></form>}
        {step === 4 && <div className="space-y-3 text-sm"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-[#888]">ESP32 / kandang</dt><dd>{device?.name} · {coop?.name}</dd></div><div><dt className="text-xs text-[#888]">Koneksi perangkat</dt><dd>{device?.connectivity_status ?? "unknown"} · receipt {dateTime(device?.last_seen_at)}</dd></div><div><dt className="text-xs text-[#888]">Sensor air / listrik</dt><dd>{selectedWater?.meter_uid ?? "Belum tersedia"} / {selectedElectric?.meter_uid ?? "Belum tersedia"}</dd></div><div><dt className="text-xs text-[#888]">Relay kanal 1</dt><dd>{relay ? `${relay.name} · ${yes(relay.is_enabled) ? "enabled" : "disabled"}` : "Tidak dikonfigurasi"}</dd></div></dl><div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => navigate("monitor")}>Buka Live Monitor</button><button className={secondaryClass} onClick={() => navigate("relays")}>Buka Kontrol Manual</button></div></div>}
        <button className={secondaryClass} disabled={busy || loading} onClick={onClose}>{step === 4 ? "Tutup" : "Tutup · data tersimpan tetap ada"}</button>
    </Card>;
}
