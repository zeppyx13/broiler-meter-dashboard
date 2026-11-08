"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MapPin, Pencil, Plus, Users } from "lucide-react";
import Swal from "sweetalert2";
import { writeData, roleLabel, type Farm } from "@/lib/broiler-api";
import { getToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { Card, InputField, StatusMessage, buttonClass, controlClass, secondaryClass } from "@/components/broiler/operations/shared";

/** Identitas farm tetap terpisah dari pengaturan tugas dan izin tim. */
export default function LahanTeamCard() {
    const b = useBroiler();
    const [editing, setEditing] = useState<Farm | "new" | null>(null);
    const [busyFarm, setBusyFarm] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mutation = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const canCreate = b.farms.some(farm => farm.capabilities?.["farm:manage"] === true);
    async function setActive(farm: Farm, active: boolean) {
        if (mutation.current || farm.capabilities?.["farm:manage"] !== true) return;
        mutation.current = true; setBusyFarm(farm.id); setError(null);
        const token = getToken();
        try {
            const answer = await Swal.fire({ title: `${active ? "Aktifkan kembali" : "Arsipkan"} ${farm.name}?`, text: active ? "Farm dapat dipakai kembali sesuai izin dan kondisi kandang." : "Farm dinonaktifkan; seluruh data historis tetap tersimpan. Siklus aktif harus diselesaikan terlebih dahulu.", icon: "warning", showCancelButton: true, cancelButtonText: "Batal", confirmButtonText: "Ya, Lanjutkan", confirmButtonColor: "#7B1113" });
            if (!answer.isConfirmed || !mounted.current || token !== getToken()) return;
            await writeData(active ? "patch" : "delete", `/api/farms/${farm.id}`, active ? { is_active: true } : undefined);
            if (mounted.current && token === getToken()) await b.refresh();
        } catch (cause) { if (mounted.current && token === getToken()) { setError(apiErrorMessage(cause)); await b.refresh(); } }
        finally { mutation.current = false; if (mounted.current) setBusyFarm(null); }
    }
    return <Card title="Lahan" description="Farm dan kandang mengikuti akses yang ditugaskan kepada akun Anda. Hanya Owner yang dapat mengubah identitas farm.">
        <div className="flex flex-wrap gap-2">{canCreate && <button className={buttonClass} onClick={() => setEditing("new")}><Plus size={15} />Tambah Lahan</button>}{b.farms.some(farm => farm.capabilities?.["team:read"] === true) && <Link href="/dashboard/settings/team" className={secondaryClass}><Users size={15} />Tim &amp; Hak Akses</Link>}</div>
        {!b.farms.length && <p className="text-sm text-[#888]">Belum ada farm yang ditugaskan. Hubungi Owner untuk mendapatkan akses.</p>}
        <StatusMessage error={error} />
        <div className="space-y-3">{b.farms.map(farm => <article key={farm.id} className="rounded-2xl border border-[#EAEAEA] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><MapPin size={16} />{farm.name}</p><p className="mt-1 text-xs text-[#888]">{farm.location_text ?? "Lokasi belum dicatat"} · {roleLabel(farm.effective_role)}</p><p className="mt-2 text-xs text-[#777]">{b.coops.filter(coop => coop.farm_id === farm.id).map(coop => coop.code).join(", ") || "Belum ada kandang dalam akses Anda"}</p></div>{farm.capabilities?.["farm:manage"] === true && <div className="flex flex-wrap gap-2"><button className={secondaryClass} disabled={busyFarm !== null} onClick={() => setEditing(farm)}><Pencil size={14} />Edit</button><button className={secondaryClass} disabled={busyFarm !== null} onClick={() => { void setActive(farm, !(farm.is_active === true || Number(farm.is_active) === 1)); }}>{farm.is_active === true || Number(farm.is_active) === 1 ? "Arsipkan" : "Aktifkan kembali"}</button></div>}</div></article>)}</div>
        {editing && <FarmEditor key={editing === "new" ? "new" : editing.id} farm={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onDone={async () => { setEditing(null); await b.refresh(); }} />}
    </Card>;
}

function FarmEditor({ farm, onClose, onDone }: { farm?: Farm; onClose: () => void; onDone: () => Promise<void> }) {
    const [name, setName] = useState(farm?.name ?? "");
    const [location, setLocation] = useState(farm?.location_text ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lock = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(null);
        const token = getToken();
        try {
            await writeData(farm ? "patch" : "post", farm ? `/api/farms/${farm.id}` : "/api/farms", { name: name.trim(), location_text: location.trim() || null });
            if (mounted.current && token === getToken()) await onDone();
        } catch (cause) { if (mounted.current && token === getToken()) setError(apiErrorMessage(cause)); }
        finally { lock.current = false; if (mounted.current) setBusy(false); }
    }
    return <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#EAEAEA] p-4"><h3 className="font-semibold">{farm ? "Edit lahan" : "Tambah lahan"}</h3><InputField label="Nama lahan"><input value={name} onChange={event => setName(event.target.value)} required maxLength={150} className={controlClass} /></InputField><InputField label="Lokasi"><input value={location} onChange={event => setLocation(event.target.value)} maxLength={255} className={controlClass} /></InputField><StatusMessage error={error} /><div className="flex gap-2"><button className={buttonClass} disabled={busy}>Simpan</button><button type="button" className={secondaryClass} disabled={busy} onClick={onClose}>Batal</button></div></form>;
}
