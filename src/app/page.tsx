import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { Facts } from "@/components/landing/Facts";
import { Example } from "@/components/landing/Example";
import { Checks } from "@/components/landing/Checks";
import { Audiences, Monitoring, SignOff, Steps } from "@/components/landing/Workflow";
import { Cta, Footer, Pricing } from "@/components/landing/Closing";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Facts />
        <Example />
        <Checks />
        <Steps />
        <SignOff />
        <Monitoring />
        <Audiences />
        <Pricing />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
