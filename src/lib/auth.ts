import Cookies from "js-cookie";

const TOKEN_KEY = "coasther_token";
const USER_KEY = "coasther_user";

export function setAuth(token: string, user?: unknown) {
    Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: "Lax" });

    if (user) {
        Cookies.set(USER_KEY, JSON.stringify(user), {
            expires: 7,
            sameSite: "Lax",
        });
    }
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
}