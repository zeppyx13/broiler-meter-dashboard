"use client";

import { useRef, useState, type FormEvent } from "react";
import Swal from "sweetalert2";
import { useBroiler } from "../broiler-provider";
import { Card, DataState, InputField, StatusMessage, buttonClass, controlClass, dateTime, saveData, secondaryClass, useAction, useScopedQuery } from "./shared";

type Schedule = { id: number; relay_id: number; name: string; days: number[]; on_time: string; off_time: string; enabled: boolean; dry_run: boolean; revision: number; timezone: string };
type ScheduleRelay = { id: number; name: string; device_name: string; physical_allowed: boolean; physical_reason: string | null; verified: boolean; manual_override_at: string | null };
type ScheduleList = { schedules: Schedule[]; relays: ScheduleRelay[]; physical_enabled: boolean; timezone: string; meta: { total: number } };
type Execution = { id: number; schedule_name: string; command: "on" | "off"; trigger_kind: "scheduler" | "preview"; scheduled_for: string; created_at: string; status: string; dry_run: boolean; reason: string | null; command_failure_reason: string | null };
const DAYS = [[1,"Senin"],[2,"Selasa"],[3,"Rabu"],[4,"Kamis"],[5,"Jumat"],[6,"Sabtu"],[7,"Minggu"]] as const;
const STATES: Record<string,string> = { claimed:"Dicatat", queued:"Antrean", dry_run:"Simulasi tanpa MQTT", blocked:"Dilewati", published:"Dikirim; belum terverifikasi", timed_out:"Timeout; hasil fisik belum diketahui", failed:"Gagal", unverified:"Hasil belum terverifikasi", device_acked:"Dikonfirmasi firmware; beban fisik belum terverifikasi" };
const planPayload = (row: Schedule) => ({ name:row.name, days:row.days, on_time:row.on_time, off_time:row.off_time, enabled:row.enabled, dry_run:row.dry_run, revision:row.revision });

