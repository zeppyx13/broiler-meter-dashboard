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
