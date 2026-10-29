const items = [
  ["Direct contradiction", "直接矛盾"],
  ["Outdated instruction", "过时指引"],
  ["Missing step", "缺失步骤"],
  ["Unclear ownership", "职责不清"],
  ["Inconsistent terms", "术语不一致"],
  ["Duplicated guidance", "重复指引"],
];

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map(([en, zh]) => (
        <li key={en} className="flex items-center gap-6 pr-6">
          <span className="display text-[clamp(2rem,4vw,3.25rem)] leading-none whitespace-nowrap">{en}</span>
          <span lang="zh-Hans" className="text-[clamp(1.25rem,2.4vw,1.9rem)] font-bold whitespace-nowrap text-paper/45">
            {zh}
          </span>
          <span className="size-3 shrink-0 rounded-full bg-red" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

/** Slow ticker of the issue types, in English and Chinese. */
export function Marquee() {
  return (
    <section aria-label="Issue types KeroSOP finds" className="on-dark overflow-hidden bg-ink py-6 text-paper sm:py-8">
      <div className="marquee flex w-max">
        <Row />
        <Row hidden />
      </div>
    </section>
  );
}
