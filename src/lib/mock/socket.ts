// Pengganti socket.io-client untuk mode demo. Mendukung bagian API yang dipakai
// dashboard: connect, disconnect, on, off, dan event "connect"/"disconnect".

import type { Socket } from "socket.io-client";
import { demoBus, startTicker } from "./runtime";

type Handler = (...args: unknown[]) => void;

export function createMockSocket(): Socket {
    const handlers = new Map<string, Set<Handler>>();
    let connected = false;

    const fire = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((h) => h(...args));
    // Telemetri & log diteruskan ke semua pendengar. Satu komponen yang memanggil
    // disconnect() tidak memutus data komponen lain (socket ini dipakai bersama).
    ["telemetry_update", "iot_log"].forEach((event) => demoBus.on(event, (...args) => fire(event, ...args)));

    const socket = {
        get connected() {
            return connected;
        },
        connect() {
            startTicker();
            if (!connected) {
                connected = true;
                setTimeout(() => fire("connect"), 50);
            }
            return socket;
        },
        disconnect() {
            if (connected) {
                connected = false;
                fire("disconnect", "io client disconnect");
            }
            return socket;
        },
        on(event: string, handler: Handler) {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event)!.add(handler);
            return socket;
        },
        off(event?: string, handler?: Handler) {
            if (!event) handlers.clear();
            else if (!handler) handlers.delete(event);
            else handlers.get(event)?.delete(handler);
            return socket;
        },
        emit() {
            return socket;
        },
    };
    return socket as unknown as Socket;
}
