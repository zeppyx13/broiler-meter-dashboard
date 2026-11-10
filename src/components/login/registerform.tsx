"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Swal from "sweetalert2";
import { z } from "zod";
import { register } from "@/lib/auth-api";
import { registerErrorMessage } from "@/lib/api-error";

// Match the backend's registerSchema, including bcrypt's UTF-8 byte limit.
const registerSchema = z.object({
    name: z.string().trim().min(1, "Nama lengkap wajib diisi.").min(2, "Nama lengkap minimal 2 karakter.").max(120, "Nama lengkap maksimal 120 karakter."),
    email: z.string().trim().min(1, "Email wajib diisi.").email("Masukkan alamat email yang valid.").max(190, "Email maksimal 190 karakter.").toLowerCase(),
    phone: z.string().trim().max(30, "Nomor telepon maksimal 30 karakter."),
    password: z.string().min(1, "Password wajib diisi.").min(6, "Password minimal 6 karakter.").refine(value => value.trim().length > 0, "Password tidak boleh hanya berisi spasi.").refine(value => new TextEncoder().encode(value).length <= 72, "Password maksimal 72 byte UTF-8. Kurangi jumlah karakter atau emoji."),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
}).refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi password tidak sama." });

type FormValues = z.input<typeof registerSchema>;
type FieldName = keyof FormValues;
const EMPTY_FORM: FormValues = { name: "", email: "", phone: "", password: "", confirmPassword: "" };
const FIELDS = [
    { name: "name", id: "register-name", label: "Nama lengkap", type: "text", autoComplete: "name", hint: undefined },
    { name: "email", id: "register-email", label: "Email", type: "email", autoComplete: "email", hint: undefined },
    { name: "phone", id: "register-phone", label: "Nomor telepon", type: "tel", autoComplete: "tel", hint: "Opsional, maksimal 30 karakter." },
    { name: "password", id: "register-password", label: "Password", type: "password", autoComplete: "new-password", hint: "Minimal 6 karakter, maksimal 72 byte UTF-8." },
    { name: "confirmPassword", id: "register-confirm-password", label: "Konfirmasi password", type: "password", autoComplete: "new-password", hint: undefined },
] as const;

export default function RegisterForm() {
    const router = useRouter();
    const submitting = useRef(false);
    const errorRef = useRef<HTMLParagraphElement>(null);
    const [form, setForm] = useState<FormValues>(EMPTY_FORM);
    const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
    const [submitError, setSubmitError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [visible, setVisible] = useState({ password: false, confirmPassword: false });

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current) return;
        const formElement = event.currentTarget;
        const result = registerSchema.safeParse(form);
        setSubmitError("");
        if (!result.success) {
            const nextErrors: Partial<Record<FieldName, string>> = {};
            for (const issue of result.error.issues) {
                const field = issue.path[0] as FieldName;
                nextErrors[field] ??= issue.message;
            }
            setErrors(nextErrors);
            const firstField = FIELDS.find(field => nextErrors[field.name]);
            if (firstField) (formElement.elements.namedItem(firstField.name) as HTMLInputElement | null)?.focus();
            return;
        }

        submitting.current = true;
        setIsLoading(true);
        setErrors({});
        try {
            await register(result.data);
        } catch (error) {
            setSubmitError(registerErrorMessage(error));
            submitting.current = false;
            setIsLoading(false);
            requestAnimationFrame(() => errorRef.current?.focus());
            return;
        }

        setForm(EMPTY_FORM);
        setVisible({ password: false, confirmPassword: false });
        await Swal.fire({
            icon: "success",
            title: "Pendaftaran berhasil",
            text: "Akun Anda berhasil dibuat. Silakan masuk dengan akun baru Anda.",
            confirmButtonText: "Masuk",
            confirmButtonColor: "#7B1113",
            allowOutsideClick: false,
            allowEscapeKey: false,
        });
        router.replace("/");
    }

    return (
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading} className="space-y-5">
            {FIELDS.map(field => {
                const passwordField = field.type === "password";
                const isVisible = passwordField && visible[field.name];
                const error = errors[field.name];
                return (
                    <div key={field.name}>
                        <label htmlFor={field.id} className="mb-2 block font-inter text-sm font-medium text-[#2F2F2F]">{field.label}</label>
                        <div className="relative">
                            <input
                                id={field.id}
                                name={field.name}
                                type={passwordField && isVisible ? "text" : field.type}
                                autoComplete={field.autoComplete}
                                autoCapitalize={field.name === "email" ? "none" : undefined}
                                spellCheck={field.name === "email" || passwordField ? false : undefined}
                                required={field.name !== "phone"}
                                disabled={isLoading}
                                value={form[field.name]}
                                onChange={event => {
                                    setForm(current => ({ ...current, [field.name]: event.target.value }));
                                    setErrors(current => ({ ...current, [field.name]: undefined, ...(field.name === "password" ? { confirmPassword: undefined } : {}) }));
                                }}
                                aria-invalid={Boolean(error)}
                                aria-describedby={[field.hint ? `${field.id}-hint` : "", error ? `${field.id}-error` : ""].filter(Boolean).join(" ") || undefined}
                                className={`w-full rounded-2xl border bg-[#FAFAFA] px-4 py-3 font-inter text-sm text-[#2F2F2F] outline-none transition focus:border-[#7B1113] focus:bg-white disabled:opacity-70 ${passwordField ? "pr-12" : ""} ${error ? "border-[#7B1113]" : "border-[#EAEAEA]"}`}
                            />
                            {passwordField && (
                                <button
                                    type="button"
                                    aria-label={`${isVisible ? "Sembunyikan" : "Tampilkan"} ${field.name === "password" ? "password" : "konfirmasi password"}`}
                                    aria-pressed={Boolean(isVisible)}
                                    aria-controls={field.id}
                                    disabled={isLoading}
                                    onClick={() => setVisible(current => ({ ...current, [field.name]: !current[field.name] }))}
                                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#666] transition hover:text-[#7B1113] focus-visible:outline-2 focus-visible:outline-[#7B1113]"
                                >
                                    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            )}
                        </div>
                        {field.hint && <p id={`${field.id}-hint`} className="mt-1.5 font-inter text-xs text-[#777]">{field.hint}</p>}
                        {error && <p id={`${field.id}-error`} role="alert" className="mt-1.5 font-inter text-xs text-[#7B1113]">{error}</p>}
                    </div>
                );
            })}
            {submitError && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-[#7B1113]/20 bg-[#7B1113]/5 p-3 font-inter text-sm text-[#7B1113]">{submitError}</p>}
            <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-4 py-3 font-poppins text-sm font-semibold text-[#C6A971] shadow-[0_8px_20px_rgba(123,17,19,0.22)] transition hover:scale-[1.01] hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7B1113] disabled:cursor-not-allowed disabled:opacity-70"
            >
                {isLoading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
                {isLoading ? "Mendaftarkan..." : "Daftar"}
            </button>
        </form>
    );
}
