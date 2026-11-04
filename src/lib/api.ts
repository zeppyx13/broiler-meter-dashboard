import axios from "axios";
import { getToken } from "./auth";
import { USE_MOCK_API } from "./mock/config";
import { mockAdapter } from "./mock/adapter";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
    },
    // Mode demo: request dijawab backend tiruan di browser (lihat src/lib/mock).
    ...(USE_MOCK_API ? { adapter: mockAdapter } : {}),
});

// auto attach token
api.interceptors.request.use((config) => {
    const token = getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
