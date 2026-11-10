import Link from "next/link";
import LoginForm from "@/components/login/loginform";
import AuthPageLayout from "@/components/login/auth-page-layout";

export default function Home() {
  return (
    <AuthPageLayout>
      <h1 className="font-poppins text-2xl font-bold text-[#2F2F2F] sm:text-3xl">
        Masuk ke Dashboard
      </h1>
      <p className="mt-2 mb-8 font-inter text-sm leading-relaxed text-[#666]">
        Pantau kandang, siklus produksi, dan peringatan dini dalam satu tempat.
      </p>

      <LoginForm />

      <p className="mt-5 text-center font-inter text-sm text-[#666]">
        Belum punya akun? <Link href="/register" className="font-semibold text-[#7B1113] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7B1113]">Daftar</Link>
      </p>

      <p className="mt-8 font-inter text-xs text-[#999]">Dashboard web responsif. Notifikasi melalui inbox web dan email sesuai konfigurasi server.</p>
    </AuthPageLayout>
  );
}
