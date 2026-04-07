import { z } from "zod";

export const offerSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  tag: z.string().optional(),
  amountMinor: z.number().int().positive(),
  currencyNumeric: z.number().int().positive(),
  type: z.enum(["tier", "instant", "time_pack", "bundle"]),
  durationHours: z.number().int().positive().optional(),
});

export type Offer = z.infer<typeof offerSchema>;

export const offersCatalog: Offer[] = [
  { id: "tier-essential-month", label: "ESSENTIAL", description: "Core premium access for 30 days.", tag: "ENTRY", amountMinor: 49900, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },
  { id: "tier-gold-month", label: "GOLD", description: "Advanced premium with boosted weekly visibility.", tag: "POPULAR", amountMinor: 89900, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },
  { id: "tier-platinum-month", label: "PLATINUM", description: "High-priority premium with stronger discovery tools.", tag: "PRO", amountMinor: 149000, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },
  { id: "tier-elite-month", label: "ELITE", description: "Top-tier premium with VIP positioning.", tag: "VIP", amountMinor: 299000, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },

  { id: "instant-boost", label: "BOOST", description: "Prioritize profile distribution for a short burst.", tag: "INSTANT", amountMinor: 9900, currencyNumeric: 643, type: "instant" },
  { id: "instant-icebreaker", label: "ICEBREAKER", description: "Open hidden opportunities and faster starts.", tag: "INSTANT", amountMinor: 12900, currencyNumeric: 643, type: "instant" },
  { id: "instant-travel-pass", label: "TRAVEL PASS", description: "Switch server city for 24 hours.", tag: "24H", amountMinor: 14900, currencyNumeric: 643, type: "instant", durationHours: 24 },
  { id: "instant-superlike", label: "SUPERLIKE", description: "Send strong intent with priority signal.", tag: "TOKENS", amountMinor: 7900, currencyNumeric: 643, type: "instant" },
  { id: "instant-rewind-x10", label: "REWIND (X10)", description: "Undo up to 10 skipped profiles.", tag: "TOKENS", amountMinor: 6900, currencyNumeric: 643, type: "instant" },
  { id: "instant-shadowghost", label: "SHADOWGHOST", description: "Stealth visibility mode for 24 hours.", tag: "24H", amountMinor: 9900, currencyNumeric: 643, type: "instant", durationHours: 24 },

  { id: "pass-day", label: "DAY PASS", description: "Short premium pass for 24 hours.", tag: "24H", amountMinor: 19900, currencyNumeric: 643, type: "time_pack", durationHours: 24 },
  { id: "pass-week", label: "WEEK PASS", description: "Short premium pass for 7 days.", tag: "7 DAYS", amountMinor: 59900, currencyNumeric: 643, type: "time_pack", durationHours: 24 * 7 },
  { id: "pass-month", label: "MONTH PASS", description: "Premium pass for 30 days.", tag: "30 DAYS", amountMinor: 149900, currencyNumeric: 643, type: "time_pack", durationHours: 24 * 30 },
  { id: "pass-travel-pass-plus", label: "TRAVEL PASS+", description: "Extended Travel Pass access for 7 days.", tag: "7 DAYS", amountMinor: 39900, currencyNumeric: 643, type: "time_pack", durationHours: 24 * 7 },

  { id: "bundle-starter", label: "STARTER", description: "Starter bundle with core engagement tools.", tag: "BUNDLE", amountMinor: 39900, currencyNumeric: 643, type: "bundle" },
  { id: "bundle-dating-pro", label: "DATING PRO", description: "Advanced bundle with high activity tools.", tag: "BUNDLE", amountMinor: 129900, currencyNumeric: 643, type: "bundle", durationHours: 24 * 30 },
  { id: "bundle-premium-plus", label: "PREMIUM+", description: "Top bundle with premium tier and strong quotas.", tag: "BUNDLE", amountMinor: 199900, currencyNumeric: 643, type: "bundle", durationHours: 24 * 30 },
];

const byId = new Map(offersCatalog.map((offer) => [offer.id, offer]));

export const resolveOffer = (offerId: string) => byId.get(offerId);
