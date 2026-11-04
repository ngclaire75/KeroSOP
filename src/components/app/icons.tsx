/**
 * Dashboard icons from Phosphor Icons (MIT, phosphoricons.com): one drawn
 * family with consistent weights. Pages refer to icons by short names so the
 * set can be swapped in one place. No emoji are used anywhere in the UI.
 */
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  Bell,
  Brain,
  CaretDown,
  CaretRight,
  ChartBar,
  CheckCircle,
  ClockCounterClockwise,
  Cloud,
  Code,
  Columns,
  DotsThree,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  FileText,
  Funnel,
  Gear,
  GithubLogo,
  GoogleDriveLogo,
  Graph,
  House,
  Link,
  List,
  ListBullets,
  Lock,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plug,
  Plus,
  ListMagnifyingGlass,
  ShieldCheck,
  SignOut,
  SlackLogo,
  Sparkle,
  Trash,
  UploadSimple,
  User,
  UsersThree,
  Warning,
  WebhooksLogo,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from "@phosphor-icons/react";

const ICONS: Record<string, PhosphorIcon> = {
  home: House,
  doc: FileText,
  scan: ListMagnifyingGlass,
  rules: ListBullets,
  alert: Warning,
  split: Columns,
  graph: Graph,
  check: CheckCircle,
  report: ChartBar,
  clock: ClockCounterClockwise,
  plug: Plug,
  gear: Gear,
  search: MagnifyingGlass,
  bell: Bell,
  upload: UploadSimple,
  plus: Plus,
  x: X,
  menu: List,
  chevron: CaretRight,
  down: CaretDown,
  out: SignOut,
  download: DownloadSimple,
  play: Play,
  arrow: ArrowRight,
  external: ArrowSquareOut,
  filter: Funnel,
  dots: DotsThree,
  user: User,
  users: UsersThree,
  github: GithubLogo,
  slack: SlackLogo,
  webhook: WebhooksLogo,
  mail: EnvelopeSimple,
  drive: GoogleDriveLogo,
  cloud: Cloud,
  api: Code,
  sparkle: Sparkle,
  lock: Lock,
  trash: Trash,
  edit: PencilSimple,
  refresh: ArrowsClockwise,
  eye: Eye,
  link: Link,
  shield: ShieldCheck,
  brain: Brain,
};

/** Two documents facing each other, for Evidence Comparison. */
function Compare({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M10 23v-2H3V3h7V1h2v22zm-5-4h5v-2H7v-2h3v-2H7v-2h3V9H7V7h3V5H5zm9-14V3h7v18h-7v-2h5V5zm0 8v-2h3v2zm0-4V7h3v2zm-4 3" />
    </svg>
  );
}

export function Icon({ name, className = "size-[18px]", weight = "regular" }: { name: string; className?: string; weight?: IconWeight; strokeWidth?: number }) {
  if (name === "split") return <Compare className={`shrink-0 ${className}`} />;
  const C = ICONS[name] ?? DotsThree;
  return <C aria-hidden="true" weight={weight} className={`shrink-0 ${className}`} />;
}
