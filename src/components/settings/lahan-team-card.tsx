"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { readData, writeData, type Farm } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { MAX_KANDANG_PER_LAHAN } from "@/components/kamar/room-form-modal";
import { CancelButton, Field, ModalShell, PrimaryButton, inputClass } from "@/components/kamar/ringkasan/form-parts";

type MemberRole = "owner" | "manager" | "operator" | "viewer";
type Member = { id: number; farm_id: number; user_id: number; role: MemberRole; name: string };
type Assignment = { coop_id: number; user_id: number; can_operate: boolean | number; relay_operate: boolean | number; revoked_at?: string | null };

const ROLE_LABEL: Record<MemberRole, string> = { owner: "Pemilik", manager: "Admin lahan", operator: "Operator kandang", viewer: "Pemantau" };
const ROLE_BADGE: Record<MemberRole, string> = {
    owner: "bg-[#7B1113] text-[#C6A971]",
    manager: "bg-[#EAF2FF] text-[#2F5BBA]",
    operator: "bg-green-50 text-green-700",
    viewer: "bg-gray-100 text-gray-600",
};
const yes = (v: unknown) => v === true || Number(v) === 1;

/** Lahan (farm), anggota timnya, dan penugasan operator per kandang — semua dari server. */
export default function LahanTeamCard() {
    const b = useBroiler();
    const [farmForm, setFarmForm] = useState<Farm | "new" | null>(null);
    const canCreateFarm = b.user?.role === "admin" || b.farms.some((f) => f.member_role === "owner");

    async function saveFarm(body: { name: string; location_text: string | null }) {
        try {
            if (farmForm === "new") await writeData("post", "/api/farms", body);
            else if (farmForm) await writeData("patch", `/api/farms/${farmForm.id}`, body);
            await b.refresh();
            setFarmForm(null);
            Swal.fire({ icon: "success", title: "Lahan tersimpan", timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                        <Users size={20} className="text-[#7B1113]" />
                    </div>
                    <div>
                        <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Lahan &amp; Tim</h3>
                        <p className="mt-1 font-inter text-sm text-[#666]">
                            Pemilik mengelola lahan dan admin lahan. Admin lahan menugaskan operator ke kandang (maks. {MAX_KANDANG_PER_LAHAN} kandang per lahan).
                        </p>
                    </div>
                </div>
                {canCreateFarm && (
                    <button
                        onClick={() => setFarmForm("new")}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-4 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                    >
                        <Plus size={15} /> Tambah Lahan
                    </button>
                )}
            </div>

            {b.farms.length === 0 && !b.loading && <p className="mt-5 font-inter text-sm text-[#999]">Belum ada lahan untuk akun ini.</p>}

            <div className="mt-5 space-y-4">
                {b.farms.map((farm) => <FarmSection key={farm.id} farm={farm} onEdit={() => setFarmForm(farm)} />)}
            </div>

            {farmForm && <FarmFormModal farm={farmForm === "new" ? null : farmForm} onClose={() => setFarmForm(null)} onSubmit={saveFarm} />}
        </div>
    );
}

function FarmSection({ farm, onEdit }: { farm: Farm; onEdit: () => void }) {
    const b = useBroiler();
    const isOwner = b.user?.role === "admin" || farm.member_role === "owner";
    const canManage = isOwner || farm.member_role === "manager";
    const coops = b.coops.filter((c) => c.farm_id === farm.id);
    const [adding, setAdding] = useState(false);

    const members = useQuery({
        queryKey: ["broiler", b.user?.id, "farm-members", farm.id],
        queryFn: () => readData<{ members: Member[] }>(`/api/farms/${farm.id}/members`, { page: 1, limit: 100 }),
        enabled: canManage,
    });
    const assignmentQueries = useQueries({
        queries: coops.map((c) => ({
            queryKey: ["broiler", b.user?.id, c.id, "assignments"],
            queryFn: () => readData<{ assignments: Assignment[] }>(`/api/coops/${c.id}/assignments`),
            enabled: canManage,
        })),
    });
    const assigned = (coopId: number, userId: number) => {
        const i = coops.findIndex((c) => c.id === coopId);
        return (assignmentQueries[i]?.data?.assignments ?? []).find((a) => a.user_id === userId && !a.revoked_at && yes(a.can_operate));
    };

    const order: Record<MemberRole, number> = { owner: 0, manager: 1, operator: 2, viewer: 3 };
    const list = [...(members.data?.members ?? [])].sort((a, c) => order[a.role] - order[c.role] || a.name.localeCompare(c.name));

    async function run(action: () => Promise<unknown>) {
        try {
            await action();
            await b.refresh();
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        }
    }

    async function remove(m: Member) {
        const ok = await Swal.fire({
            title: `Keluarkan ${m.name} dari ${farm.name}?`,
            text: "Akses ke semua kandang di lahan ini dicabut.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, keluarkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (ok.isConfirmed) await run(() => writeData("delete", `/api/farms/${farm.id}/members/${m.user_id}`));
    }

    function toggleAssignment(coopId: number, m: Member, on: boolean) {
        return run(() => on
            ? writeData("put", `/api/coops/${coopId}/assignments`, { user_id: m.user_id, can_operate: true, relay_operate: false })
            : writeData("delete", `/api/coops/${coopId}/assignments/${m.user_id}`));
    }

    return (
        <section className="rounded-2xl border border-[#EAEAEA]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0F0] px-4 py-3.5">
                <div className="min-w-0">
                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                        {farm.name}
                        {farm.member_role && <span className={`ml-2 rounded-full px-2 py-0.5 font-inter text-[11px] font-medium ${ROLE_BADGE[farm.member_role as MemberRole] ?? ROLE_BADGE.viewer}`}>{ROLE_LABEL[farm.member_role as MemberRole] ?? farm.member_role}</span>}
                    </p>
                    <p className="flex items-center gap-1 truncate font-inter text-xs text-[#999]">
                        <MapPin size={11} /> {farm.location_text || "Lokasi belum diisi"} · {coops.length}/{MAX_KANDANG_PER_LAHAN} kandang
                    </p>
                </div>
                <div className="flex gap-2">
                    {canManage && (
                        <button onClick={() => setAdding(true)} suppressHydrationWarning className="flex items-center gap-1 rounded-xl border border-[#EAEAEA] px-3 py-1.5 font-inter text-xs font-medium text-[#7B1113] transition hover:bg-[#F8F8F8]">
                            <Plus size={13} /> Anggota
                        </button>
                    )}
                    {isOwner && (
                        <button onClick={onEdit} title="Ubah lahan" suppressHydrationWarning className="rounded-xl p-2 text-[#666] transition hover:bg-[#F0F0F0]">
                            <Pencil size={15} />
                        </button>
                    )}
                </div>
            </div>

            {!canManage ? (
                <p className="px-4 py-3 font-inter text-xs text-[#999]">Daftar tim hanya terlihat oleh pemilik dan admin lahan.</p>
            ) : members.isLoading ? (
                <div className="m-4 h-14 animate-pulse rounded-xl bg-[#F8F8F8]" />
            ) : members.isError ? (
                <p className="px-4 py-3 font-inter text-sm text-red-600">Daftar anggota belum bisa dimuat.</p>
            ) : (
                <ul className="divide-y divide-[#F0F0F0]">
                    {list.map((m) => {
                        const self = m.user_id === b.user?.id;
                        const editable = !self && m.role !== "owner" && (isOwner || m.role === "operator" || m.role === "viewer");
                        return (
                            <li key={m.user_id} className="px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="min-w-0 truncate font-poppins text-sm font-semibold text-[#2F2F2F]">
                                        {m.name} {self && <span className="font-inter text-xs font-normal text-[#999]">(Anda)</span>}
                                    </p>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {editable ? (
                                            <select
                                                title="Peran"
                                                value={m.role}
                                                onChange={(e) => run(() => writeData("patch", `/api/farms/${farm.id}/members/${m.user_id}`, { role: e.target.value }))}
                                                className="rounded-lg border border-[#EAEAEA] bg-white px-2 py-1 font-inter text-xs outline-none focus:border-[#7B1113]"
                                            >
                                                {(isOwner ? (["manager", "operator", "viewer"] as const) : (["operator", "viewer"] as const)).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                                            </select>
                                        ) : (
                                            <span className={`rounded-full px-2 py-0.5 font-inter text-[11px] font-medium ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
                                        )}
                                        {editable && (
                                            <button onClick={() => remove(m)} title="Keluarkan dari lahan" suppressHydrationWarning className="rounded-xl p-2 text-red-500 transition hover:bg-red-50">
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {m.role === "operator" && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {coops.length === 0 && <span className="font-inter text-xs text-[#999]">Belum ada kandang di lahan ini.</span>}
                                        {coops.map((c) => {
                                            const on = Boolean(assigned(c.id, m.user_id));
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleAssignment(c.id, m, !on)}
                                                    aria-pressed={on}
                                                    suppressHydrationWarning
                                                    className={`rounded-full border px-3 py-1 font-inter text-xs transition ${on ? "border-green-200 bg-green-50 text-green-700" : "border-[#EAEAEA] text-[#777] hover:bg-[#F8F8F8]"}`}
                                                >
                                                    Kandang {c.code}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {adding && (
                <AddMemberModal
                    farm={farm}
                    roles={isOwner ? ["manager", "operator", "viewer"] : ["operator", "viewer"]}
                    onClose={() => setAdding(false)}
                    onSubmit={async (userId, role) => {
                        await run(() => writeData("post", `/api/farms/${farm.id}/members`, { user_id: userId, role }));
                        setAdding(false);
                    }}
                />
            )}
        </section>
    );
}

function FarmFormModal({ farm, onClose, onSubmit }: { farm: Farm | null; onClose: () => void; onSubmit: (body: { name: string; location_text: string | null }) => Promise<void> }) {
    const [name, setName] = useState(farm?.name ?? "");
    const [location, setLocation] = useState(farm?.location_text ?? "");
    const [loading, setLoading] = useState(false);
    return (
        <ModalShell
            title={farm ? "Ubah Lahan" : "Tambah Lahan"}
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton
                        loading={loading}
                        disabled={!name.trim()}
                        onClick={async () => {
                            setLoading(true);
                            try { await onSubmit({ name: name.trim(), location_text: location.trim() || null }); } finally { setLoading(false); }
                        }}
                    >
                        Simpan
                    </PrimaryButton>
                </>
            }
        >
            <Field label="Nama lahan" required>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Lahan Tabanan" suppressHydrationWarning className={inputClass} />
            </Field>
            <Field label="Lokasi">
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="cth. Desa Marga, Tabanan" suppressHydrationWarning className={inputClass} />
            </Field>
            {!farm && <p className="font-inter text-xs text-[#999]">Anda menjadi pemilik lahan baru. Tarif energi bisa diatur di kartu Tarif Energi.</p>}
        </ModalShell>
    );
}

function AddMemberModal({ farm, roles, onClose, onSubmit }: { farm: Farm; roles: MemberRole[]; onClose: () => void; onSubmit: (userId: number, role: MemberRole) => Promise<void> }) {
    const [userId, setUserId] = useState("");
    const [role, setRole] = useState<MemberRole>(roles.includes("operator") ? "operator" : roles[0]);
    const [loading, setLoading] = useState(false);
    const valid = Number(userId) > 0;
    return (
        <ModalShell
            title="Tambah Anggota"
            subtitle={farm.name}
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton
                        loading={loading}
                        disabled={!valid}
                        onClick={async () => {
                            setLoading(true);
                            try { await onSubmit(Number(userId), role); } finally { setLoading(false); }
                        }}
                    >
                        Tambahkan
                    </PrimaryButton>
                </>
            }
        >
            <Field label="ID akun" required hint="Akun harus sudah terdaftar. Minta anggota melihat ID akunnya di menu Pengaturan.">
                <input type="number" min={1} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="cth. 12" suppressHydrationWarning className={inputClass} />
            </Field>
            <Field label="Peran" required>
                <select title="Peran" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className={inputClass}>
                    {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
            </Field>
            <p className="font-inter text-xs text-[#999]">Operator kandang perlu ditugaskan ke kandang setelah ditambahkan.</p>
        </ModalShell>
    );
}
