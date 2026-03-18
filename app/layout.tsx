import "./globals.css";
import Header from "../components/Header";

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
        <Header />
        {children}
      </body>
    </html>
  );
}