import { isAxiosError } from "axios";

/** Pesan error dari backend (`{ message }`), lalu pesan JS, lalu teks cadangan. */
export function apiErrorMessage(err: unknown, fallback = "Terjadi kesalahan."): string {
    if (isAxiosError<{ message?: string }>(err)) {
        return err.response?.data?.message || err.message || fallback;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}
