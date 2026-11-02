import SectionCard from "./section-card";
import SummaryItem from "./summary-item";

type SummaryCardProps = {
    totalIncome: string;
    items: { label: string; value: string }[];
};

export default function SummaryCard({
    totalIncome,
    items,
}: SummaryCardProps) {
    return (
        <SectionCard>
            <p className="font-inter text-sm text-[#666]">Ringkasan Bulan Ini</p>
            <h3 className="mt-1 font-poppins text-xl font-semibold text-[#2F2F2F]">
                Estimasi Pendapatan
            </h3>

            <div className="mt-6 rounded-3xl bg-[#7B1113] p-5 text-white">
                <p className="font-inter text-sm text-white/80">Total pemasukan</p>
                <h4 className="mt-2 font-poppins text-3xl font-bold text-[#C6A971]">
                    {totalIncome}
                </h4>
                <p className="mt-2 font-inter text-xs text-white/80">
                    Termasuk sewa kamar, air, dan listrik.
                </p>
            </div>

            <div className="mt-5 space-y-3">
                {items.map((item) => (
                    <SummaryItem
                        key={item.label}
                        label={item.label}
                        value={item.value}
                    />
                ))}
            </div>
        </SectionCard>
    );
}