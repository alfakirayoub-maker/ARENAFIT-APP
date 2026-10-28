'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { BOOK_FORMATS } from '@/config/products';
import type { BookFormatId, DeliveryDetails, OrderDraft } from '@/lib/engine/types';

import { sessionJSON } from './storage';

export type OrderStage = 'format' | 'delivery' | 'summary' | 'recorded';

interface OrderState {
  formatId: BookFormatId;
  quantity: number;
  delivery?: DeliveryDetails;
  stage: OrderStage;
  recorded?: OrderDraft;
  setFormat: (formatId: BookFormatId) => void;
  setQuantity: (quantity: number) => void;
  setDelivery: (delivery: DeliveryDetails) => void;
  setStage: (stage: OrderStage) => void;
  record: (draft: OrderDraft) => void;
  clear: () => void;
}

/**
 * Order draft — kept in sessionStorage (personal delivery details should not
 * outlive the tab in a demo). Nothing here is transmitted.
 */
export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      formatId: 'premium-hardcover',
      quantity: 1,
      stage: 'format',
      setFormat: (formatId) => set((s) => ({ formatId, quantity: BOOK_FORMATS[formatId].physical ? s.quantity : 1 })),
      setQuantity: (quantity) => set({ quantity }),
      setDelivery: (delivery) => set({ delivery }),
      setStage: (stage) => set({ stage }),
      record: (recorded) => set({ recorded, stage: 'recorded' }),
      clear: () => set({ formatId: 'premium-hardcover', quantity: 1, delivery: undefined, stage: 'format', recorded: undefined }),
    }),
    { name: 'hikaya-order', version: 1, storage: sessionJSON, skipHydration: true },
  ),
);
