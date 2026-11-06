import axios from "axios";
import { clearAuth, getToken } from "./auth";

// Every API caller includes /api; Socket.IO must use the server origin, not that namespace.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "").replace(/\/api$/, "");

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
    },
});

api.interceptors.response.use(response => response, error => {
    const authorization = error.config?.headers?.Authorization;
    // A late 401 from the previous account must not log out a newer session.
    if (error.response?.status === 401 && authorization === `Bearer ${getToken()}` && typeof window !== "undefined") {
        clearAuth();
        window.dispatchEvent(new Event("coasther:unauthorized"));
    }
    return Promise.reject(error);
});

// auto attach token
api.interceptors.request.use((config) => {
    const token = getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
