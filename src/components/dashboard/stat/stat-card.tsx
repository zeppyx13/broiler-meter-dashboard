import type { StatItem } from "@/types/dashboard";

type StatCardProps = {
    item: StatItem;
};

export default function StatCard({ item }: StatCardProps) {
    const Icon = item.icon;

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between">
                <div>
                    <p className="font-inter text-sm text-[#666]">{item.title}</p>
                    <h3 className="mt-2 font-poppins text-3xl font-bold text-[#2F2F2F]">
                        {item.value}
                    </h3>
                    <p className="mt-2 font-inter text-xs text-[#7B1113]">{item.desc}</p>
                </div>

                <div className="rounded-2xl bg-[#7B1113]/10 p-3">
                    <Icon size={20} className="text-[#7B1113]" />
                </div>
            </div>
        </div>
    );
}