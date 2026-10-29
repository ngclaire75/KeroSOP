import { Button, Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { BlurText } from "@/components/BlurText";
import { DotTerrain } from "@/components/three/DotTerrain";
import { PinWordmark } from "@/components/three/PinWordmark";
import { FooterField } from "@/components/art/FooterField";
import { ProximityText } from "@/components/ProximityText";

const plans = [
  {
    name: "Sample audit",
    price: "499.000",
    unit: "one time",
    for: "See what’s in your documents before you commit.",
    items: [
      "Up to 20 documents, Chinese or English",
      "Every finding with both quotes",
      "Review call with your policy owner",
      "PDF report",
    ],
    cta: "Book a sample audit",
    href: "#book",
    dark: false,
  },
  {
    name: "Business",
    price: "1.490.000",
    unit: "per month",
    for: "Keep your library consistent as documents change.",
    items: [
      "Larger document library",
      "Rescans when a document changes",
      "Assignments and approvals",
      "Full audit history and monthly reports",
    ],
    cta: "Talk to us",
    href: "#contact",
    dark: true,
  },
];

function Check({ dark }: { dark: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1 size-4 shrink-0">
      <circle cx="8" cy="8" r="8" fill={dark ? "var(--red)" : "var(--ink)"} />
      <path d="M4.5 8.2 7 10.5l4.5-5" fill="none" stroke="var(--paper)" strokeWidth="1.8" />
    </svg>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="bg-fog py-20 lg:py-28">
      <Container>
        <div className="flex flex-col gap-6">
          <Heading className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]" lines={["Start with", "one audit."]} />
          <BlurText className="max-w-[30rem] text-lg leading-[1.55] text-mute">
            Starting prices. The final quote depends on page count and how often you rescan.
          </BlurText>
        </div>

        <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-2">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col overflow-hidden rounded-[24px] p-7 sm:p-9 ${
                p.dark ? "on-dark bg-ink text-paper" : "bg-paper text-ink"
              }`}
            >
              {p.dark && (
                <span className="absolute top-7 right-7 rounded-full bg-red px-3 py-1 text-xs font-semibold sm:top-9 sm:right-9">
                  Monitoring included
                </span>
              )}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className={`mt-1 ${p.dark ? "pr-36 text-paper/65" : "text-mute"}`}>{p.for}</p>
              <p className="mt-10 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="display text-[clamp(3.25rem,6vw,4.75rem)]">
                  <span className="normal-case">Rp</span>
                  {p.price}
                </span>
                <span className={p.dark ? "text-paper/65" : "text-mute"}>{p.unit}</span>
              </p>
              <ul className="mt-8 grid gap-3">
                {p.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check dark={p.dark} />
                    {item}
                  </li>
                ))}
              </ul>
              <Button href={p.href} variant={p.dark ? "red" : "black"} className="mt-10 self-start">
                {p.cta}
              </Button>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Cta() {
  return (
    <section id="book" className="on-red relative overflow-hidden bg-red text-paper">
      <DotTerrain />
      <Container className="relative pt-24 pb-56 md:pb-28 lg:py-36">
        <Heading
          className="text-[3.4rem] sm:text-[clamp(3.25rem,8vw,7.5rem)]"
          lines={["Find it", "before your", "customers do."]}
          tint="#ffb3ae"
        />
        <BlurText tint="#ffb3ae" className="mt-6 max-w-[30rem] text-lg leading-[1.55] text-paper/90">
          Send us up to 20 documents, in Chinese, English or both. We’ll walk your policy owner through every finding
          and the clauses behind it.
        </BlurText>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button href="mailto:ngclaire75@gmail.com?subject=Sample%20audit" variant="black">
            Book a sample audit
          </Button>
          <Button href="#signup" variant="white">
            Sign up for free
          </Button>
        </div>
      </Container>
    </section>
  );
}

const footerLinks = [
  {
    title: "Product",
    links: [
      ["Platform", "#checks"],
      ["Workflow", "#how"],
      ["Governance", "#governance"],
      ["Solutions", "#solutions"],
      ["Pricing", "#pricing"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Contact", "#contact"],
      ["Privacy", "#privacy"],
      ["Terms", "#terms"],
    ],
  },
];

export function Footer() {
  return (
    <footer id="contact" className="on-dark relative overflow-hidden bg-ink text-paper">
      <div className="relative">
        <FooterField className="pointer-events-none absolute inset-0" />
        <Container className="relative pt-10 pb-10 sm:pt-16 lg:pt-20 lg:pb-14">
          <div className="rounded-[28px] border border-paper/15 bg-ink p-5 sm:p-10 lg:p-12">
            <div>
              <p className="text-lg font-semibold text-paper">Have a set of SOPs that might disagree?</p>
              <a
                href="mailto:ngclaire75@gmail.com"
                className="display mt-4 inline-block text-[calc((100vw-80px)/10.3)] whitespace-nowrap sm:text-[clamp(1.6rem,7vw,6rem)]"
              >
                <ProximityText text="ngclaire75@gmail.com" />
              </a>
              <p className="mt-8 max-w-[30rem] leading-[1.6] font-semibold text-paper">
                Finds conflicting instructions across your policies and SOPs, in Chinese and English, with the source
                for every finding.
              </p>
            </div>

            <nav aria-label="Footer" className="mt-12 grid grid-cols-2 gap-8 sm:flex sm:gap-24">
              {footerLinks.map((col) => (
                <div key={col.title}>
                  <h3 className="text-sm font-bold text-paper">{col.title}</h3>
                  <ul className="mt-5 grid gap-3">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <a href={href} className="inline-flex">
                          <span className="link-gradient">{label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </Container>
      </div>

      <PinWordmark />

      <Container>
        <div className="relative -mt-[3vw] pb-8 text-center text-sm text-paper/50">
          <p>© 2026 KeroSOP</p>
          <p className="mt-1">All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
