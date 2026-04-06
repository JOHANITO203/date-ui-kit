import { randomUUID } from "node:crypto";
import { env } from "../config.js";

type YooKassaCreatePaymentInput = {
  amountValue: string;
  currency: string;
  description: string;
  orderNumber: string;
  userId: string;
  offerId: string;
  returnUrl: string;
  capture?: boolean;
};

type YooKassaPayment = {
  id: string;
  status: string;
  paid?: boolean;
  metadata?: Record<string, string>;
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  };
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    throw new Error(`yookassa_empty_response_${response.status}`);
  }
  return JSON.parse(text) as T;
};

const authHeader = () => {
  const token = Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString("base64");
  return `Basic ${token}`;
};

export class YooKassaClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async createPayment(input: YooKassaCreatePaymentInput): Promise<YooKassaPayment> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.YOOKASSA_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          Authorization: authHeader(),
          "Idempotence-Key": randomUUID(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: {
            value: input.amountValue,
            currency: input.currency,
          },
          description: input.description,
          confirmation: {
            type: "redirect",
            return_url: input.returnUrl,
          },
          capture: input.capture ?? true,
          metadata: {
            order_number: input.orderNumber,
            user_id: input.userId,
            offer_id: input.offerId,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`yookassa_create_failed_${response.status}_${errorBody}`);
      }

      return parseJson<YooKassaPayment>(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getPayment(paymentId: string): Promise<YooKassaPayment> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.YOOKASSA_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: "GET",
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`yookassa_get_failed_${response.status}_${errorBody}`);
      }

      return parseJson<YooKassaPayment>(response);
    } finally {
      clearTimeout(timeout);
    }
  }
}
