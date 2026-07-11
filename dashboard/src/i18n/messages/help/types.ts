export type HelpSectionContent = {
  title: string;
  summary: string;
  howItWorks: string;
  example: string;
  regions: Record<string, string>;
};

export type HelpMessages = {
  title: string;
  close: string;
  open: string;
  searchPlaceholder: string;
  howItWorks: string;
  example: string;
  onScreen: string;
  adminBadge: string;
  docsLink: string;
  sections: Record<string, HelpSectionContent>;
};
