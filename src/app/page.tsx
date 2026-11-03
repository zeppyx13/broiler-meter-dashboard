import Image from "next/image";
import LoginForm from "@/components/login/loginform";
import BroilerLoginHero from "@/components/login/broiler-login-hero";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#2F2F2F] lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-full lg:min-h-0 lg:grid-cols-2">
        <BroilerLoginHero />

        <section className="flex items-center justify-center overflow-y-auto px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-[#EAEAEA]">
                <Image src="/coasther.png" alt="Logo Coasther" fill sizes="44px" className="object-cover" priority />
              </div>
              <div>
                <p className="font-poppins text-sm font-bold tracking-[0.2em] text-[#7B1113]">COASTHER</p>
                <p className="font-inter text-xs text-[#999]">Smart Kandang Broiler</p>
              </div>
            </div>

            <h1 className="font-poppins text-2xl font-bold text-[#2F2F2F] sm:text-3xl">
              Masuk ke Dashboard
            </h1>
            <p className="mt-2 mb-8 font-inter text-sm leading-relaxed text-[#666]">
              Pantau kandang, siklus produksi, dan peringatan dini dalam satu tempat.
            </p>

            <LoginForm />

            <p className="mt-8 font-inter text-xs leading-relaxed text-[#999]">
              Pantau juga dari HP lewat aplikasi COASTHER di{" "}
              <a
                href="https://play.google.com/store/apps/details?id=com.coasther.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#7B1113] underline hover:text-[#5A0B0C]"
              >
                Google Play Store
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
