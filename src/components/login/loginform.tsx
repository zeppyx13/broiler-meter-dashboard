"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login } from "@/lib/auth-api";
import { setAuth } from "@/lib/auth";

export default function LoginForm() {
    const router = useRouter();

    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
        rememberMe: false,
    });

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!form.email.trim() || !form.password.trim()) {
            return Swal.fire({
                icon: "warning",
                title: "Form belum lengkap",
                text: "Email dan password wajib diisi.",
                confirmButtonColor: "#7B1113",
            });
        }

        try {
            setIsLoading(true);

            const { token, user } = await login(form);

            if (!["admin", "manager"].includes(user.role)) {
                throw new Error("Akses ditolak");
            }

            setAuth(token, user);

            await Swal.fire({
                icon: "success",
                title: "Login berhasil",
                text: "Selamat datang di dashboard Coasther.",
                confirmButtonColor: "#7B1113",
            });

            router.push("/dashboard");
            router.refresh();
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Terjadi kesalahan saat login.";

            await Swal.fire({
                icon: "error",
                title: "Login gagal",
                text: message,
                confirmButtonColor: "#7B1113",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label
                    htmlFor="email"
                    className="mb-2 block font-inter text-sm font-medium text-[#2F2F2F]"
                >
                    Email
                </label>
                <input
                    id="email"
                    autoComplete="off"
                    type="email"
                    placeholder="admin@coasther.com"
                    value={form.email}
                    onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                    }
                    className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm text-[#2F2F2F] outline-none transition focus:border-[#7B1113] focus:bg-white"
                />
            </div>

            <div>
                <label
                    htmlFor="password"
                    className="mb-2 block font-inter text-sm font-medium text-[#2F2F2F]"
                >
                    Password
                </label>

                <div className="relative">
                    <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                        }
                        autoComplete="off"
                        className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 pr-12 font-inter text-sm text-[#2F2F2F] outline-none transition focus:border-[#7B1113] focus:bg-white"
                    />

                    <button
                        type="button"
                        onClick={() =>
                            setShowPassword((prev) => !prev)
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666] transition hover:text-[#7B1113]"
                    >
                        {showPassword ? (
                            <EyeOff size={18} />
                        ) : (
                            <Eye size={18} />
                        )}
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 font-inter text-[#666]">
                    <input
                        type="checkbox"
                        checked={form.rememberMe}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                rememberMe: e.target.checked,
                            })
                        }
                        className="h-4 w-4 rounded border border-[#D9D9D9]"
                    />
                    Ingat saya
                </label>

                <button
                    type="button"
                    className="font-inter text-[#7B1113] transition hover:opacity-80"
                >
                    Lupa password?
                </button>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-4 py-3 font-poppins text-sm font-semibold text-[#C6A971] shadow-[0_8px_20px_rgba(123,17,19,0.22)] transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
                {isLoading && (
                    <LoaderCircle size={18} className="animate-spin" />
                )}
                {isLoading ? "Memproses..." : "Masuk"}
            </button>
        </form>
    );
}