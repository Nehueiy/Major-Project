import Navbar from '../../components/common/Navbar';
import Hero from '../../components/landing/Hero';
import Features from '../../components/landing/Features';
import AISection from '../../components/ai/AISection';
import DestinationCards from '../../components/destinations/DestinationCards';
import Footer from '../../components/common/Footer';
import { Compass, ShieldCheck, Sparkles, Users } from 'lucide-react';

const highlights = [
  {
    icon: Compass,
    title: 'Plan smarter',
    text: 'Discover destinations, organize itineraries, and keep every trip detail in one place.',
  },
  {
    icon: Sparkles,
    title: 'Travel with AI',
    text: 'Get personalized recommendations, smart budget ideas, and trip support in seconds.',
  },
  {
    icon: ShieldCheck,
    title: 'Travel with confidence',
    text: 'Stay organized with shared plans, expense tracking, and a smoother group experience.',
  },
  {
    icon: Users,
    title: 'Built for groups',
    text: 'Coordinate with friends, split expenses, and make shared travel planning effortless.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <section id="about" className="scroll-mt-24 bg-white px-4 py-20 text-[#2B3E34] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-[rgba(241,245,249,0.8)] bg-[#F8FAFC] p-8 shadow-[0_16px_40px_rgba(43,62,52,0.06)] sm:p-10 lg:p-14">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-[#374F43]">
              About YatraVerse
            </p>
            <h2 className="cinzel text-3xl font-bold leading-tight text-[#2B3E34] sm:text-4xl">
              Your AI travel companion for unforgettable journeys.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#5c6660]">
              YatraVerse helps travelers plan, organize, and enjoy every trip with ease. From discovering destinations to managing group expenses, our platform brings everything together in one simple experience.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-[rgba(241,245,249,0.9)] bg-white p-6 shadow-[0_8px_24px_rgba(43,62,52,0.04)]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#374F43]/10 text-[#374F43]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-xl font-semibold text-[#2B3E34]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#5c6660]">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <Features />
      <AISection />
      <DestinationCards />
      <Footer />
    </>
  );
}



