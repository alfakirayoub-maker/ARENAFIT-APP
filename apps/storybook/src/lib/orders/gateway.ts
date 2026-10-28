import { BOOK_FORMATS } from '@/config/products';
import type { BookFormatId, DeliveryDetails, OrderDraft } from '@/lib/engine/types';

/**
 * Boundary for real ordering (payment, order administration, printing,
 * shipping). A production gateway runs server-side, stores the order (e.g. in
 * Supabase), creates a payment session with a vetted provider and returns its
 * redirect — the browser never sees card data or secret keys.
 */
export interface OrderGateway {
  readonly mode: 'demo' | 'live';
  submit(input: OrderInput): Promise<OrderDraft>;
}

export interface OrderInput {
  formatId: BookFormatId;
  quantity: number;
  delivery: DeliveryDetails;
  storyTitle: string;
}

export function subtotal(formatId: BookFormatId, quantity: number): number {
  return BOOK_FORMATS[formatId].price * quantity;
}

/** Demo gateway: records nothing remotely, takes no payment, sends nothing. */
export const demoOrderGateway: OrderGateway = {
  mode: 'demo',
  async submit(input) {
    return {
      id: `DEMO-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      status: 'demo-recorded',
      formatId: input.formatId,
      quantity: input.quantity,
      currency: 'MAD',
      subtotal: subtotal(input.formatId, input.quantity),
      delivery: input.delivery,
      storyTitle: input.storyTitle,
      createdAt: new Date().toISOString(),
    };
  },
};

export const orderGateway: OrderGateway = demoOrderGateway;
