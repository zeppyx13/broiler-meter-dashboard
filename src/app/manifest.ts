import type { MetadataRoute } from "next";

// Agar dashboard bisa dipasang di layar utama HP (tampil tanpa address bar).
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Coasther — Smart Kandang Broiler",
        short_name: "Coasther",
        description: "Monitoring air minum dan listrik kandang broiler dengan peringatan dini.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F8F8F8",
        theme_color: "#7B1113",
        lang: "id",
        icons: [
            { src: "/icons/coasther-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/coasther-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
    };
}
