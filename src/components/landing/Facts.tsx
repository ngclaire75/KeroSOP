import { Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { BlurText } from "@/components/BlurText";
import { MoleculeField } from "@/components/art/MoleculeField";

export function Facts() {
  return (
    <section className="pb-20 lg:pb-28">
      <Container>
        <div className="flex flex-col gap-6 pt-14 lg:pt-20">
          <Heading
            className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]"
            lines={["Not a chatbot.", "A quality check for the", "rules your staff follow."]}
          />
          <BlurText className="max-w-[32rem] text-lg leading-[1.55] text-mute">
            Most teams find conflicting SOPs when a customer gets two different answers. KeroSOP finds them first, using
            the documents you already have and the order of authority you set.
          </BlurText>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:mt-16 lg:grid-cols-12">
          <div className="on-red relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[24px] bg-red p-6 sm:p-7 text-paper md:col-span-2 lg:col-span-6 lg:p-9">
            <p className="display pointer-events-none relative z-10 text-[clamp(3rem,6vw,5.5rem)]">
              Both
              <br />
              clauses.
            </p>
            <MoleculeField className="relative order-last mt-6 h-48 sm:absolute sm:order-none sm:mt-0 sm:inset-y-0 sm:right-0 sm:h-auto sm:w-[46%]" />
            <p className="pointer-events-none relative z-10 mt-6 max-w-[16rem] sm:mt-0 text-base leading-[1.5] text-paper/90 sm:max-w-[17rem]">
              Every finding shows the document, version, section, page and exact quote on each side. If we can’t point
              to it, we don’t show it.
            </p>
          </div>

          <div className="on-dark flex min-h-[230px] flex-col justify-between gap-8 sm:gap-0 rounded-[24px] bg-ink p-6 sm:p-7 text-paper sm:min-h-[380px] lg:col-span-3 lg:p-9">
            <p className="display text-[clamp(3rem,6vw,5.5rem)]">
              <span lang="zh-Hans" className="font-black normal-case">
                中文
              </span>
              <br />
              <span className="mt-3 inline-block text-red sm:mt-0">EN</span>
            </p>
            <p className="max-w-[17rem] text-base leading-[1.5] text-paper/80">
              Reads Chinese and English, and compares across them. Quotes stay in the language they were written in.
            </p>
          </div>

          <div className="flex min-h-[230px] flex-col justify-between gap-8 sm:gap-0 rounded-[24px] bg-fog p-6 sm:p-7 sm:min-h-[380px] lg:col-span-3 lg:p-9">
            <p className="display text-[clamp(3rem,6vw,5.5rem)] text-red">Zero</p>
            <p className="max-w-[17rem] text-base leading-[1.5] text-mute">
              Suggested fixes that go live without an approver. Each one stays a draft until someone with authority
              signs off.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