export function RelaySchedules() {
    const b = useBroiler();
    const [page, setPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [editor, setEditor] = useState<Schedule | "new" | null>(null);
    const action = useAction();
    const schedules = useScopedQuery<ScheduleList>("relay-schedules", "/api/relay-schedules", { coop_id:b.coopId, page, limit:20 }, Boolean(b.coopId), 15000);
    const history = useScopedQuery<{ executions:Execution[]; meta:{total:number} }>("relay-schedule-history", "/api/relay-schedules/executions", { coop_id:b.coopId, page:historyPage, limit:20 }, Boolean(b.coopId), 15000);
    const canEdit = b.canManage && b.canRelay;
    const relays = schedules.data?.relays ?? [];
    async function remove(row: Schedule) {
        const confirmed = await Swal.fire({ title:"Hapus jadwal?", text:`${row.name}. Riwayat dipertahankan. Posisi relay yang sekarang tidak diubah.`, icon:"warning", showCancelButton:true, confirmButtonText:"Hapus jadwal", cancelButtonText:"Batal", confirmButtonColor:"#7B1113" });
        if (confirmed.isConfirmed) {
            const removed = await action.run(() => saveData("delete", `/api/relay-schedules/${row.id}`, { revision:row.revision }), "Jadwal dihapus; riwayat tetap tersedia.");
            if (removed && editor !== "new" && editor?.id === row.id) setEditor(null);
        }
    }
    async function resume(relay: ScheduleRelay) {
        const confirmed = await Swal.fire({ title:"Lanjutkan jadwal?", text:`${relay.name}. Jadwal berlaku pada slot berikutnya. Tidak ada perintah langsung atau pengulangan waktu yang terlewat.`, icon:"question", showCancelButton:true, confirmButtonText:"Lanjutkan jadwal", cancelButtonText:"Batal", confirmButtonColor:"#7B1113" });
        if (confirmed.isConfirmed) await action.run(() => saveData("post", `/api/relay-schedules/relays/${relay.id}/resume`, {}), "Jadwal dilanjutkan untuk slot waktu berikutnya.");
    }
    return <div className="space-y-5">
        <Card title="Kontrol Terjadwal" description="Atur waktu nyala dan mati dalam zona Asia/Makassar (WITA). Kontrol Manual tetap tersedia seperti biasa.">
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {schedules.data?.physical_enabled ? "Eksekusi fisik hanya untuk lampu atau beban uji nonkritis yang sudah diverifikasi Owner." : "Eksekusi fisik nonaktif secara default. Gunakan dry-run untuk simulasi tanpa mengirim perintah ke perangkat."}
                {" "}Jadwal dijalankan server, bukan RTC lokal ESP32. Waktu yang terlewat saat server berhenti tidak diputar ulang.
            </p>
            <p className="text-xs text-[#777]">Perintah manual yang diterima menjeda jadwal relay sampai Anda melanjutkannya di sini. Perintah yang sudah dikirim tetap mengikuti pengaman pending dan timeout. Kipas ventilasi dan pemanas tidak tersedia untuk otomatisasi ini.</p>
            <StatusMessage error={action.error} success={action.success} />
            {canEdit && <button type="button" disabled={action.busy || !schedules.data || !relays.length} className={buttonClass} onClick={() => setEditor("new")}>Tambah Jadwal</button>}
            {editor && schedules.data && <ScheduleEditor key={editor === "new" ? "new" : editor.id} row={editor === "new" ? undefined : editor} relays={relays} action={action} close={() => setEditor(null)} />}
            <DataState loading={schedules.isLoading} error={schedules.error}>
                {relays.filter(relay => relay.manual_override_at).map(relay => <div key={relay.id} className="space-y-2 rounded-xl bg-[#F5F0E8] p-3 text-sm text-[#7B1113]">
                    <p>{relay.name}: jadwal dijeda oleh Kontrol Manual sejak {dateTime(relay.manual_override_at)}.</p>
                    {canEdit && <button type="button" className={secondaryClass} disabled={action.busy} onClick={() => { void resume(relay); }}>Lanjutkan Jadwal</button>}
                </div>)}
                {!schedules.data?.schedules.length && <p className="rounded-2xl border border-dashed border-[#DDD] p-5 text-sm text-[#888]">Belum ada jadwal untuk kandang ini.</p>}
                <div className="space-y-3">{schedules.data?.schedules.map(row => {
                    const relay = relays.find(item => Number(item.id) === Number(row.relay_id));
                    return <article key={row.id} className="space-y-3 rounded-2xl border border-[#EAEAEA] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{row.name}</h3><p className="mt-1 text-xs text-[#888]">{relay?.name ?? `Relay #${row.relay_id}`} · {relay?.device_name}</p></div><span className="rounded-full bg-[#F5EEE4] px-3 py-1 text-xs text-[#7B1113]">{row.enabled ? "Aktif" : "Nonaktif"} · {row.dry_run ? "Dry-run" : "Fisik"}</span></div>
                        <p className="text-sm text-[#555]">{DAYS.filter(([day]) => row.days.includes(day)).map(([,label]) => label).join(", ")} · Nyalakan {row.on_time} · Matikan {row.off_time} WITA{row.off_time < row.on_time ? " (hari berikutnya)" : ""}</p>
                        {!row.dry_run && relay?.physical_reason && <p className="text-xs text-amber-800">{relay.physical_reason}</p>}
                        {canEdit && <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={action.busy} className={secondaryClass} onClick={() => { void action.run(() => saveData("patch", `/api/relay-schedules/${row.id}`, { ...planPayload(row), enabled:!row.enabled }), row.enabled ? "Jadwal dinonaktifkan tanpa mengubah posisi relay." : "Jadwal aktif mulai slot berikutnya."); }}>{row.enabled ? "Nonaktifkan" : "Aktifkan"}</button>
                            <button type="button" disabled={action.busy} className={secondaryClass} onClick={() => setEditor(row)}>Ubah</button>
                            <button type="button" disabled={action.busy} className={secondaryClass} onClick={() => { void action.run(() => saveData("post", `/api/relay-schedules/${row.id}/dry-run`, {request_id:crypto.randomUUID()}), "Pratinjau 7 hari dicatat di riwayat. Tidak ada MQTT dikirim."); }}>Simulasikan 7 Hari</button>
                            <button type="button" disabled={action.busy} className={secondaryClass} onClick={() => { void remove(row); }}>Hapus</button>
                        </div>}
                    </article>;
                })}</div>
                <SchedulePager page={page} total={schedules.data?.meta.total ?? 0} change={setPage} />
            </DataState>
        </Card>
        <Card title="Riwayat Eksekusi Jadwal" description="Pratinjau, dry-run, dan pengiriman fisik dicatat terpisah. Status dikirim tidak membuktikan peralatan menyala.">
            <DataState loading={history.isLoading} error={history.error} empty={history.data?.executions.length === 0}>
                <ul className="space-y-3">{history.data?.executions.map(entry => <li key={entry.id} className="space-y-1 rounded-xl bg-[#FAFAFA] p-3 text-sm">
                    <p className="font-semibold">{entry.schedule_name} · {entry.command === "on" ? "Nyalakan" : "Matikan"}</p>
                    <p className="text-xs text-[#777]">Slot: {dateTime(entry.scheduled_for)} WITA · {entry.trigger_kind === "preview" ? "Pratinjau 7 hari" : entry.dry_run ? "Dry-run terjadwal" : "Jadwal fisik"}</p>
                    <p className="text-xs text-[#7B1113]">{STATES[entry.status] ?? entry.status}</p>
                    {(entry.command_failure_reason || entry.reason) && <p className="text-xs text-[#777]">{entry.command_failure_reason ?? entry.reason}</p>}
                </li>)}</ul>
            </DataState>
            <SchedulePager label="Halaman riwayat eksekusi jadwal" page={historyPage} total={history.data?.meta.total ?? 0} change={setHistoryPage} />
        </Card>
    </div>;
}

function ScheduleEditor({ row,relays,action,close }: { row?:Schedule; relays:ScheduleRelay[]; action:ReturnType<typeof useAction>; close:()=>void }) {
    const [relayId,setRelayId] = useState(String(row?.relay_id ?? relays[0]?.id ?? ""));
    const [name,setName] = useState(row?.name ?? "");
    const [days,setDays] = useState<number[]>(row?.days ?? [1,2,3,4,5]);
    const [onTime,setOnTime] = useState(row?.on_time ?? "08:00");
    const [offTime,setOffTime] = useState(row?.off_time ?? "09:00");
    const [enabled,setEnabled] = useState(row?.enabled ?? false);
    const [dryRun,setDryRun] = useState(row?.dry_run ?? true);
    const requestId = useRef<string | null>(null);
    const relay = relays.find(item => String(item.id) === relayId);
    async function submit(event:FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!days.length || onTime === offTime) { action.setError("Pilih setidaknya satu hari dan waktu nyala/mati yang berbeda."); return; }
        const payload = {name:name.trim(),days,on_time:onTime,off_time:offTime,enabled,dry_run:dryRun};
        requestId.current ??= crypto.randomUUID();
        const saved = await action.run(() => row
            ? saveData("patch", `/api/relay-schedules/${row.id}`, {...payload,revision:row.revision})
            : saveData("post", "/api/relay-schedules", {...payload,relay_id:Number(relayId),request_id:requestId.current}), "Jadwal tersimpan. Tidak ada perintah langsung saat menyimpan.");
        if (saved) close();
    }
    return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4">
        <h3 className="font-semibold">{row ? "Ubah Jadwal" : "Jadwal Baru"}</h3>
        <fieldset disabled={action.busy} className="min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <InputField label="Nama jadwal"><input required maxLength={100} value={name} onChange={event=>setName(event.target.value)} className={controlClass} /></InputField>
                <InputField label="Perangkat relay"><select required value={relayId} onChange={event=>setRelayId(event.target.value)} disabled={Boolean(row)} className={controlClass}>{relays.map(item=><option value={item.id} key={item.id}>{item.name} · {item.device_name}</option>)}</select></InputField>
                <InputField label="Waktu nyalakan (WITA)"><input required type="time" value={onTime} onChange={event=>setOnTime(event.target.value)} className={controlClass} /></InputField>
                <InputField label="Waktu matikan (WITA)"><input required type="time" value={offTime} onChange={event=>setOffTime(event.target.value)} className={controlClass} /></InputField>
            </div>
            <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium text-[#555]">Hari mulai jadwal</legend><div className="flex flex-wrap gap-3">{DAYS.map(([day,label])=><label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={days.includes(day)} onChange={event=>setDays(previous=>event.target.checked?[...previous,day].sort((a,b)=>a-b):previous.filter(value=>value!==day))} />{label}</label>)}</div></fieldset>
            <p className="text-xs text-[#888]">Jika waktu matikan lebih awal dari waktu nyalakan, relay dijadwalkan mati pada hari berikutnya.</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <InputField label="Mode eksekusi"><select value={dryRun ? "dry_run" : "physical"} onChange={event=>setDryRun(event.target.value === "dry_run")} className={controlClass}><option value="dry_run">Dry-run (tanpa MQTT)</option><option value="physical" disabled={!relay?.physical_allowed}>Fisik — beban uji terverifikasi</option></select></InputField>
                <label className="flex items-center gap-2 self-end py-3 text-sm"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} />Aktifkan jadwal</label>
            </div>
            {relay?.physical_reason && <p className="text-xs text-[#888]">{relay.physical_reason}</p>}
            <div className="flex flex-wrap gap-2"><button className={buttonClass} type="submit">Simpan Jadwal</button><button type="button" onClick={close} className={secondaryClass}>Batal</button></div>
        </fieldset>
    </form>;
}
function SchedulePager({page,total,change,label="Halaman jadwal"}:{page:number;total:number;change:(page:number)=>void;label?:string}) {
    return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-[#888]"><span>Halaman {page}</span><div className="flex gap-2"><button type="button" disabled={page<=1} className={secondaryClass} onClick={()=>change(page-1)}>Sebelumnya</button><button type="button" disabled={page*20>=total} className={secondaryClass} onClick={()=>change(page+1)}>Berikutnya</button></div></nav>;
}
