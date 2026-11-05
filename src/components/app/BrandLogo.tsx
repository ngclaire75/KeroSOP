/**
 * Official brand marks: Simple Icons (CC0, simpleicons.org) in each brand's
 * own colour, and Microsoft's multi-colour Teams and OneDrive marks from the
 * Iconify "logos" set (CC0). All are trademarks of their owners, shown only
 * to indicate compatibility.
 */
import { MS_LOGOS } from "./msLogos";
import {
  siConfluence,
  siDropbox,
  siGithub,
  siGmail,
  siGooglecalendar,
  siGoogledrive,
  siGooglesheets,
  siJira,
  siLinear,
  siMake,
  siN8n,
  siNotion,
  siSlack,
  siZapier,
  type SimpleIcon,
} from "simple-icons";

export const BRANDS: Record<string, SimpleIcon> = {
  github: siGithub,
  slack: siSlack,
  googledrive: siGoogledrive,
  gmail: siGmail,
  googlecalendar: siGooglecalendar,
  googlesheets: siGooglesheets,
  notion: siNotion,
  confluence: siConfluence,
  jira: siJira,
  linear: siLinear,
  dropbox: siDropbox,
  zapier: siZapier,
  n8n: siN8n,
  make: siMake,
};

const MS: Record<string, string> = { microsoft365: "microsoft-onedrive", teams: "microsoft-teams" };

export function BrandLogo({ brand, className = "size-7", mono = false }: { brand: string; className?: string; mono?: boolean }) {
  const ms = MS_LOGOS[MS[brand]];
  if (ms)
    return (
      <svg role="img" aria-label={brand === "teams" ? "Microsoft Teams" : "Microsoft OneDrive"} viewBox={`0 0 ${ms.width} ${ms.height}`} className={className} dangerouslySetInnerHTML={{ __html: ms.body }} />
    );
  const icon = BRANDS[brand];
  if (!icon) return <span aria-hidden="true" className={`rounded-[6px] bg-fog ${className}`} />;
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} fill={mono ? "currentColor" : `#${icon.hex}`}>
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}

/** What KeroSOP connects to, and honestly how far along each one is. */
export const INTEGRATIONS: { brand: string; name: string; what: string; status: "live" | "setup" | "planned" }[] = [
  { brand: "github", name: "GitHub", what: "Import policies and handbooks from public GitHub repositories.", status: "live" },
  { brand: "slack", name: "Slack", what: "Post new findings, assignments and finished scans to a channel.", status: "live" },
  { brand: "n8n", name: "n8n", what: "Send findings, approvals and finished scans to an n8n webhook.", status: "live" },
  { brand: "zapier", name: "Zapier", what: "Trigger Zaps from new findings, assignments and approvals.", status: "live" },
  { brand: "make", name: "Make", what: "Send findings, approvals and finished scans into Make scenarios.", status: "live" },
  { brand: "googledrive", name: "Google Drive", what: "Sync selected folders and pick up new versions as they're saved.", status: "planned" },
  { brand: "microsoft365", name: "OneDrive & SharePoint", what: "Sync document libraries and new versions via Microsoft Graph.", status: "planned" },
  { brand: "teams", name: "Microsoft Teams", what: "Post finding and assignment alerts linking back to each finding.", status: "planned" },
  { brand: "gmail", name: "Email", what: "Send invites, review reminders and assignment emails to owners.", status: "planned" },
  { brand: "notion", name: "Notion", what: "Read only the pages and databases you share with KeroSOP.", status: "planned" },
  { brand: "confluence", name: "Confluence", what: "Read the spaces you authorise and pick up pages as they change.", status: "planned" },
  { brand: "jira", name: "Jira", what: "Create a linked task for each finding and sync its status back.", status: "planned" },
  { brand: "linear", name: "Linear", what: "Create linked issues for owners and follow them through to done.", status: "planned" },
  { brand: "dropbox", name: "Dropbox", what: "Import the files and folders you select, plus their new versions.", status: "planned" },
];
