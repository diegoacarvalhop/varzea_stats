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
  billingType?: 'MONTHLY' | 'DAILY';
  overdueMonths?: string[];
  overdueDailyDates?: string[];
  pendingReceiptId?: number | null;
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
  receiptId?: number | null;
}

export type PaymentReceiptStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FinanceReceipt {
  id: number;
  userId: number;
  userName: string;
  peladaId: number;
  paidAt?: string | null;
  referenceMonths: string[];
  status: PaymentReceiptStatus;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedByUserId?: number | null;
  reviewedByName?: string | null;
  reviewNote?: string | null;
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

export async function listMyMonthlyPayments(peladaId: number): Promise<FinanceMonthlyPayment[]> {
  const { data } = await api.get<FinanceMonthlyPayment[]>('/finance/payments/monthly/my', { params: { peladaId } });
  return data;
}

export async function submitReceipt(payload: {
  peladaId: number;
  referenceMonths: string[];
  file: File;
}): Promise<FinanceReceipt> {
  const fd = new FormData();
  fd.append('peladaId', String(payload.peladaId));
  payload.referenceMonths.forEach((m) => fd.append('referenceMonths', m));
  fd.append('file', payload.file);
  const { data } = await api.post<FinanceReceipt>('/finance/receipts', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listPendingReceipts(peladaId: number): Promise<FinanceReceipt[]> {
  const { data } = await api.get<FinanceReceipt[]>('/finance/receipts/pending', { params: { peladaId } });
  return data;
}

export async function listReceiptsByUser(payload: { peladaId: number; userId: number }): Promise<FinanceReceipt[]> {
  const { data } = await api.get<FinanceReceipt[]>('/finance/receipts/user', { params: payload });
  return data;
}

export async function approveReceipt(receiptId: number, payload: { paidAt: string; note?: string }): Promise<void> {
  await api.post(`/finance/receipts/${receiptId}/approve`, { paidAt: payload.paidAt, note: payload.note ?? null });
}

export async function rejectReceipt(receiptId: number, note?: string): Promise<void> {
  await api.post(`/finance/receipts/${receiptId}/reject`, { note: note ?? null });
}

export function receiptFileUrl(receiptId: number): string {
  return api.getUri({ url: `/finance/receipts/${receiptId}/file` });
}

export async function fetchReceiptBlob(receiptId: number): Promise<Blob> {
  const { data } = await api.get(`/finance/receipts/${receiptId}/file`, { responseType: 'blob' });
  return data as Blob;
}
