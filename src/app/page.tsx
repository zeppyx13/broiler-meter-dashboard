import Image from "next/image";
import LoginForm from "@/components/login/loginform";
import BroilerLoginHero from "@/components/login/broiler-login-hero";
import { Zap, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#2F2F2F]">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* LEFT: Realistic Broiler Chicken Farm & Smart Energy Hero */}
        <BroilerLoginHero />

        {/* RIGHT: Login Card */}
        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md rounded-[28px] border border-[#EAEAEA] p-8 shadow-[0_10px_35px_rgba(0,0,0,0.08)]">
            {/* Header with App Logo */}
            <div className="mb-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl shadow-md border border-[#EAEAEA]">
                  <Image
                    src="/coasther.png"
                    alt="Coasther Broiler Logo"
                    fill
                    sizes="48px"
                    className="object-cover"
                    priority
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-poppins text-lg font-bold text-[#2F2F2F]">
                      Coasther
                    </h3>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                      <Zap className="h-2.5 w-2.5 fill-emerald-600 text-emerald-600" /> IoT
                    </span>
                  </div>
                  <p className="font-inter text-xs font-semibold tracking-wider text-[#7B1113] uppercase">
                    Smart Broiler Energy
                  </p>
                </div>
              </div>

              <p className="font-inter text-xs uppercase tracking-[0.18em] text-[#7B1113] font-semibold">
                Admin Portal
              </p>

              <h2 className="mt-2 font-poppins text-2xl font-bold sm:text-3xl text-[#2F2F2F]">
                Login ke Dashboard
              </h2>

              <p className="mt-2.5 font-inter text-sm text-[#666] leading-relaxed">
                Kelola pemantauan energi kandang broiler, sensor IoT, dan siklus peternakan Coasther.
              </p>
            </div>

            <LoginForm />

            <div className="mt-8 rounded-2xl bg-[#F8F8F8] p-4 border border-[#EFEFEF]">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#7B1113] shrink-0 mt-0.5" />
                <p className="font-inter text-xs text-[#666] leading-relaxed">
                  Panel admin terenkripsi. Aplikasi monitoring peternak tersedia di{" "}
                  <a
                    href="https://play.google.com/store/apps/details?id=com.coasther.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#7B1113] underline hover:text-[#5A0B0C]"
                  >
                    Google Play Store
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
