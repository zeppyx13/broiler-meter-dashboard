import { api } from "@/lib/api";

export type Tariff = {
    id: number;
    water_rate: number;
    water_free_quota: number;
    electricity_rate: number;
    electricity_free_quota: number;
    late_fee_flat: number;
    updated_at: string;
};

export async function getTariff(): Promise<Tariff> {
    const res = await api.get("/api/tariff");
    return res.data?.data ?? res.data;
}

export async function updateTariff(payload: Partial<Omit<Tariff, "id" | "updated_at">>): Promise<Tariff> {
    const res = await api.put("/api/tariff", payload);
    return res.data?.data ?? res.data;
}