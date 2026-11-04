"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, User } from "lucide-react";
import Swal from "sweetalert2";
import { getUser, getToken, setAuth } from "@/lib/auth";
import { updateTenant } from "@/lib/tenant-api";
import { apiErrorMessage } from "@/lib/api-error";

type ProfileUser = {
    id: number | string;
    name?: string;
    email?: string;
    phone?: string | null;
    role?: string;
};

export default function PeternakProfileCard() {
    const [user, setUser] = useState<ProfileUser | null>(null);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const current = getUser();
        setUser(current);
        setName(current?.name ?? "");
        setPhone(current?.phone ?? "");
    }, []);

    async function handleSave() {
        if (!user) return;
        try {
            setLoading(true);
            await updateTenant(Number(user.id), { name, phone });
            const updatedUser = { ...user, name, phone };
            const token = getToken();
            if (token) setAuth(token, updatedUser);
            setUser(updatedUser);
            Swal.fire({ icon: "success", title: "Profil diperbarui", timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Gagal menyimpan",
                text: apiErrorMessage(err),
                confirmButtonColor: "#7B1113",
            });
        } finally {
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
                Satu website COASTHER untuk satu peternak. Data ini merepresentasikan akun yang sedang login.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Nama</label>
                    <input
                        type="text"
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
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="08xx..."
                        suppressHydrationWarning
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    />
                </div>
                <div>
                    <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Role</label>
                    <input
                        type="text"
                        value={user?.role ?? "-"}
                        disabled
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#F0F0F0] px-4 py-3 font-inter text-sm text-[#999] outline-none"
                    />
                </div>
            </div>

            <div className="mt-5 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading || !user}
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
