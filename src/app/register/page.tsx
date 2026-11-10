import Link from "next/link";
import AuthPageLayout from "@/components/login/auth-page-layout";
import RegisterForm from "@/components/login/registerform";

export default function RegisterPage() {
    return (
        <AuthPageLayout>
            <h1 className="font-poppins text-2xl font-bold text-[#2F2F2F] sm:text-3xl">Daftar Akun</h1>
            <p className="mt-2 mb-8 font-inter text-sm leading-relaxed text-[#666]">
                Buat akun COASTHER untuk mulai menggunakan dashboard.
            </p>
            <RegisterForm />
            <p className="mt-5 text-center font-inter text-sm text-[#666]">
                Sudah punya akun? <Link href="/" className="font-semibold text-[#7B1113] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7B1113]">Masuk</Link>
            </p>
        </AuthPageLayout>
    );
}
