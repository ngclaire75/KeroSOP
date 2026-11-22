import { Fragment } from "react";
import { Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { BlurText } from "@/components/BlurText";
import { HeroWaves } from "./HeroWaves";

export function Hero() {
  return (
    <section id="top" className="relative isolate flex min-h-[min(580px,85svh)] items-center overflow-hidden pt-[100px] pb-16 sm:min-h-[min(760px,100svh)] sm:pt-[140px] sm:pb-32 lg:min-h-[780px] lg:pt-[160px] lg:pb-40">
      <HeroWaves className="absolute inset-0 -z-10" />
      <Container className="relative w-full text-paper">
        <Heading
          as="h1"
          delay={150}
          className="text-[length:calc(clamp(3.4rem,9.2vw,9rem)*var(--ts))]"
          lines={[
            "Find where your",
            <Fragment key="line-2">
              SOP<span className="normal-case">s</span> disagree.
            </Fragment>,
          ]}
        />

        <BlurText className="mt-8 max-w-[38rem] text-lg lg:mt-10 leading-[1.55] text-paper/85 sm:text-xl sm:leading-[1.5]">
          KeroSOP reads your policies, SOPs and training guides in Chinese and English, finds the instructions that
          conflict, and shows you both clauses word for word. Your policy owner decides which one is right.
        </BlurText>
      </Container>
    </section>
  );
}
