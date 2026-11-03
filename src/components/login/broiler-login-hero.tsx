"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
    Zap,
    Newspaper,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    TrendingDown,
    ShieldAlert,
    Radio,
    Clock,
} from "lucide-react";

export type BroilerArticleSlide = {
    url: string;
    rubrik: string;
    edition: string;
    headline: string;
    lead: string;
    reference: string;
    institution: string;
    metricLabel: string;
    metricValue: string;
    iconType: "zap" | "trending" | "shield" | "radio";
};

export const BROILER_SLIDES: BroilerArticleSlide[] = [
    {
        url: "/backgrounds/broiler-grower-house.jpg",
        rubrik: "LAPORAN KHUSUS • OTOMASI IKLIM MIKRO",
        edition: "Warta Riset Broiler Modern",
        headline:
            "Modernisasi Kandang Close-House: Otomasi Iklim Mikro dan Jalur Pakan Terpadu Tekan Beban Puncak Kelistrikan",
        lead:
            "Penerapan sensor suhu dan kelembapan terpadu di area kandang memungkinkan modulasi putaran kipas ventilasi berbasis beban riil. Pendekatan ini menstabilkan indeks performa ayam tanpa pemborosan daya kilowatt-hour.",
        reference:
            "Standar Teknis Budidaya Broiler Komersial & Evaluasi Kebutuhan Daya Tunnel House",
        institution:
            "Ditjen Peternakan & Kesehatan Hewan (PKH) Kementan RI bersama Poultry Science Association (PSA)",
        metricLabel: "Efisiensi Daya Listrik",
        metricValue: "-32% kWh/Siklus",
        iconType: "zap",
    },
    {
        url: "/backgrounds/smart-poultry-solar.jpg",
        rubrik: "INVESTIGASI TEKNOLOGI • ENERGI SURYA AGROTERNAK",
        edition: "Kajian Transisi Energi Terbarukan",
        headline:
            "Pemanfaatan Panel Surya Fotovoltaik di Atap Kandang: Strategi Menangkal Beban Puncak Pendingin di Jam Terik",
        lead:
            "Pembangkitan daya mandiri memasok langsung kebutuhan evaporative pad dan exhaust fan di tengah hari—waktu saat beban pendinginan mencapai titik tertinggi, mengamankan pasokan listrik kritis sekaligus memotong biaya operasional.",
        reference:
            "Studi Kelayakan Solar PV Terdistribusi pada Fasilitas Peternakan Tropis Berkelanjutan",
        institution:
            "Balai Besar Pengujian Mutu dan Sertifikasi Pakan & IEEE Power and Energy Systems",
        metricLabel: "Offset Beban Puncak",
        metricValue: "45% Daya Siang",
        iconType: "trending",
    },
    {
        url: "/backgrounds/poultry-commercial-farm.jpg",
        rubrik: "STUDI KASUS • BIOSAFETY & KESEJAHTERAAN TERNAK",
        edition: "Buletin Manajemen Sirkulasi Udara",
        headline:
            "Sirkulasi Udara Dinamis Tunnel Ventilation Turunkan Akumulasi Gas Amonia dan Lindungi FCR Panen",
        lead:
            "Pengaturan tekanan statis dan laju udara presisi menjaga kadar amonia di bawah ambang batas 15 ppm. Hasilnya, pertumbuhan bobot harian ayam tercapai optimal tanpa perlu mengaktifkan kipas tambahan secara berlebihan.",
        reference:
            "Pedoman Manajemen Lingkungan Unggas Modern & Standar Kualitas Udara Kandang Tertutup",
        institution:
            "Cobb-Vantress & Ross Broiler Management Handbook serta Balai Penelitian Ternak (Balitnak)",
        metricLabel: "Batas Gas Amonia",
        metricValue: "< 15 ppm (Aman)",
        iconType: "shield",
    },
    {
        url: "/backgrounds/smart-green-energy-farm.jpg",
        rubrik: "WARTA DIGITAL • TELEMETRI & MONITORING IOT",
        edition: "Laporan Lapangan Instrumentasi Cerdas",
        headline:
            "Pencatatan Telemetri IoT Real-Time Mitigasi Lonjakan Arus dan Cegah Kegagalan Ventilasi Fatal",
        lead:
            "Sensor digital berbasis Modbus mencatat tegangan, arus, dan faktor daya motor blower secara seketika. Notifikasi dini langsung terpicu sebelum terjadi korsleting atau gangguan sirkulasi udara yang berisiko memicu mortalitas.",
        reference:
            "Implementasi IoT Multi-Node untuk Monitoring Daya dan Peringatan Dini Peternakan Presisi",
        institution:
            "Prosiding Seminar Nasional Instrumentasi Pertanian & Industrial Energy Audit Standards",
        metricLabel: "Kecepatan Respon Alert",
        metricValue: "< 1.5 Detik",
        iconType: "radio",
    },
];

