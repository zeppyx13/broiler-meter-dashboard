"use client";

import { Leaf, Lightbulb } from "lucide-react";
import SectionCard from "../section-card";

type Tip = {
    id: number;
    title: string;
    detail: string;
    saving: string;
};

const MOCK_TIPS: Tip[] = [
    {
        id: 1,
        title: "Geser jadwal pemanas 30 menit lebih siang",
        detail: "Suhu lingkungan di jam 05:00–05:30 sudah mendekati target, pemanas bisa dinyalakan lebih lambat.",
        saving: "Hemat ±8% listrik/hari",
    },
    {
        id: 2,
        title: "Periksa nipple minum di Kandang B02",
        detail: "Indikasi rembesan kecil terus-menerus berdasarkan pola debit air malam hari.",
        saving: "Hemat ±12 L air/hari",
    },
    {
        id: 3,
        title: "Matikan 1 titik lampu di jam terang matahari",
        detail: "Intensitas cahaya alami pukul 10:00–15:00 sudah cukup untuk aktivitas ayam.",
        saving: "Hemat ±5% listrik/hari",
    },
    {
        id: 4,
        title: "Bersihkan filter pompa air mingguan",
        detail: "Filter kotor membuat pompa bekerja lebih berat dan boros energi.",
        saving: "Hemat ±3% listrik/minggu",
    },
];

export default function EcoAdvisorSection() {
    return (
        <SectionCard>
            <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-green-50">
                    <Leaf size={18} className="text-green-600" />
                </div>
                <div>
                    <p className="font-inter text-sm text-[#666]">Rekomendasi Efisiensi</p>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Eco-Advisor</h3>
                </div>
            </div>

            <p className="mt-3 rounded-2xl bg-[#FFF8EC] px-4 py-2 font-inter text-xs text-[#9A6B14]">
                Data contoh — menunggu integrasi backend AI
            </p>

            <div className="mt-4 space-y-3">
                {MOCK_TIPS.map((tip) => (
                    <div
                        key={tip.id}
                        className="flex items-start gap-3 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4"
                    >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-50">
                            <Lightbulb size={15} className="text-green-600" />
                        </div>
                        <div className="flex-1">
                            <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{tip.title}</p>
                            <p className="mt-1 font-inter text-xs text-[#666]">{tip.detail}</p>
                            <span className="mt-2 inline-block rounded-full bg-green-100 px-2.5 py-0.5 font-inter text-xs font-medium text-green-700">
                                {tip.saving}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}
