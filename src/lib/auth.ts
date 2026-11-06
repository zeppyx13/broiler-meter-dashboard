import Cookies from "js-cookie";

const TOKEN_KEY = "coasther_token";
const USER_KEY = "coasther_user";

export function setAuth(token: string, user?: unknown, rememberMe = true) {
    Cookies.set(TOKEN_KEY, token, { expires: rememberMe ? 7 : undefined, sameSite: "Lax", secure: typeof location !== "undefined" && location.protocol === "https:" });

    if (user) {
        Cookies.set(USER_KEY, JSON.stringify(user), {
            expires: rememberMe ? 7 : undefined,
            sameSite: "Lax",
            secure: typeof location !== "undefined" && location.protocol === "https:",
        });
    }
    if (typeof window !== "undefined") { try { localStorage.setItem("coasther:session-change", String(Date.now())); } catch {} window.dispatchEvent(new Event("coasther:session")); }
}

export function getToken() {
    return Cookies.get(TOKEN_KEY);
}

export function getUser() {
    const raw = Cookies.get(USER_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearAuth() {
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(USER_KEY);
    if (typeof window !== "undefined") { try { localStorage.setItem("coasther:session-change", String(Date.now())); } catch {} }
}
