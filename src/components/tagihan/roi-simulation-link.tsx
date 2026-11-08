"use client";

import Link from "next/link";
import { Calculator } from "lucide-react";
import { buttonStyle } from "@/components/broiler/ui";

export default function RoiSimulationLink() {
    return (
        <div className="flex justify-end">
            <Link href="/dashboard/tagihan/simulasi" className={`${buttonStyle} w-full gap-2 sm:w-auto`}>
                <Calculator size={16} aria-hidden="true" /> Simulasi Balik Modal
            </Link>
        </div>
    );
}
