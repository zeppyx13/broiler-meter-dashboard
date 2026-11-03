"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SLIDES = [
    { src: "/backgrounds/broiler-grower-house.jpg", caption: "Pantau air minum sejak hari pertama brooding." },
    { src: "/backgrounds/poultry-commercial-farm.jpg", caption: "Konsumsi air per ekor, indikator awal kesehatan ternak." },
    { src: "/backgrounds/broiler-closed-house.jpg", caption: "Kipas mati atau listrik padam terdeteksi dalam hitungan menit." },
];

const INTERVAL_MS = 6000;

export default function BroilerLoginHero() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="relative hidden h-full overflow-hidden bg-[#1A0A0A] lg:block">
            {SLIDES.map((slide, i) => (
                <Image
                    key={slide.src}
                    src={slide.src}
                    alt=""
                    fill
                    sizes="50vw"
                    priority={i === 0}
                    className={`object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
                />
            ))}
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/70 to-transparent" />

            <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-12">
                <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white">
                        <Image src="/coasther.png" alt="Logo Coasther" fill sizes="40px" className="object-cover" priority />
                    </div>
                    <div>
                        <p className="font-poppins text-sm font-bold tracking-[0.2em] text-[#C6A971]">COASTHER</p>
                        <p className="font-inter text-xs text-white/70">Smart Kandang Broiler</p>
                    </div>
                </div>

                <div>
                    <p className="max-w-md font-inter text-base leading-relaxed text-white/90">{SLIDES[index].caption}</p>
                    <div className="mt-4 flex gap-1.5">
                        {SLIDES.map((slide, i) => (
                            <button
                                key={slide.src}
                                type="button"
                                onClick={() => setIndex(i)}
                                aria-label={`Tampilkan gambar ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-[#C6A971]" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
