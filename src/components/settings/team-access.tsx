"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Search, Users, Plus, Pencil, UserMinus, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { readData, writeData, roleLabel, type BusinessRole } from "@/lib/broiler-api";
import { getToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { Card, DataState, InputField, StatusMessage, buttonClass, controlClass, secondaryClass } from "@/components/broiler/operations/shared";

type ExtraPermissions = { daily_correct: boolean; cycle_harvest: boolean; insights_use: boolean };
type Assignment = { delegation_by_owner?: boolean; coop_id: number; can_operate: boolean; relay_operate: boolean; permissions: ExtraPermissions };
type Member = { id: number | null; user_id: number; name: string; email: string; effective_role: BusinessRole; legacy_read_only?: boolean; revoked_at: string | null; revision: number; assignments: Assignment[] };
type Candidate = { id: number; name: string; email: string };
type CoopOption = { id: number; name: string; code: string; status: string };
type Team = { members: Member[]; coops: CoopOption[]; meta: { page: number; limit: number; total: number; has_more: boolean }; capabilities: { read: boolean; manage: boolean }; schema_ready: boolean };
const yes = (value: unknown) => value === true || Number(value) === 1;
const assignmentFor = (coop_id: number): Assignment => ({ coop_id, can_operate: false, relay_operate: false, permissions: { daily_correct: false, cycle_harvest: false, insights_use: false } });

function teamError(error: unknown) {
    if (isAxiosError(error) && error.response?.status === 503) return "Pengelolaan tim belum tersedia. Hubungi pengelola COASTHER sebelum mengubah akses.";
    return apiErrorMessage(error);
}

export default function TeamAccessCard() {
    const b = useBroiler();
    const farms = b.farms.filter(farm => farm.capabilities?.["team:read"] === true);
    const farm = farms.find(item => item.id === b.farmId) ?? farms[0];
    useEffect(() => { if (farm && farm.id !== b.farmId) b.selectFarm(farm.id); }, [farm?.id, b.farmId, b.selectFarm]);
    if (!farm) return <Card title="Tim & Hak Akses"><p className="text-sm text-[#777]">Halaman tim tersedia bagi Owner dan Admin pada farm yang ditugaskan. Hubungi Owner bila Anda memerlukan perubahan akses.</p></Card>;
    return <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Users size={18} className="text-[#7B1113]" /><h2 className="font-poppins text-lg font-semibold">Tim &amp; Hak Akses</h2></div><label className="text-sm text-[#666]">Farm<select aria-label="Farm tim" value={farm.id} onChange={event => b.selectFarm(Number(event.target.value))} className={`${controlClass} mt-1`}>{farms.map(item => <option key={item.id} value={item.id}>{item.name} · {roleLabel(item.effective_role)}</option>)}</select></label></div>
        <TeamScope key={`${b.user?.id}:${farm.id}:${b.accessVersion}`} farmId={farm.id} farmName={farm.name} owner={farm.capabilities?.["team:manage"] === true} />
    </section>;
}

function TeamScope({ farmId, farmName, owner }: { farmId: number; farmName: string; owner: boolean }) {
    const b = useBroiler();
    const [search, setSearch] = useState("");
    const [submittedSearch, setSubmittedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("all");
    const [lookupEmail, setLookupEmail] = useState("");
    const [lookupDone, setLookupDone] = useState(false);
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [editor, setEditor] = useState<Member | "new" | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const lock = useRef(false);
    const mounted = useRef(true);
    const controller = useRef<AbortController | null>(null);
    const team = useQuery({ queryKey: ["broiler", b.user?.id, farmId, "team", submittedSearch, page, status], queryFn: ({ signal }) => readData<Team>(`/api/farms/${farmId}/team`, { page, limit: 20, search: submittedSearch || undefined, status }, { signal }), enabled: Boolean(b.user), retry: false });
    const canManage = owner && !team.isError && team.data?.capabilities.manage === true && team.data.schema_ready;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); Swal.close(); }; }, []);
    async function lookup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canManage || lock.current) return;
        lock.current = true; setBusy(true); setError(null); setCandidate(null); setLookupDone(false);
        const token = getToken();
        controller.current = new AbortController();
        try {
            const result = await readData<{ candidate: Candidate | null }>(`/api/farms/${farmId}/team/candidates`, { email: lookupEmail.trim() }, { signal: controller.current.signal });
            if (!mounted.current || token !== getToken()) return;
            setCandidate(result.candidate); setLookupDone(true);
        } catch (cause) { if (mounted.current && token === getToken()) setError(teamError(cause)); }
        finally { lock.current = false; if (mounted.current) setBusy(false); }
    }
    async function revoke(member: Member) {
        if (!canManage || lock.current || member.effective_role === "owner") return;
        lock.current = true; setBusy(true); setError(null); setSuccess(null);
        const token = getToken();
        try {
            const answer = await Swal.fire({ title: `Cabut akses ${member.name}?`, text: `${farmName}: akses farm, kandang dan kontrol terkait akan dicabut. Akun serta histori operasional tetap tersimpan.`, icon: "warning", showCancelButton: true, cancelButtonText: "Batal", confirmButtonText: "Ya, Cabut Akses", confirmButtonColor: "#7B1113" });
            if (!answer.isConfirmed || !mounted.current || token !== getToken()) return;
            const result = await writeData<{ audit_id: number }>("post", `/api/farms/${farmId}/team/${member.id}/revoke`, { revision: member.revision, request_id: crypto.randomUUID() });
            if (!mounted.current || token !== getToken()) return;
            await team.refetch(); await b.refresh();
            if (mounted.current) setSuccess(`Akses ${member.name} telah dicabut sesuai status server. Audit #${result.audit_id}.`);
        } catch (cause) {
            if (mounted.current && token === getToken()) { setError(teamError(cause)); await team.refetch(); await b.refresh(); }
        } finally { lock.current = false; if (mounted.current) setBusy(false); }
    }
    async function saved(auditId: number) { setEditor(null); setCandidate(null); setLookupDone(false); await team.refetch(); await b.refresh(); if (mounted.current) setSuccess(`Tugas dan izin tersimpan. Audit #${auditId}.`); }
    return <Card title={`Tim ${farmName}`} description={owner ? "Pilih akun, peran, kandang dan izin. Hanya Owner farm ini yang dapat mengubah akses." : "Daftar tim farm yang ditugaskan kepada Anda. Perubahan akses dikelola Owner."}>
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setSubmittedSearch(search.trim()); setPage(1); }}><InputField label="Cari anggota"><input value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Nama atau email anggota" className={controlClass} /></InputField><InputField label="Status"><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={controlClass}><option value="all">Semua</option><option value="active">Aktif</option><option value="revoked">Dicabut</option></select></InputField><button className={secondaryClass}><Search size={14} />Cari</button><button type="button" className={secondaryClass} onClick={() => { void team.refetch(); }}><RefreshCw size={14} />Muat ulang</button></form>
        <StatusMessage error={error ?? (team.error ? teamError(team.error) : null)} success={success} />
        <DataState loading={team.isLoading} error={team.error ? new Error(teamError(team.error)) : null} empty={!team.isError && team.data?.members.length === 0}>
            <div className="space-y-3">{team.data?.members.map(member => <article key={`${member.id}:${member.revision}`} className="rounded-2xl border border-[#EAEAEA] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{member.name}</p><p className="mt-1 text-xs text-[#777]">{member.email}</p><p className="mt-2 text-xs text-[#7B1113]">{member.legacy_read_only ? "Akses baca lama · tidak mendapat izin tambahan" : roleLabel(member.effective_role)} · {member.revoked_at ? "Dicabut" : "Aktif"}</p></div>{canManage && member.effective_role !== "owner" && <div className="flex gap-2"><button className={secondaryClass} disabled={busy} onClick={() => { setEditor(member); setError(null); }}><Pencil size={14} />{member.revoked_at ? "Tugaskan kembali" : "Ubah"}</button>{!member.revoked_at && <button className={secondaryClass} disabled={busy} onClick={() => { void revoke(member); }}><UserMinus size={14} />Cabut</button>}</div>}</div>{member.effective_role === "operator" && <div className="mt-3 space-y-2 text-xs text-[#777]">{member.assignments.length ? member.assignments.map(assignment => <p key={assignment.coop_id}>{team.data?.coops.find(coop => coop.id === assignment.coop_id)?.name ?? `Kandang #${assignment.coop_id}`} · Catat: {yes(assignment.can_operate) ? "ya" : "tidak"} · Relay: {yes(assignment.relay_operate) ? "izin khusus" : "tidak"} · Koreksi: {yes(assignment.permissions?.daily_correct) ? "ya" : "tidak"} · Panen: {yes(assignment.permissions?.cycle_harvest) ? "ya" : "tidak"} · Insight: {yes(assignment.permissions?.insights_use) ? "ya" : "tidak"}{assignment.delegation_by_owner === false && " - Izin tambahan lama perlu disimpan ulang oleh Owner"}</p>) : <p>Belum ada penugasan kandang aktif.</p>}</div>}</article>)}</div>
        </DataState>
        <div className="flex items-center justify-between gap-2 text-xs text-[#888]"><span>Halaman {page} · {team.data?.meta.total ?? 0} anggota</span><div className="flex gap-2"><button className={secondaryClass} disabled={page === 1 || team.isFetching} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><button className={secondaryClass} disabled={!team.data?.meta.has_more || team.isFetching} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
        {canManage && !editor && <form onSubmit={lookup} className="space-y-3 border-t border-[#EEE] pt-4"><h3 className="font-semibold text-[#7B1113]">Tambah / tugaskan anggota</h3><p className="text-xs text-[#777]">Gunakan email lengkap akun yang sudah terdaftar. Tidak ada pembuatan akun atau undangan otomatis.</p><div className="flex flex-wrap items-end gap-2"><InputField label="Email akun"><input type="email" disabled={busy} value={lookupEmail} onChange={event => { setLookupEmail(event.target.value); setCandidate(null); setLookupDone(false); }} required maxLength={190} className={controlClass} /></InputField><button className={secondaryClass} disabled={busy}><Search size={14} />Cari akun</button></div>{lookupDone && !candidate && <p className="text-sm text-[#777]">Akun belum ditemukan. Pengguna harus mempunyai akun COASTHER terlebih dahulu.</p>}{candidate && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAFAFA] p-3"><p className="text-sm">{candidate.name} · {candidate.email}</p><button type="button" onClick={() => setEditor("new")} className={buttonClass}><Plus size={14} />Atur tugas</button></div>}</form>}
        {editor && canManage && <MemberForm key={editor === "new" ? candidate?.id : `${editor.id}:${editor.revision}`} farmId={farmId} farmName={farmName} candidate={editor === "new" ? candidate : null} member={editor === "new" ? undefined : editor} coops={team.data?.coops ?? []} onClose={() => setEditor(null)} onSaved={saved} onRecover={async () => { await team.refetch(); await b.refresh(); }} />}
    </Card>;
}

function MemberForm({ farmId, farmName, candidate, member, coops, onClose, onSaved, onRecover }: { farmId: number; farmName: string; candidate: Candidate | null; member?: Member; coops: CoopOption[]; onClose: () => void; onSaved: (auditId: number) => Promise<void>; onRecover: () => Promise<void> }) {
    const [role, setRole] = useState<"admin" | "operator">(member?.effective_role === "admin" ? "admin" : "operator");
    const [assignments, setAssignments] = useState<Assignment[]>((member?.assignments ?? []).map(item => ({ coop_id: item.coop_id, can_operate: yes(item.can_operate), relay_operate: yes(item.relay_operate), permissions: { daily_correct: yes(item.permissions?.daily_correct), cycle_harvest: yes(item.permissions?.cycle_harvest), insights_use: yes(item.permissions?.insights_use) } })));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uncertain, setUncertain] = useState(false);
    const lock = useRef(false);
    const mounted = useRef(true);
    const target = member ?? candidate;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; Swal.close(); }; }, []);
    function toggle(coopId: number, selected: boolean) { setAssignments(current => selected ? [...current.filter(item => item.coop_id !== coopId), assignmentFor(coopId)] : current.filter(item => item.coop_id !== coopId)); }
    function setPermission(coopId: number, key: "can_operate" | "relay_operate" | keyof ExtraPermissions, checked: boolean) {
        setAssignments(current => current.map(item => item.coop_id !== coopId ? item : key === "can_operate" ? { ...item, can_operate: checked, relay_operate: checked && item.relay_operate, permissions: { ...item.permissions, daily_correct: checked && item.permissions.daily_correct, cycle_harvest: checked && item.permissions.cycle_harvest } } : key === "relay_operate" ? { ...item, relay_operate: checked } : { ...item, permissions: { ...item.permissions, [key]: checked } }));
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!target || lock.current || uncertain) return;
        if (role === "operator" && !assignments.length) { setError("Pilih setidaknya satu kandang untuk Operator."); return; }
        lock.current = true; setBusy(true); setError(null);
        const token = getToken();
        try {
            const confirmation = await Swal.fire({ title: `Simpan akses ${target.name}?`, text: role === "admin" ? `Admin dapat mengelola seluruh kandang ${farmName}. Kebijakan tim dan kepemilikan tetap milik Owner.` : `Operator hanya mengakses ${assignments.length} kandang yang dipilih beserta izin yang dicentang. Perubahan menggantikan tugas sebelumnya.`, icon: "warning", showCancelButton: true, cancelButtonText: "Batal", confirmButtonText: "Ya, Simpan", confirmButtonColor: "#7B1113" });
            if (!confirmation.isConfirmed || !mounted.current || token !== getToken()) return;
            const payload = { role, assignments: role === "admin" ? [] : assignments, request_id: crypto.randomUUID(), ...(member ? { revision: member.revision } : { user_id: candidate?.id }) };
            const result = await writeData<{ audit_id: number }>(member ? "patch" : "post", member ? `/api/farms/${farmId}/team/${member.id}` : `/api/farms/${farmId}/team/assign`, payload);
            if (!mounted.current || token !== getToken()) return;
            await onSaved(result.audit_id);
        } catch (cause) {
            if (!mounted.current || token !== getToken()) return;
            setError(`${teamError(cause)} Status dibaca ulang; permintaan tidak dikirim ulang otomatis.`);
            setUncertain(true); await onRecover().catch(() => { });
        } finally { lock.current = false; if (mounted.current) setBusy(false); }
    }
    return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4"><h3 className="font-semibold">{member ? "Ubah tugas" : "Tugaskan akun"} · {target?.name}</h3><p className="text-xs text-[#777]">{target?.email} · {farmName}</p><InputField label="Peran"><select value={role} disabled={busy || uncertain} onChange={event => setRole(event.target.value as "admin" | "operator")} className={controlClass}><option value="operator">Operator</option><option value="admin">Admin</option></select></InputField>{role === "admin" ? <p className="rounded-xl bg-white p-3 text-sm text-[#777]">Admin mengelola kandang dan operasional farm ini, termasuk perangkat dengan guard keselamatan. Admin tidak dapat mengubah tim atau kepemilikan.</p> : <div className="space-y-3"><p className="text-sm font-medium">Pilih kandang dan izin</p>{coops.map(coop => { const assignment = assignments.find(item => item.coop_id === coop.id); return <fieldset key={coop.id} disabled={busy || uncertain} className="space-y-3 rounded-xl border border-[#EAEAEA] bg-white p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(assignment)} onChange={event => toggle(coop.id, event.target.checked)} disabled={coop.status !== "active" && !assignment} />{coop.code} · {coop.name}</label>{assignment && <div className="grid gap-3 pl-6 text-xs text-[#666] sm:grid-cols-2"><span className="sm:col-span-2">Preset: baca monitoring dan laporan kandang. Izin tambahan dipilih satu per satu.</span><label className="flex items-start gap-2"><input type="checkbox" checked={assignment.can_operate} onChange={event => setPermission(coop.id, "can_operate", event.target.checked)} />Catat harian dan ACK peringatan</label><label className="flex items-start gap-2"><input type="checkbox" checked={assignment.permissions.insights_use} onChange={event => setPermission(coop.id, "insights_use", event.target.checked)} />Forecast, Eco dan Copilot pribadi</label><label className="flex items-start gap-2"><input type="checkbox" disabled={!assignment.can_operate} checked={assignment.permissions.daily_correct} onChange={event => setPermission(coop.id, "daily_correct", event.target.checked)} />Koreksi / batalkan catatan harian</label><label className="flex items-start gap-2"><input type="checkbox" disabled={!assignment.can_operate} checked={assignment.permissions.cycle_harvest} onChange={event => setPermission(coop.id, "cycle_harvest", event.target.checked)} />Panen / tutup siklus</label><label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" disabled={!assignment.can_operate} checked={assignment.relay_operate} onChange={event => setPermission(coop.id, "relay_operate", event.target.checked)} />Relay Manual (izin khusus; tetap memerlukan preflight perangkat)</label><p className="sm:col-span-2 text-[#999]">Pengelolaan alat dan command maintenance Terminal tidak didelegasikan kepada Operator.</p></div>}</fieldset>; })}</div>}<StatusMessage error={error} />{uncertain && <p className="text-xs text-[#777]">Tutup form, periksa daftar terbaru, lalu pilih anggota kembali bila perubahan masih diperlukan.</p>}<div className="flex flex-wrap gap-2"><button type="submit" className={buttonClass} disabled={busy || uncertain}>Simpan akses</button><button type="button" className={secondaryClass} disabled={busy} onClick={onClose}>Tutup</button></div></form>;
}
