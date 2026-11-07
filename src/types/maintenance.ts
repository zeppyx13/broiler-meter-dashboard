import type { DeviceRow, RelayRow } from "@/components/broiler/operations/shared";

export const maintenanceCommands = ["status", "sync_ntp", "reboot", "clear_buf", "reset_nvs"] as const;
export type MaintenanceCommand = typeof maintenanceCommands[number];
export type CommandCapability = {
    allowed: boolean;
    reason: string;
    explanation: string;
    prerequisites: string[];
    confirmation_phrase: string | null;
    acceptance: { accepted: boolean; evidence_reference?: string; recorded_at?: string; binding_matches?: boolean } | null;
};
export type MaintenanceDevice = DeviceRow & { command_capabilities?: Partial<Record<MaintenanceCommand, CommandCapability>> };
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
    state: string;
    generated_at: string;
    devices: MaintenanceDevice[];
    relays: RelayRow[];
    recent_requests?: MaintenanceRequest[];
    capabilities: { status_read?: boolean; schema_ready?: boolean; acceptance_manage?: boolean; commands?: Partial<Record<MaintenanceCommand, CommandCapability>> };
    actions_executed: false;
};
