import { Fragment } from "react";
import { Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { BlurText } from "@/components/BlurText";
import { HeroVideo } from "@/components/HeroVideo";

export function Hero() {
  return (
    <section id="top" className="pt-[100px] pb-14 sm:pt-[112px] sm:pb-16 lg:pt-[140px] lg:pb-24">
      <Container>
        <Heading
          as="h1"
          delay={150}
          className="text-[clamp(3.4rem,9.2vw,9rem)]"
          lines={[
            "Find where your",
            <Fragment key="line-2">
              SOP<span className="normal-case">s</span> disagree.
            </Fragment>,
          ]}
        />

        <BlurText className="mt-8 max-w-[38rem] text-lg lg:mt-10 leading-[1.55] text-mute sm:text-xl sm:leading-[1.5]">
          KeroSOP reads your policies, SOPs and training guides in Chinese and English, finds the instructions that
          conflict, and shows you both clauses word for word. Your policy owner decides which one is right.
        </BlurText>

        <HeroVideo className="mt-10 sm:mt-12 lg:mt-16" />
      </Container>
    </section>
  );
}
