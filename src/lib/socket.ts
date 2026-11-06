import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Koneksi Socket.IO utama (subscribe per kandang dengan JWT) dikelola BroilerProvider.
export const socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
});
