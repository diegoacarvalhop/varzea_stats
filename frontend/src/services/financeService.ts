import { api } from '@/services/api';

export type PaymentKind = 'MONTHLY' | 'DAILY';

export interface PaymentRecordPayload {
  userId: number;
  peladaId: number;
  kind: PaymentKind;
  amountCents: number;
  paidAt: string;
  referenceMonth: string;
}

export interface FinanceDelinquentRow {
  userId: number;
  userName: string;
  email: string;
  peladaId: number;
  peladaName: string;
  reminderSentAt?: string | null;
  overdueMonths?: string[];
}

export interface FinanceMonthlyPayment {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  peladaId: number;
  peladaName: string;
  amountCents: number;
  paidAt: string;
  referenceMonth: string;
}

export async function recordPayment(payload: PaymentRecordPayload): Promise<void> {
  await api.post('/finance/payments', payload);
}

export async function listDelinquent(peladaId: number): Promise<FinanceDelinquentRow[]> {
  const { data } = await api.get<FinanceDelinquentRow[]>('/finance/delinquent', { params: { peladaId } });
  return data;
}

export async function sendDelinquentReminder(payload: { userId: number; peladaId: number }): Promise<void> {
  await api.post('/finance/delinquent/reminder', payload);
}

export async function listMonthlyPaymentsByUser(
  payload: { peladaId: number; userId: number },
): Promise<FinanceMonthlyPayment[]> {
  const { data } = await api.get<FinanceMonthlyPayment[]>('/finance/payments/monthly', { params: payload });
  return data;
}
