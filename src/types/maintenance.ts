import type { DeviceRow, RelayRow } from "@/components/broiler/operations/shared";

export const maintenanceCommands = ["status", "sync_ntp", "reboot", "clear_buf", "reset_nvs"] as const;
export type MaintenanceCommand = typeof maintenanceCommands[number];
export const acceptanceCommands = ["status", "sync_ntp", "reboot"] as const;
export type AcceptanceCommand = typeof acceptanceCommands[number];
export type HardwareAcceptance = {
    accepted: boolean;
    binding_matches: boolean;
    actor_id: number;
    recorded_at: string;
    evidence_reference: string;
};
export type AcceptanceInput = {
    device_id: number;
    command: AcceptanceCommand;
    accepted: boolean;
    request_id: string;
    evidence_reference: string;
    note: string;
    confirmation?: string;
};
export type AcceptanceResult = { acceptance: HardwareAcceptance; replayed: boolean };
export type CommandCapability = {
    allowed: boolean;
    reason: string;
    explanation: string;
    prerequisites: string[];
    confirmation_phrase: string | null;
    acceptance: HardwareAcceptance | null;
};
export type MaintenanceDevice = DeviceRow & { coop_id: number; command_capabilities?: Partial<Record<MaintenanceCommand, CommandCapability>> };
export type MaintenanceRequest = {
    id: number;
    request_id: string;
    coop_id: number;
    device_id: number;
    command: MaintenanceCommand;
    status: string;
    requested_at: string;
    published_at?: string | null;
    timeout_at?: string | null;
    failure_reason?: string | null;
    observation?: { received_at?: string; result?: string; correlated?: false } | null;
    executed: false;
    device_acknowledged: false;
    physical_state_confirmed: false;
};
export type MaintenanceResult = { request: MaintenanceRequest; capability?: CommandCapability };
export type MaintenanceStatus = {
    coop_id: number;
    source: "real" | "simulation";
    state: string;
    generated_at: string;
    devices: MaintenanceDevice[];
    relays: RelayRow[];
    recent_requests?: MaintenanceRequest[];
    capabilities: { status_read?: boolean; schema_ready?: boolean; acceptance_manage?: boolean; commands?: Partial<Record<MaintenanceCommand, CommandCapability>> };
    actions_executed: false;
};
