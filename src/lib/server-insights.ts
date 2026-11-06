import type { StreamSummary } from "./broiler-api";
import type { KandangAlert, KandangInsights } from "./kandang-insights";
import type { ForecastSnapshot } from "./broiler-queries";

/** Adapt server evidence to the existing cards without running browser Guard/Forecast engines. */
export function serverInsights(selected: StreamSummary | undefined, population: number | undefined, forecast: ForecastSnapshot | undefined, alerts: KandangAlert[]) {
    const future = forecast?.forecasts.filter((f) => f.horizon === "until_harvest") ?? [];
    const value = (metric: string) => future.find((f) => f.metric === metric)?.predicted_value ?? null;
    const waterCost = future.find((f) => f.metric === "water_liters")?.details_json?.estimated_water_cost_idr ?? null;
    const energyCost = value("electricity_cost_idr");
    const water = value("water_liters");
    const insights: Omit<KandangInsights, "actualPowerKw" | "hoursToday"> & { actualPowerKw: number | null; hoursToday: number | null } = {
        hoursToday: null,
        actualPowerKw: selected?.live?.power_w == null ? null : selected.live.power_w / 1000,
        waterPerBirdSoFar: selected?.today?.water_liters != null && population != null && population > 0 ? selected.today.water_liters / population : null,
        waterPerBirdPace: null, waterDeviation: null, powerDeviation: null,
        cycleEnergyCost: selected?.cycle_totals?.electricity_cost_idr ?? null,
        cycleWaterCost: selected?.cycle_totals?.water_cost_idr ?? null,
        energyTodayCost: selected?.today?.electricity_cost_idr ?? null,
        predictedEnergyKwh: value("energy_kwh"),
        predictedWaterM3: water == null ? null : water / 1000,
        predictedCost: energyCost != null && waterCost != null ? energyCost + waterCost : null,
        alerts,
    };
    return insights;
}
