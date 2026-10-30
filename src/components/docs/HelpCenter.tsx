import { Container } from "@/components/ui";
import { Heading } from "@/components/BlurText";

/** A near-black panel with one way to reach a person. */
export function HelpCenter() {
  return (
    <Container className="py-14 sm:py-20">
      <section className="on-dark flex flex-col items-start justify-between gap-5 rounded-[28px] bg-[#111111] p-6 text-paper sm:gap-8 sm:p-10 lg:flex-row lg:items-end lg:p-14">
        <div>
          <Heading as="h2" className="text-[clamp(2.2rem,4.6vw,4rem)]" lines={["Talk to a person."]} />
          <p className="mt-4 max-w-[30rem] text-[16px] leading-[1.6] text-paper">
            Send us the question and, if it helps, the documents involved.
          </p>
        </div>
        <a
          href="mailto:ngclaire75@gmail.com?subject=KeroSOP%20help"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-red px-5 text-[14px] font-semibold sm:h-14 sm:px-8 sm:text-[16px] text-paper transition-colors hover:bg-red-deep"
        >
          Contact us
        </a>
      </section>
    </Container>
  );
}
