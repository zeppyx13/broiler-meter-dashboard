import { io } from "socket.io-client";
import { USE_MOCK_API } from "./mock/config";
import { createMockSocket } from "./mock/socket";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Mode demo: telemetri & log datang dari simulasi alat di browser.
export const socket = USE_MOCK_API
    ? createMockSocket()
    : io(SOCKET_URL, {
        autoConnect: false,
        transports: ["websocket"],
    });
