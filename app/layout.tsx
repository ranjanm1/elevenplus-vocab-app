import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "11+ Vocab App",
  description: "Vocabulary learning for 11+ exams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50">
        {/* GLOBAL HEADER */}
        <header className="sticky top-0 z-50 border-b bg-green-50 shadow-sm">
          <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-900">
                11+ Vocabulary
              </h1>
              <p className="text-sm text-green-700">
                ElevenPlusSucceed
              </p>
            </div>

            <nav className="flex gap-4 text-sm font-medium text-green-800">
              <Link href="/" className="hover:text-green-900">
                Home
              </Link>
              <Link href="/words" className="hover:text-green-900">
                Words
              </Link>
              <Link href="/quiz" className="hover:text-green-900">
                Quiz
              </Link>
              <Link href="/login" className="hover:text-green-900">
                Login
              </Link>
            </nav>
          </div>
        </header>

        {/* PAGE CONTENT */}
        {children}
      </body>
    </html>
  );
}