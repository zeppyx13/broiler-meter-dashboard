export type DashboardStatsResponse = {
    success: boolean;
    message: string;
    data: {
        totalRooms: number;
        availableRooms: number;
        totalTenants: number;
        activeTenants: number;
        waterUsage: number;
        waterGrowth: number;
        electricityUsage: number;
        electricityStatus: string;
    };
};
export type ChartDataPoint = {
    month: string;      // "2025-09"
    water_used: number; // m³
    elec_used: number;  // kWh
};

export type DashboardChartResponse = {
    success: boolean;
    message: string;
    data: {
        chart: ChartDataPoint[];
    };
};
export type DashboardSummaryResponse = {
    success: boolean;
    message: string;
    data: {
        totalIncome: number;
        occupiedRooms: number;
        totalRooms: number;
        paidInvoices: number;
        unpaidInvoices: number;
        highestUsageRoom: string | null;
    };
};