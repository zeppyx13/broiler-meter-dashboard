"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Zap, Activity, Sun, ShieldCheck, ChevronRight } from "lucide-react";

export type BroilerBackground = {
    url: string;
    tag: string;
    title: string;
    description: string;
    credit: string;
    metric: string;
};

export const BROILER_BACKGROUNDS: BroilerBackground[] = [
    {
        url: "/backgrounds/broiler-grower-house.jpg",
        tag: "Close-House Interior",
        title: "Kandang Broiler Modern Close-House",
        description:
            "Sistem otomasi jalur pakan, pencahayaan LED terarah, dan pengatur iklim kandang otomatis.",
        credit: "USDA Commercial Poultry Facility",
        metric: "99.2% Uptime Iklim & Sensor",
    },
    {
        url: "/backgrounds/smart-poultry-solar.jpg",
        tag: "Solar Energy Farm",
        title: "Peternakan Cerdas Energi Surya",
        description:
            "Integrasi pembangkit surya untuk menyuplai blower ventilasi kandang ayam secara hemat energi.",
        credit: "Smart Agri-Solar Facility",
        metric: "Hemat Daya Listrik hingga 38%",
    },
    {
        url: "/backgrounds/poultry-commercial-farm.jpg",
        tag: "Commercial Operation",
        title: "Monitoring Lingkungan & Sirkulasi",
        description:
            "Pemantauan real-time sirkulasi udara, kelembapan, dan konsumsi air minum ayam broiler.",
        credit: "Commercial Broiler Housing",
        metric: "Sirkulasi Udara Terstandarisasi",
    },
    {
        url: "/backgrounds/smart-green-energy-farm.jpg",
        tag: "Clean Energy IoT",
        title: "Infrastruktur Energi Terbarukan",
        description:
            "Pemantauan parameter daya listrik per kandang secara presisi melalui meteran pintar IoT.",
        credit: "Green Agricultural Energy",
        metric: "Monitoring Tegangan & kWh Real-Time",
    },
];

export default function BroilerLoginHero() {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto rotate every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % BROILER_BACKGROUNDS.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const currentBg = BROILER_BACKGROUNDS[currentIndex];

    return (
        <section className="relative hidden overflow-hidden lg:block">
            {/* Background Images with smooth opacity cross-fade */}
            {BROILER_BACKGROUNDS.map((bg, index) => (
                <div
                    key={bg.url}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
                        }`}
                >
                    <Image
                        src={bg.url}
                        alt={bg.title}
                        fill
                        priority={index === 0}
                        className="object-cover transition-transform duration-7000 ease-out"
                    />
                </div>
            ))}

            {/* Cinematic Gradient Overlays (Burgundy / Dark Slate / Vignette) */}
            <div className="absolute inset-0 bg-linear-to-br from-[#1A0304]/85 via-[#3D0A0C]/60 to-[#1A1A1A]/90" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(198,169,113,0.18),transparent_50%)]" />

            {/* Foreground Content */}
            <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
                {/* Header with App Logo Badge */}
                <div>
                    <div className="flex items-center gap-3.5">
                        <div className="relative h-13 w-13 shrink-0 overflow-hidden rounded-2xl border border-white/20 shadow-lg shadow-black/40">
                            <Image
                                src="/coasther.png"
                                alt="Coasther Logo"
                                fill
                                sizes="52px"
                                className="object-cover"
                                priority
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-poppins text-xs font-bold tracking-[0.25em] text-[#C6A971]">
                                    COASTHER SMART IOT
                                </p>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-sm border border-emerald-500/30">
                                    <Zap className="h-2.5 w-2.5 fill-emerald-300" /> Broiler Energy
                                </span>
                            </div>
                            <h2 className="font-poppins text-lg font-bold text-white">
                                Broiler Energy & Smart Coop
                            </h2>
                        </div>
                    </div>

                    <h1 className="mt-8 max-w-lg font-poppins text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md">
                        Monitoring Hemat Energi Kandang Ayam Broiler Berbasis IoT
                    </h1>

                    <p className="mt-4 max-w-md font-inter text-sm leading-relaxed text-white/90">
                        Otomasi pemantauan daya listrik blower, pendingin evaporatif, pemanas, dan meteran air minum ternak secara akurat dan efisien.
                    </p>
                </div>

                {/* Bottom Info Card & Background Selector */}
                <div className="space-y-4">
                    {/* Active Background Card */}
                    <div className="rounded-3xl border border-white/20 bg-black/40 p-5 backdrop-blur-md shadow-2xl transition-all duration-500">
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C6A971]/20 px-3 py-1 font-inter text-xs font-semibold text-[#FCE09B] border border-[#C6A971]/30">
                                <Activity className="h-3.5 w-3.5 text-[#FCE09B]" /> {currentBg.tag}
                            </span>
                            <span className="font-inter text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                                {currentBg.metric}
                            </span>
                        </div>

                        <h3 className="mt-3 font-poppins text-xl font-bold text-white">
                            {currentBg.title}
                        </h3>

                        <p className="mt-1 font-inter text-xs leading-5 text-white/80">
                            {currentBg.description}
                        </p>

                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                            <p className="font-inter text-[11px] text-white/60">
                                📷 {currentBg.credit}
                            </p>
                            <span className="text-[11px] text-[#C6A971] flex items-center gap-1">
                                Smart Agriculture <ChevronRight className="h-3 w-3" />
                            </span>
                        </div>
                    </div>

                    {/* Background Selector Thumbnails */}
                    <div className="flex items-center justify-between rounded-2xl bg-black/30 p-2 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center gap-2">
                            {BROILER_BACKGROUNDS.map((bg, index) => (
                                <button
                                    key={bg.url}
                                    type="button"
                                    onClick={() => setCurrentIndex(index)}
                                    className={`group relative h-10 w-16 overflow-hidden rounded-lg border transition-all duration-300 ${index === currentIndex
                                            ? "border-[#C6A971] ring-2 ring-[#C6A971]/50 scale-105"
                                            : "border-white/20 opacity-60 hover:opacity-100"
                                        }`}
                                    title={bg.title}
                                >
                                    <Image
                                        src={bg.url}
                                        alt={bg.title}
                                        fill
                                        sizes="64px"
                                        className="object-cover"
                                    />
                                    {index === currentIndex && (
                                        <div className="absolute inset-0 bg-[#7B1113]/30" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="pr-2 font-inter text-[11px] text-white/70">
                            Foto {currentIndex + 1} dari {BROILER_BACKGROUNDS.length}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
