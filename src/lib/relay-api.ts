import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type RelayCommand = "relay_on" | "relay_off";

/** Endpoint yang sama dengan modul Alat IoT. */
export async function sendRelayCommand(roomId: number, command: RelayCommand) {
    const token = getToken();
    const response = await api.post(
        `/api/iot/relay/${roomId}`,
        { command },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    return response.data;
}
