import Image from "next/image";
import Link from "next/link";

const featureColumns = [
  {
    title: "What is the quiz platform?",
    text: "A simple student login area for vocabulary practice, assigned assessments, and steady revision between lessons.",
  },
  {
    title: "Why does it help?",
    text: "Children get short, repeatable practice that supports tuition sessions and helps parents keep learning momentum at home.",
  },
  {
    title: "How does it fit in?",
    text: "The quiz sits inside the wider 11+ Succeed approach, alongside tuition, mock exam preparation, and vocabulary development.",
  },
];

const trustPoints = [
  "5+ years of trust",
  "Tailored stress free learning",
  "Focus on fundamentals",
];

const serviceLinks = [
  "Face-to-face tuition",
  "Mock exams",
  "Vocabulary quiz platform",
  "Tips and tricks",
];

const aboutLinks = [
  "Who we are",
  "Testimonials",
  "Our methodology",
  "Results",
];

export default function Home() {
  return (
    <main className="bg-white">
      <section className="border-b border-[color:var(--line)] bg-white">
        <div className="mx-auto grid max-w-[1900px] lg:grid-cols-2">
          <div className="relative overflow-hidden bg-[color:var(--brand-sky)] px-8 py-16 text-white md:px-14 lg:min-h-[470px] lg:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_30%),linear-gradient(135deg,_rgba(255,255,255,0.16),_rgba(18,66,123,0.22))]" />
            <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:32px_32px]" />

            <div className="relative z-10 mx-auto max-w-md lg:ml-auto lg:mr-12 lg:pt-6">
              <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl">
                11+ vocabulary and mock exam practice
              </h1>

              <p className="mt-6 text-2xl font-extrabold">
                New student platform now live
              </p>

              <p className="mt-4 text-lg leading-8 text-blue-50">
                Access the quiz, revise key vocabulary, and continue the wider
                11+ Succeed journey through one clear homepage.
              </p>

              <p className="mt-4 text-base leading-7 text-blue-50">
                This Vercel version is designed to sit above the existing quiz
                deployment so families land on a proper centre homepage first.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/quiz"
                  className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-bold text-[color:var(--brand-navy)] shadow-sm transition hover:bg-slate-100"
                >
                  Open Quiz
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Student Login
                </Link>
              </div>

              <div className="mt-10 w-full max-w-[270px] rounded-md border border-white/40 bg-white/85 p-3 text-[color:var(--brand-navy)] shadow-sm">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
                  <span>Platform route</span>
                  <span>Live</span>
                </div>
                <div className="rounded bg-slate-100 px-3 py-4 text-sm font-semibold">
                  Homepage at `/`
                </div>
                <div className="mt-2 rounded bg-slate-100 px-3 py-4 text-sm font-semibold">
                  Quiz stays at `/quiz`
                </div>
              </div>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden lg:min-h-[470px]">
            <Image
              src="/home-hero-classroom.svg"
              alt="Classroom-style illustration for the 11+ Succeed homepage"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.02),_rgba(0,0,0,0.18))]" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white/92 px-6 py-3 text-sm font-bold text-[color:var(--brand-navy)] shadow-lg">
              Home for tuition and quiz access
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-6">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 text-center md:grid-cols-3 md:px-8">
          {featureColumns.map((item) => (
            <div key={item.title} className="mx-auto max-w-sm">
              <h2 className="text-sm font-extrabold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-3 text-xs leading-6 text-slate-600 sm:text-sm">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[color:var(--brand-red)] py-8 text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 text-center md:grid-cols-3 md:px-8">
          {trustPoints.map((point) => (
            <div key={point} className="flex flex-col items-center">
              <div className="mb-3 h-4 w-4 rounded-full border border-white/80" />
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] md:text-sm">
                {point}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="services"
        className="bg-[color:var(--brand-cream)] py-10 text-slate-700"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-[1.1fr_1fr_1fr_1fr] md:px-8">
          <div>
            <div className="inline-block border-b-2 border-[color:var(--brand-sky)] pb-1 text-4xl font-extrabold tracking-[-0.05em] text-[color:var(--brand-navy)]">
              11+Succeed
            </div>
          </div>

          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-800">
              Our Services
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {serviceLinks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div id="about">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-800">
              About Us
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {aboutLinks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div id="contact">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-800">
              Contact
            </h3>
            <div className="mt-4 space-y-2 text-sm leading-7">
              <p>11plussucceed@gmail.com</p>
              <p>+44 (0)7553 766386</p>
              <p>www.11plussucceed.com</p>
              <p className="pt-2">
                <Link
                  href="/quiz"
                  className="font-bold text-[color:var(--brand-navy)] underline underline-offset-4"
                >
                  Open the student quiz
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
