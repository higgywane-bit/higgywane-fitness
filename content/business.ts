/** Contact + payment details shown on the site and used at the till. Editable in Admin → Site & content. TODO: confirm with owner */
export type Business = {
  name: string;
  /** PromptPay phone number or 13-digit tax ID for QR payments */
  promptPayId: string;
  phone: string;
  email: string;
  line: string;
  instagram: string;
  address: string;
  hours: string;
  /** short line under the hero on the home page */
  tagline: string;
};

export const DEFAULT_BUSINESS: Business = {
  name: "Superfit",
  promptPayId: "",
  phone: "",
  email: "",
  line: "",
  instagram: "",
  address: "",
  hours: "Every day 06:00–22:00",
  tagline: "Bodybuilding gym and protein cafe.",
};
