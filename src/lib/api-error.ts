import { isAxiosError } from "axios";

/** Pesan error dari backend (`{ message }`), lalu pesan JS, lalu teks cadangan. */
export function apiErrorMessage(err: unknown, fallback = "Terjadi kesalahan."): string {
    if (isAxiosError<{ message?: string; errors?: { path?: string; message?: string }[] }>(err)) {
        const body = err.response?.data;
        if (Array.isArray(body?.errors) && body.errors.length) return body.errors.slice(0, 3).map(issue => [issue.path, issue.message].filter(Boolean).join(": ")).join("; ");
        return body?.message || err.message || fallback;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

/** Public registration never displays raw server messages or transport details. */
export function registerErrorMessage(err: unknown): string {
    if (isAxiosError(err)) {
        if (["ECONNABORTED", "ETIMEDOUT"].includes(err.code ?? "")) {
            return "Waktu tunggu habis. Status pendaftaran belum dapat dipastikan. Coba masuk sebelum mendaftar lagi.";
        }
        if (!err.response) {
            return "Tidak dapat terhubung ke server. Periksa koneksi Anda. Jika sudah mengirim, coba masuk sebelum mendaftar lagi.";
        }
        const status = err.response.status;
        if (status === 409) return "Email sudah terdaftar. Silakan masuk atau gunakan email lain.";
        if (status === 400 || status === 422) return "Data pendaftaran tidak valid. Periksa kembali isian Anda.";
        if (status === 429) return "Terlalu banyak percobaan pendaftaran. Tunggu beberapa saat lalu coba lagi.";
        if (status >= 500) return "Server sedang bermasalah. Status pendaftaran belum dapat dipastikan. Coba masuk sebelum mendaftar lagi.";
    }
    return "Pendaftaran belum dapat dikonfirmasi. Coba masuk sebelum mendaftar lagi.";
}
