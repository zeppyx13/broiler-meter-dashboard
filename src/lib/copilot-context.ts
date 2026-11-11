// Konteks singkat kondisi peternakan yang disisipkan ke setiap pertanyaan Copilot,
// supaya jawabannya spesifik ke kandang peternak (bukan saran umum).

import type { KandangSnapshot } from "@/lib/kandang-snapshot";
import type { LoggedAlert } from "@/lib/alert-log";

export const COPILOT_ASK_EVENT = "coasther:ask-copilot";

/** Pertanyaan cepat saat peternak sedang membuka detail satu kandang. */
export const KANDANG_QUESTIONS = [
    "Bagaimana kondisi kandang ini?",
    "Kenapa air minum turun hari ini?",
    "Apa yang perlu saya lakukan sekarang?",
];

/** Buka Copilot melayang; bila ada pertanyaan, langsung dikirim. */
export function askCopilot(question?: string, coopId?: number) {
    window.dispatchEvent(new CustomEvent(COPILOT_ASK_EVENT, { detail: { question, coopId } }));
}

/** Id kandang dari URL halaman detail (/dashboard/kamar/<id>), atau null. */
export function focusRoomIdFromPath(pathname: string | null): number | null {
    const match = pathname?.match(/^\/dashboard\/kamar\/(\d+)/);
    return match ? Number(match[1]) : null;
}

/** Rincian satu kandang yang sedang dibuka — Copilot menjawab dengan fokus ke kandang ini. */
function describeFocus(s: KandangSnapshot): string[] {
    const { insights } = s;
    const lines = [`Pertanyaan ini tentang Kandang ${s.room.number} (halaman yang sedang dibuka peternak).`];
    if (insights.waterPerBirdPace != null) {
        const dev = insights.waterDeviation;
        lines.push(`- Laju air hari ini ${insights.waterPerBirdPace.toFixed(3)} L/ekor/hari${dev ? ` (${dev.pct >= 0 ? "+" : ""}${dev.pct.toFixed(0)}% dari pola hari umur)` : ""}.`);
    }
    if (insights.actualPowerKw != null) {
        const dev = insights.powerDeviation;
        lines.push(`- Daya terukur ${insights.actualPowerKw.toFixed(2)} kW${dev ? ` (${dev.pct >= 0 ? "+" : ""}${dev.pct.toFixed(0)}% dari daya seharusnya)` : ""}.`);
    }
    if (s.live) lines.push(`- Tegangan ${s.live.voltage?.toFixed(0) ?? "belum tersedia"} V, PF ${s.live.pf?.toFixed(2) ?? "belum tersedia"}, debit outlate tandon ${s.live.flow_rate_lpm?.toFixed(2) ?? "belum tersedia"} L/menit. Sumber REAL.`);
    insights.alerts.forEach((a) => lines.push(`- Peringatan [${a.tier}]: ${a.title} — ${a.detail}`));
    return lines;
}

export function buildFarmContext(snapshots: KandangSnapshot[], alerts: LoggedAlert[], focusRoomId?: number | null): string {
    if (snapshots.length === 0) return "";
    const focus = focusRoomId != null ? snapshots.find((s) => s.room.id === focusRoomId) : undefined;

    const lines = snapshots.map((s) => {
        const parts = [`Kandang ${s.room.number}`];
        if (s.cycle && s.ageDays != null) {
            parts.push(`siklus hari ke-${s.ageDays} dari target ${s.harvestTargetDays}`);
            if (s.populationNow != null) parts.push(`${s.populationNow} ekor`);
        } else {
            parts.push("istirahat");
        }
        parts.push(s.online ? "heartbeat perangkat REAL online" : "heartbeat perangkat REAL belum online");
        parts.push("REAL");
        if (s.live?.power != null) parts.push(`daya panel ${(s.live.power / 1000).toFixed(2)} kW`);
        if (s.expectedPowerKw != null) parts.push(`daya seharusnya ${s.expectedPowerKw.toFixed(2)} kW`);
        if (s.todayUsage.waterTodayLiter != null) parts.push(`air inlet hari ini ${Math.round(s.todayUsage.waterTodayLiter)} L`);
        return `- ${parts.join(", ")}`;
    });

    const important = alerts.filter((a) => a.tier !== "info").slice(0, 8);
    const alertLines = important.map((a) => `- [${a.tier}] Kandang ${a.roomNumber}: ${a.title} — ${a.detail}`);

    return [
        ...(focus ? [...describeFocus(focus), ""] : []),
        "Konteks peternakan saat ini (data dashboard):",
        ...lines,
        alertLines.length > 0 ? "Peringatan aktif:" : snapshots.some((s) => !s.guardAvailable) ? "Evaluasi Guard belum tersedia pada sebagian kandang." : "Tidak ada peringatan kritis/waspada yang tercatat.",
        ...alertLines,
    ].join("\n");
}
