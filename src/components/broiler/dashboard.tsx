"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { MetricChart } from "./charts";
import { useBroiler } from "./broiler-provider";
import { Panel, Value, Badge, Failure, Notice, Evidence, useResource, EditForm, Dialog, buttonStyle } from "./ui";
import { metric, readData, stream, writeData, wattsToKw, telemetryChartPoints, type Summary, type DailyMetric, type Coop } from "@/lib/broiler-api";
import { Analytics } from "./insights";
import { Production } from "./production";
import { CycleReports } from "./reports";

export function SelectionBar() {
    const b = useBroiler();
    const pathname = usePathname(); const router = useRouter();
    const onDetail = /^\/dashboard\/kamar\/\d+$/.test(pathname);
    const chooseCoop = (id: number) => { if (onDetail) router.push(`/dashboard/kamar/${id}`); else b.selectCoop(id); };
    const chooseFarm = (id: number) => {
        const first = b.coops.find(c => c.farm_id === id);
        if (onDetail && first) router.push(`/dashboard/kamar/${first.id}`);
        else { b.selectFarm(id); if (onDetail) router.push("/dashboard/kamar"); }
    };
    return <section aria-label="Konteks dashboard" className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <label className="min-w-36 flex-1 text-xs text-[#666]">Lahan<select aria-label="Pilih lahan" value={b.farmId ?? ""} onChange={e => chooseFarm(Number(e.target.value))} className="mt-1 block w-full rounded-xl border p-2 text-sm">{b.farms.length === 0 && <option value="">Belum ada lahan</option>}{b.farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label className="min-w-36 flex-1 text-xs text-[#666]">Kandang<select aria-label="Pilih kandang" value={b.coopId ?? ""} onChange={e => chooseCoop(Number(e.target.value))} className="mt-1 block w-full rounded-xl border p-2 text-sm">{!b.coop && <option value="">Belum ada kandang</option>}{b.coops.filter(c => c.farm_id === b.farmId).map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
        <Badge>DATA SENSOR · sesuai kualitas server</Badge>
    </section>;
}

export function SourceNote() { return <p className="my-3 text-xs text-[#777]">Air = inlet tandon; listrik = agregat panel. Offline tidak membuktikan kipas mati atau PLN padam.</p>; }
export function MonitoringSummary() {
    const b = useBroiler();
    const result = useResource<Summary>("summary", b.coopId ? "/api/dashboard/summary" : null, { coop_id: b.coopId }, 10000);
    const selected = stream(result.data);
    const charts = useResource<{ series: DailyMetric[] }>("charts", b.coopId ? "/api/dashboard/charts" : null, { coop_id: b.coopId, metric: "all", range: "cycle" }, 30000);
    const history = useResource<{ samples: { recorded_at: string; power_w: number | null; flow_rate_lpm: number | null }[]; quality: unknown }>("telemetry-history", b.coopId ? `/api/coops/${b.coopId}/telemetry-history` : null, { source: b.source, minutes: 30, bucket_seconds: 30 }, 15000);
    const points = charts.data?.series;
    if (!b.coopId) return <Notice>Belum ada kandang. Buat lahan dan kandang melalui menu Kandang atau Pengaturan.</Notice>;
    return <><Failure error={result.error} />{result.isPending && <Notice>Memuat ringkasan server…</Notice>}<Panel title={`Ringkasan ${b.coop?.code ?? "kandang"}`} action={<Badge>{selected?.live?.status ?? result.data?.state ?? "no_data"}</Badge>}><SourceNote /><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Value label="Air inlet hari ini" value={selected?.today?.water_liters} unit=" L" hint={selected?.today?.status ?? "Tidak ada interval accepted"} /><Value label="Daya panel saat ini" value={wattsToKw(selected?.live?.power_w)} unit=" kW" hint={selected?.live?.field_status?.power_w} /><Value label="Energi hari ini" value={selected?.today?.energy_kwh} unit=" kWh" /><Value label="Populasi saat ini" value={result.data?.active_cycle?.current_population} unit=" ekor" hint={result.data?.active_cycle ? `Hari ke-${result.data.active_cycle.day_age}` : "Tidak ada siklus aktif"} /></div><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4"><Value label="Tegangan" value={selected?.live?.voltage_v} unit=" V" /><Value label="Arus" value={selected?.live?.current_a} unit=" A" /><Value label="Frekuensi" value={selected?.live?.frequency_hz} unit=" Hz" /><Value label="Power factor" value={selected?.live?.power_factor} /></div><Evidence value={{ today: selected?.today, cycle_totals: selected?.cycle_totals, field_status: selected?.live?.field_status, generated_at: result.data?.generated_at }} /></Panel>
        <Panel title="Konsumsi harian tercatat"><Failure error={charts.error} />{points?.length ? <MetricChart data={points} x="metric_date" lines={[{ key: "water_liters", name: "Inlet tandon (L)", color: "#2F5BBA" }, { key: "energy_kwh", name: "Energi (kWh)", color: "#7B1113" }]} /> : <Notice>Tidak ada data harian untuk sumber dan siklus ini.</Notice>}<p className="text-xs text-[#777]">Null berarti bukti belum tersedia; nol hanya bila interval diterima bernilai nol. Coverage dapat partial.</p></Panel>
        <Panel title="Daya & debit · histori 30 menit"><Failure error={history.error} />{history.data?.samples?.length ? <MetricChart data={telemetryChartPoints(history.data.samples, 30)} x="recorded_at" lines={[{ key: "power_w", name: "Panel (W)", color: "#B76E00" }, { key: "flow_rate_lpm", name: "Inlet (L/min)", color: "#2F5BBA" }]} /> : <Notice>Belum ada sampel historis persisten untuk sumber ini. Data tidak diganti dengan angka contoh.</Notice>}<Evidence value={history.data?.quality} /></Panel></>;
}


export function HomeOverview() {
    const b = useBroiler();
    const summaries = useQueries({ queries: b.coops.map(c => ({ queryKey: ["broiler-overview", b.user?.id, c.farm_id, c.id], queryFn: () => readData<Summary>("/api/dashboard/summary", { coop_id: c.id }), enabled: Boolean(b.user), staleTime: 20000, retry: false })) });
    return <><Panel title="Status seluruh kandang yang dapat diakses"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{b.coops.map((c, i) => { const q = summaries[i]; const s = stream(q.data); return <Link href={`/dashboard/kamar/${c.id}`} key={c.id} onClick={() => b.selectCoop(c.id)} className="rounded-2xl border border-[#EAEAEA] p-4 hover:border-[#7B1113]"><div className="flex justify-between gap-2"><h3 className="font-semibold">{c.code} · {c.name}</h3><Badge>{q.isError ? "error" : s?.live?.status ?? "no_data"}</Badge></div><p className="mt-2 text-sm text-[#777]">{q.data?.active_cycle ? `Hari ke-${q.data.active_cycle.day_age} · ${metric(q.data.active_cycle.current_population, 0)} ekor` : q.isPending ? "Memuat…" : q.isError ? "Data belum dapat dimuat" : "Tidak ada siklus aktif"}</p><p className="mt-2 text-sm">Inlet {metric(s?.today?.water_liters, 1, " L")} · {metric(s?.today?.energy_kwh, 2, " kWh")}</p></Link>; })}</div>{b.coops.length === 0 && <Notice>Tidak ada kandang yang tersedia untuk akun ini.</Notice>}<SourceNote /></Panel><MonitoringSummary /><Analytics compact /></>;
}

export function CoopsPage() {
    const b = useBroiler(); const [create, setCreate] = useState(false); const [edit, setEdit] = useState<Coop | null>(null); const [error, setError] = useState<unknown>(null);
    const manage = b.user?.role === "admin" || ["owner", "manager"].includes(b.farms.find(f => f.id === b.farmId)?.member_role ?? "");
    return <Panel title="Kandang & siklus" action={manage && b.farmId ? <button className={buttonStyle} onClick={() => setCreate(true)}>Tambah Kandang</button> : undefined}><Notice>Maksimal empat kandang pada pembuatan baru per lahan. Arsip mempertahankan histori; kandang bersiklus aktif tidak dapat diarsipkan.</Notice><Failure error={error} /><div className="grid gap-4 md:grid-cols-2">{b.coops.filter(c => c.farm_id === b.farmId).map(c => <div key={c.id} className="rounded-2xl border p-5"><Link onClick={() => b.selectCoop(c.id)} className="font-poppins text-lg font-semibold text-[#7B1113]" href={`/dashboard/kamar/${c.id}`}>{c.code} · {c.name} →</Link><p className="my-2 text-sm text-[#777]">{c.status} · kapasitas {metric(c.capacity_birds, 0)} ekor</p>{manage && <div className="flex gap-3"><button className="text-sm underline" onClick={() => setEdit(c)}>Edit</button><button className="text-sm text-red-700 underline" onClick={async () => { if (!window.confirm(`Arsipkan ${c.code}? Histori tetap tersimpan.`)) return; try { await writeData("delete", `/api/coops/${c.id}`); await b.refresh(); } catch (e) { setError(e); } }}>Arsipkan</button></div>}</div>)}</div>{(create || edit) && <Dialog title={edit ? "Edit Kandang" : "Tambah Kandang"} close={() => { setEdit(null); setCreate(false); }}><EditForm title="Identitas kandang" fields={[{ key: "code", label: "Kode", required: true, value: edit?.code }, { key: "name", label: "Nama", required: true, value: edit?.name }, { key: "capacity_birds", label: "Kapasitas (ekor)", type: "number", min: 1, step: "1", value: edit?.capacity_birds }, { key: "description", label: "Deskripsi", type: "textarea", value: edit?.description }]} submit={v => writeData(edit ? "patch" : "post", edit ? `/api/coops/${edit.id}` : "/api/coops", edit ? v : { ...v, farm_id: b.farmId })} onDone={() => { setCreate(false); setEdit(null); void b.refresh(); }} /></Dialog>}</Panel>;
}

export function CoopDetail({ id }: { id: number }) {
    const b = useBroiler(); const [tab, setTab] = useState("ringkasan");
    const { loading, coopId, coops, selectCoop } = b;
    useEffect(() => { if (!loading && coopId !== id && coops.some(c => c.id === id)) selectCoop(id); }, [loading, coopId, coops, id, selectCoop]);
    if (b.loading) return <Notice>Memuat identitas kandang…</Notice>;
    if (b.coopId !== id) { const c = b.coops.find(c => c.id === id); return c ? <Panel title={`Kandang ${c.code}`}><button className={buttonStyle} onClick={() => b.selectCoop(id)}>Buka data Kandang {c.code}</button></Panel> : <Notice>Kandang tidak tersedia atau akses tidak diizinkan.</Notice>; }
    return <><div className="flex flex-wrap gap-2" role="tablist" aria-label="Detail kandang">{[["ringkasan", "Ringkasan"], ["harian", "Catat Harian"], ["riwayat", "Riwayat"], ["peralatan", "Peralatan"], ["pengaturan", "Pengaturan"]].map(([key, label]) => <button role="tab" aria-selected={tab === key} className={`${tab === key ? "bg-[#7B1113] text-white" : "bg-white"} rounded-xl border px-4 py-3 text-sm`} onClick={() => setTab(key)} key={key}>{label}</button>)}</div>{tab === "ringkasan" && <><MonitoringSummary /><Analytics /></>}{["harian", "peralatan", "pengaturan"].includes(tab) && <Production key={`${id}-${tab}`} tab={tab} />}{tab === "riwayat" && <CycleReports />}</>;
}
