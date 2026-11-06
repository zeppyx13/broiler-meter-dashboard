import axios from "axios";
import { clearAuth, getToken } from "./auth";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
    },
});

api.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
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