export default function BroilerLoginHero() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Auto rotate every 8.5 seconds unless user hovers
    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % BROILER_SLIDES.length);
        }, 8500);
        return () => clearInterval(interval);
    }, [isPaused]);

    const currentSlide = BROILER_SLIDES[currentIndex];

    return (
        <section
            className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between p-8 xl:p-12 text-white select-none"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Background Photographic Images with Cross-Fade */}
            {BROILER_SLIDES.map((slide, index) => (
                <div
                    key={slide.url}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-105 pointer-events-none"
                        }`}
                >
                    <Image
                        src={slide.url}
                        alt={slide.headline}
                        fill
                        priority={index === 0}
                        className="object-cover"
                    />
                </div>
            ))}

            {/* High-Contrast Editorial Vignette & Tint Overlays */}
            {/* Left to right gradient for readability */}
            <div className="absolute inset-0 bg-linear-to-r from-[#0C0203]/95 via-[#1A0507]/80 to-[#121212]/50" />
            {/* Top to bottom vignette */}
            <div className="absolute inset-0 bg-linear-to-t from-[#080202] via-transparent to-[#0A0203]/80" />
            {/* Subtle warm grain / ambient highlight */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(198,169,113,0.12),transparent_60%)]" />

            {/* TOP BAR: Editorial Publication Masthead */}
            <header className="relative z-10 flex items-center justify-between border-b border-white/15 pb-5">
                <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#C6A971]/40 bg-[#7B1113] shadow-md shadow-black/50">
                        <Image
                            src="/coasther.png"
                            alt="Coasther Broiler Logo"
                            fill
                            sizes="44px"
                            className="object-cover"
                            priority
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-poppins text-xs font-bold tracking-[0.22em] text-[#C6A971] uppercase">
                                COASTHER OBSERVER
                            </span>
                            <span className="h-1 w-1 rounded-full bg-[#C6A971]" />
                            <span className="font-inter text-[11px] font-medium tracking-wide text-white/70">
                                Warta Presisi Kandang
                            </span>
                        </div>
                        <p className="font-inter text-xs text-white/90">
                            Jurnal IoT & Konservasi Energi Broiler
                        </p>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="font-inter text-[11px] font-medium text-emerald-300">
                        Monitoring Aktif 24/7
                    </span>
                </div>
            </header>

            {/* CENTER / BOTTOM: Cohesive Editorial Feature Article Spread */}
            <div className="relative z-10 my-auto py-6">
                <article className="max-w-xl transition-all duration-500">
                    {/* Rubrik / Category Tagline with News Icon */}
                    <div className="flex items-center gap-2 mb-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#7B1113]/85 px-2.5 py-1 font-inter text-[11px] font-bold tracking-wider text-[#FCE09B] border border-[#C6A971]/40 uppercase shadow-sm">
                            <Newspaper className="h-3 w-3 text-[#FCE09B]" />
                            {currentSlide.rubrik}
                        </span>
                        <span className="text-white/40 text-xs">•</span>
                        <span className="font-inter text-xs text-white/70 italic flex items-center gap-1">
                            <Clock className="h-3 w-3 text-white/50" /> {currentSlide.edition}
                        </span>
                    </div>

                    {/* Headline: Editorial serif typography (Lora) */}
                    <h2 className="font-lora text-2xl xl:text-3xl font-bold leading-snug tracking-tight text-white drop-shadow-md">
                        &ldquo;{currentSlide.headline}&rdquo;
                    </h2>

                    {/* Excerpt / Lead Paragraph */}
                    <p className="mt-3.5 font-inter text-sm xl:text-[15px] leading-relaxed text-white/90 antialiased">
                        {currentSlide.lead}
                    </p>

                    {/* Technical Metric Highlight Pill */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-black/45 px-3.5 py-1.5 border border-white/20 backdrop-blur-md">
                            <Zap className="h-4 w-4 text-[#C6A971]" />
                            <span className="font-inter text-xs text-white/70">
                                {currentSlide.metricLabel}:
                            </span>
                            <span className="font-poppins text-xs font-bold text-emerald-300">
                                {currentSlide.metricValue}
                            </span>
                        </div>
                    </div>

                    {/* Scientific Reference / Citation Block (Gaya Rujukan & Pemberitaan Resmi) */}
                    <div className="mt-5 rounded-2xl border border-white/15 bg-[#120305]/75 p-4 backdrop-blur-md shadow-xl">
                        <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 rounded-lg bg-[#C6A971]/15 p-1.5 border border-[#C6A971]/30 text-[#C6A971] shrink-0">
                                <BookOpen className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-inter text-[11px] font-semibold uppercase tracking-wider text-[#C6A971]">
                                    Rujukan Teknis & Kajian Lapangan:
                                </p>
                                <p className="font-inter text-xs leading-relaxed text-white/85">
                                    {currentSlide.reference}
                                </p>
                                <p className="font-inter text-[11px] text-white/60 pt-0.5">
                                    Sumber Otoritas: <span className="text-white/80 font-medium">{currentSlide.institution}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </article>
            </div>

            {/* FOOTER: Minimalist Editorial Pagination & Timeline (NO Thumbnails) */}
            <footer className="relative z-10 border-t border-white/15 pt-4">
                <div className="flex items-center justify-between">
                    {/* Editorial Slide Counter & Step Indicator */}
                    <div className="flex items-center gap-3">
                        <span className="font-lora text-sm font-semibold tracking-wider text-[#C6A971]">
                            {String(currentIndex + 1).padStart(2, "0")} <span className="text-white/40 font-normal">/</span> {String(BROILER_SLIDES.length).padStart(2, "0")}
                        </span>

                        {/* Interactive Minimalist Progress Bars */}
                        <div className="flex items-center gap-1.5">
                            {BROILER_SLIDES.map((_, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => setCurrentIndex(index)}
                                    aria-label={`Buka slide ${index + 1}`}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex
                                            ? "w-8 bg-[#C6A971]"
                                            : "w-2 bg-white/30 hover:bg-white/60"
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() =>
                                setCurrentIndex(
                                    (prev) => (prev - 1 + BROILER_SLIDES.length) % BROILER_SLIDES.length
                                )
                            }
                            aria-label="Slide sebelumnya"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-white/80 transition hover:bg-[#7B1113] hover:text-white hover:border-[#C6A971]"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setCurrentIndex((prev) => (prev + 1) % BROILER_SLIDES.length)
                            }
                            aria-label="Slide selanjutnya"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-white/80 transition hover:bg-[#7B1113] hover:text-white hover:border-[#C6A971]"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                    <span>Liputan Berbasis Data Pengukuran IoT Broiler</span>
                    <span>Arahkan kursor untuk menjeda putaran</span>
                </div>
            </footer>
        </section>
    );
}
