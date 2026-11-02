type SummaryItemProps = {
    label: string;
    value: string;
};

export default function SummaryItem({
    label,
    value,
}: SummaryItemProps) {
    return (
        <div className="flex items-center justify-between rounded-2xl bg-[#F8F8F8] px-4 py-3">
            <span className="font-inter text-sm text-[#666]">{label}</span>
            <span className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                {value}
            </span>
        </div>
    );
}