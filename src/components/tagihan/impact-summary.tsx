import { formatRupiah } from "@/lib/broiler-reference";
import { DEVICE_LIFETIME_YEARS, type FarmEconomics } from "@/lib/impact";

const num = (value: number, decimals = 0) => value.toLocaleString("id-ID", { maximumFractionDigits: decimals });
export const impactPercent = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : "−"}${num(Math.abs(value) * 100)}%`;
export const paybackMonths = (value: number | null) => value == null ? "Tidak tercapai" : value < 1 ? "< 1 bulan" : `±${num(value, 1)} bulan`;

export default function ImpactSummary({ economics: e }: { economics: FarmEconomics }) {
    return (
        <div role="region" aria-label="Hasil perhitungan balik modal">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Metric label="Manfaat / tahun" value={formatRupiah(e.benefitPerYear)} sub={`±${num(e.cyclesPerYear, 1)} siklus per tahun`} />
                <Metric label="Biaya investasi" value={formatRupiah(e.investment)} sub="Perangkat untuk seluruh kandang" />
                <Metric label="Biaya tahun pertama" value={formatRupiah(e.investment + e.opexPerYear)} sub={`Operasional ${formatRupiah(e.opexPerYear)} / tahun`} />
                <Metric label="ROI tahun pertama" value={impactPercent(e.roiFirstYear)} sub="Termasuk investasi dan operasional" />
                <Metric label="Balik modal" value={paybackMonths(e.paybackMonths)} sub="Setelah biaya operasional" highlight />
            </div>
            <p className={`mt-3 rounded-2xl px-4 py-3 font-inter text-xs ${e.paybackMonths == null ? "bg-[#FBEDED] text-[#7B1113]" : "bg-[#FAFAFA] text-[#555]"}`}>
                {e.breakEvenPopulation != null
                    ? `Titik impas ±${num(Math.ceil(e.breakEvenPopulation))} ekor per kandang, dengan penyusutan perangkat ${DEVICE_LIFETIME_YEARS} tahun. `
                    : "Titik impas belum dapat dihitung tanpa manfaat per ekor. "}
                {e.paybackMonths == null && (e.investment === 0
                    ? "Tidak ada investasi perangkat untuk dikembalikan."
                    : "Manfaat belum menutup biaya operasional sehingga balik modal tidak tercapai.")}
            </p>
        </div>
    );
}

function Metric({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
    return (
        <div className={`min-w-0 rounded-2xl p-4 ${highlight ? "bg-[#7B1113] text-white" : "bg-[#FAFAFA]"}`}>
            <p className={`font-inter text-xs ${highlight ? "text-white/70" : "text-[#999]"}`}>{label}</p>
            <p className={`mt-1 break-words font-poppins text-xl font-bold ${highlight ? "text-[#C6A971]" : "text-[#2F2F2F]"}`}>{value}</p>
            <p className={`font-inter text-[11px] ${highlight ? "text-white/70" : "text-[#999]"}`}>{sub}</p>
        </div>
    );
}
