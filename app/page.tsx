import { HeroScroll } from "@/components/hero-scroll";
import { Honesty, HowItWorks, SiteFooter } from "@/components/landing-sections";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HeroScroll />
        <HowItWorks />
        <Honesty />
      </main>
      <SiteFooter />
    </>
  );
}
