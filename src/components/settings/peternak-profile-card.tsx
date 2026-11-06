"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, User } from "lucide-react";
import Swal from "sweetalert2";
import { writeData } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { apiErrorMessage } from "@/lib/api-error";

type ProfileUser = {
    id: number | string;
    name?: string;
    email?: string;
    phone?: string | null;
    role?: string;
};

const ROLE_LABEL: Record<string, string> = { owner: "Pemilik", manager: "Admin lahan", operator: "Operator kandang", viewer: "Pemantau" };

export default function PeternakProfileCard() {
    const b = useBroiler();
    const [user, setUser] = useState<ProfileUser | null>(null);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const inFlight = useRef(false);

    useEffect(() => {
        const current = (b.user as ProfileUser | undefined) ?? null;
        setUser(current);
        setName(current?.name ?? "");
        setPhone(current?.phone ?? "");
    }, [b.user]);

    async function handleSave() {
        if (!b.user || inFlight.current) return;
        inFlight.current = true;
        try {
            setLoading(true);
            const result = await writeData<{ user: ProfileUser }>("put", "/api/users/me", { name: name.trim(), phone: phone.trim() || null });
            setUser(result.user);
            await b.refresh();
            Swal.fire({ icon: "success", title: "Profil diperbarui", timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Gagal menyimpan",
                text: apiErrorMessage(err),
                confirmButtonColor: "#7B1113",
            });
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <User size={20} className="text-[#7B1113]" />
                </div>
                <div>
                    <p className="font-inter text-sm text-[#666]">Akun Peternak</p>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Profil Peternak</h3>
                </div>
            </div>

            <p className="mt-3 font-inter text-xs text-[#999]">
                Data akun yang sedang login. Akses ke lahan dan kandang diatur pemilik lahan di bagian Lahan &amp; Tim.
                {user?.id != null && <> ID akun Anda: <span className="font-semibold text-[#555]">{user.id}</span> (dipakai saat ditambahkan ke tim).</>}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Nama</label>
                    <input
                        type="text"
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        suppressHydrationWarning
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    />
                </div>
                <div>
                    <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Email</label>
                    <input
                        type="email"
                        value={user?.email ?? ""}
                        disabled
                        title="Email tidak dapat diubah di sini"
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#F0F0F0] px-4 py-3 font-inter text-sm text-[#999] outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">No. HP</label>
                    <input
                        type="text"
                        maxLength={30}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="08xx..."
                        suppressHydrationWarning
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    />
                </div>
                <div>
                    <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Peran</label>
                    <input
                        type="text"
                        value={user?.role === "admin" ? "Admin sistem" : b.farms.map((f) => `${f.name}: ${ROLE_LABEL[f.member_role ?? ""] ?? f.member_role ?? "-"}`).join(" · ") || "-"}
                        disabled
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#F0F0F0] px-4 py-3 font-inter text-sm text-[#999] outline-none"
                    />
                </div>
            </div>

            <div className="mt-5 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading || !user || name.trim().length < 2}
                    suppressHydrationWarning
                    className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                >
                    {loading && <LoaderCircle size={15} className="animate-spin" />}
                    Simpan Profil
                </button>
            </div>
        </div>
    );
}
