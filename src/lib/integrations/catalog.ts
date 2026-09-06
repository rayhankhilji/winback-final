// ============================================================================
// src/lib/integrations/catalog.ts
//
// What Winback can connect to. Every entry is a place diligence documents
// actually live — a data room, a drive, a signature archive, a ledger — plus
// the places a deal team wants to be told something changed.
//
// `connected` is seeded false and is the only field a real backend would own;
// everything else is static product copy.
// ============================================================================

export type IntegrationCategory = 'Data rooms' | 'File storage' | 'Records' | 'Notifications';

export interface Integration {
  id: string;
  name: string;
  /** Drives the LogoKit lookup. Must be the company's real primary domain. */
  domain: string;
  category: IntegrationCategory;
  /** One sentence, said plainly, in terms of what it does for this user. */
  description: string;
  /** Short tag beside the name, as in the reference design. */
  tag: string;
  connected: boolean;
  /** False renders "Learn more" instead of a working toggle. */
  available: boolean;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'datasite',
    name: 'Datasite',
    domain: 'datasite.com',
    category: 'Data rooms',
    description:
      'Pull documents straight from a Datasite room so a deal starts analysed instead of starting with a download.',
    tag: 'Virtual data room',
    connected: false,
    available: true,
  },
  {
    id: 'intralinks',
    name: 'Intralinks',
    domain: 'intralinks.com',
    category: 'Data rooms',
    description:
      'Import an Intralinks exchange, including folder structure, so citations keep the room’s own hierarchy.',
    tag: 'Virtual data room',
    connected: false,
    available: true,
  },
  {
    id: 'ansarada',
    name: 'Ansarada',
    domain: 'ansarada.com',
    category: 'Data rooms',
    description: 'Connect an Ansarada room and re-run the analysis whenever the seller adds documents.',
    tag: 'Virtual data room',
    connected: false,
    available: false,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    domain: 'google.com',
    category: 'File storage',
    description:
      'Point Winback at a Drive folder. New files are ingested on upload rather than waiting to be sent over.',
    tag: 'Documents',
    connected: false,
    available: true,
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    domain: 'microsoft.com',
    category: 'File storage',
    description: 'Read from a SharePoint site or Teams channel without moving anything out of your tenant.',
    tag: 'Documents',
    connected: false,
    available: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    domain: 'dropbox.com',
    category: 'File storage',
    description: 'Ingest a shared Dropbox folder, including files a counterparty adds after the initial send.',
    tag: 'Documents',
    connected: false,
    available: true,
  },
  {
    id: 'box',
    name: 'Box',
    domain: 'box.com',
    category: 'File storage',
    description: 'Connect Box so documents under retention policy are read in place, never copied.',
    tag: 'Documents',
    connected: false,
    available: false,
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    domain: 'docusign.com',
    category: 'Records',
    description:
      'Read executed agreements from DocuSign so contract terms come from the signed version, not a draft.',
    tag: 'Signed agreements',
    connected: false,
    available: true,
  },
  {
    id: 'carta',
    name: 'Carta',
    domain: 'carta.com',
    category: 'Records',
    description:
      'Pull the cap table and option ledger directly, so dilution is checked against the register rather than a spreadsheet of it.',
    tag: 'Cap table',
    connected: false,
    available: true,
  },
  {
    id: 'xero',
    name: 'Xero',
    domain: 'xero.com',
    category: 'Records',
    description: 'Read the trial balance so reported figures can be checked against the ledger they came from.',
    tag: 'Accounting',
    connected: false,
    available: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    domain: 'slack.com',
    category: 'Notifications',
    description:
      'Post to a deal channel when an analysis finishes or a contradiction is found, with a link to the evidence.',
    tag: 'Alerts',
    connected: false,
    available: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    domain: 'microsoft.com',
    category: 'Notifications',
    description: 'Send the same run notifications into a Teams channel.',
    tag: 'Alerts',
    connected: false,
    available: false,
  },
];

export const CATEGORY_ORDER: IntegrationCategory[] = [
  'Data rooms',
  'File storage',
  'Records',
  'Notifications',
];
