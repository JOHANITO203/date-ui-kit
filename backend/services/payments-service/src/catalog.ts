import { z } from "zod";

export const offerSchema = z.object({
  id: z.string(),
  label: z.string(),
  amountMinor: z.number().int().positive(),
  currencyNumeric: z.number().int().positive(),
  type: z.enum(["tier", "instant", "time_pack", "bundle"]),
  durationHours: z.number().int().positive().optional(),
});

export type Offer = z.infer<typeof offerSchema>;

export const offersCatalog: Offer[] = [
  { id: "tier-essential-month", label: "ESSENTIAL", amountMinor: 49900, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },
  { id: "tier-gold-month", label: "GOLD", amountMinor: 89900, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },
  { id: "tier-platinum-month", label: "PLATINUM", amountMinor: 149000, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },
  { id: "tier-elite-month", label: "ELITE", amountMinor: 299000, currencyNumeric: 643, type: "tier", durationHours: 24 * 30 },

  { id: "instant-boost", label: "BOOST", amountMinor: 9900, currencyNumeric: 643, type: "instant" },
  { id: "instant-icebreaker", label: "ICEBREAKER", amountMinor: 12900, currencyNumeric: 643, type: "instant" },
  { id: "instant-travel-pass", label: "TRAVEL PASS", amountMinor: 14900, currencyNumeric: 643, type: "instant", durationHours: 24 },
  { id: "instant-superlike", label: "SUPERLIKE", amountMinor: 7900, currencyNumeric: 643, type: "instant" },
  { id: "instant-rewind-x10", label: "REWIND (X10)", amountMinor: 6900, currencyNumeric: 643, type: "instant" },
  { id: "instant-shadowghost", label: "SHADOWGHOST", amountMinor: 9900, currencyNumeric: 643, type: "instant", durationHours: 24 },

  { id: "pass-day", label: "DAY PASS", amountMinor: 19900, currencyNumeric: 643, type: "time_pack", durationHours: 24 },
  { id: "pass-week", label: "WEEK PASS", amountMinor: 59900, currencyNumeric: 643, type: "time_pack", durationHours: 24 * 7 },
  { id: "pass-month", label: "MONTH PASS", amountMinor: 149900, currencyNumeric: 643, type: "time_pack", durationHours: 24 * 30 },
  { id: "pass-travel-pass-plus", label: "TRAVEL PASS+", amountMinor: 39900, currencyNumeric: 643, type: "time_pack", durationHours: 24 * 7 },

  { id: "bundle-starter", label: "STARTER", amountMinor: 39900, currencyNumeric: 643, type: "bundle" },
  { id: "bundle-dating-pro", label: "DATING PRO", amountMinor: 129900, currencyNumeric: 643, type: "bundle", durationHours: 24 * 30 },
  { id: "bundle-premium-plus", label: "PREMIUM+", amountMinor: 199900, currencyNumeric: 643, type: "bundle", durationHours: 24 * 30 },
];

const byId = new Map(offersCatalog.map((offer) => [offer.id, offer]));

export const resolveOffer = (offerId: string) => byId.get(offerId);
