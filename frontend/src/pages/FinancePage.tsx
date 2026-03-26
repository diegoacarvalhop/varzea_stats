import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { getApiErrorMessage } from '@/lib/apiError';
import { maskCurrencyBRInput, parseMaskedMoneyToCents } from '@/lib/moneyMask';
import { hasAnyRole, hasRole } from '@/lib/roles';
import {
  approveReceipt,
  fetchReceiptBlob,
  listMyMonthlyPayments,
  listMonthlyPaymentsByUser,
  listReceiptsByUser,
  rejectReceipt,
  listDelinquent,
  recordPayment,
  sendDelinquentReminder,
  submitReceipt,
  type FinanceDelinquentRow,
  type FinanceMonthlyPayment,
  type FinanceReceipt,
  type PaymentKind,
} from '@/services/financeService';
import { listUsers, type UserSummary } from '@/services/userService';
import { FormModal } from '@/components/FormModal';
import s from '@/styles/pageShared.module.scss';

function monthStartIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatReminderSentAt(iso?: string | null): string {
  if (!iso) return 'Pendente';
  try {
    return `Enviado em ${new Date(iso).toLocaleString('pt-BR')}`;
  } catch {
    return 'Enviado';
  }
}

function formatOverdueMonths(months?: string[]): string {
  if (!months || months.length === 0) return '—';
  const sorted = [...months].sort();
  return sorted
    .map((m) => {
      const iso = `${m.slice(0, 7)}-01`;
      return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
    })
    .join(', ');
}

function formatOverdueDailyDates(days?: string[]): string {
  if (!days || days.length === 0) return '—';
  return [...days]
    .sort()
    .map((d) => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR'))
    .join(', ');
}

export function FinancePage() {
  const { peladaId, peladaName, roles, email, peladaMonthlyDueDay } = useAuth();
  const canManageFinance = hasAnyRole(roles, ['ADMIN_GERAL', 'ADMIN', 'FINANCEIRO']);
  const isPlayer = hasRole(roles, 'PLAYER');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [delinquent, setDelinquent] = useState<FinanceDelinquentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payUserId, setPayUserId] = useState<number | ''>('');
  const [kind, setKind] = useState<PaymentKind>('MONTHLY');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [refMonth, setRefMonth] = useState(() => monthStartIso(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [sendingReminderByUser, setSendingReminderByUser] = useState<Record<number, boolean>>({});
  const [historyUserId, setHistoryUserId] = useState<number | ''>('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<FinanceMonthlyPayment[]>([]);
  const [receiptHistory, setReceiptHistory] = useState<FinanceReceipt[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [receiptMonths, setReceiptMonths] = useState<string[]>([]);
  const [receiptMonthInput, setReceiptMonthInput] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [reviewingReceiptById, setReviewingReceiptById] = useState<Record<number, boolean>>({});
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<FinanceReceipt | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewType, setReceiptPreviewType] = useState<string>('');
  const [receiptPreviewLoading, setReceiptPreviewLoading] = useState(false);
  const [receiptModalTitle, setReceiptModalTitle] = useState('Comprovante');
  const [canReviewActiveReceipt, setCanReviewActiveReceipt] = useState(false);
  const [financePaidAt, setFinancePaidAt] = useState(todayIso());
  const [playerMonthsLoading, setPlayerMonthsLoading] = useState(false);

  const load = useCallback(async () => {
    if (peladaId == null) {
      setUsers([]);
      setDelinquent([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const promises: Array<Promise<unknown>> = [listUsers()];
      if (canManageFinance) promises.push(listDelinquent(peladaId));
      const result = await Promise.all(promises);
      const uList = result[0] as UserSummary[];
      setUsers(uList);
      if (canManageFinance) {
        setDelinquent(result[1] as FinanceDelinquentRow[]);
      } else {
        setDelinquent([]);
      }
    } catch {
      appToast.error('Não foi possível carregar dados financeiros.');
      setUsers([]);
      setDelinquent([]);
    } finally {
      setLoading(false);
    }
  }, [canManageFinance, peladaId]);

  useEffect(() => {
    document.title = 'Financeiro · VARzea Stats';
    void load();
  }, [load]);

  useEffect(
    () => () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    },
    [receiptPreviewUrl],
  );

  const filteredUsers = useMemo(() => {
    if (peladaId == null) return [];
    return users.filter(
      (u) =>
        u.peladaId === peladaId ||
        (Array.isArray(u.peladaIds) && u.peladaIds.includes(peladaId)),
    );
  }, [users, peladaId]);
  const currentUserId = useMemo(
    () => users.find((u) => u.email.toLowerCase() === (email ?? '').toLowerCase())?.id ?? null,
    [users, email],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (peladaId == null || payUserId === '') {
      appToast.warning('Selecione o jogador.');
      return;
    }
    const amountCents = parseMaskedMoneyToCents(amount);
    if (amountCents == null || amountCents < 0) {
      appToast.warning('Informe um valor válido (R$ 0,00 ou maior).');
      return;
    }
    setSubmitting(true);
    try {
      await recordPayment({
        userId: Number(payUserId),
        peladaId,
        kind,
        amountCents,
        paidAt,
        referenceMonth: refMonth,
      });
      appToast.success('Pagamento registrado.');
      setAmount('');
      await load();
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível registrar o pagamento.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSendReminder(row: FinanceDelinquentRow) {
    if (peladaId == null) return;
    setSendingReminderByUser((prev) => ({ ...prev, [row.userId]: true }));
    try {
      await sendDelinquentReminder({ userId: row.userId, peladaId });
      appToast.success(`Cobrança enviada para ${row.userName}.`);
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível enviar a cobrança por e-mail.'));
    } finally {
      setSendingReminderByUser((prev) => ({ ...prev, [row.userId]: false }));
    }
  }

  const loadMonthlyHistoryForUser = useCallback(async (userToLoad: number, showEmptyToast = true) => {
    setHistoryLoading(true);
    try {
      if (!Number.isFinite(userToLoad) || userToLoad <= 0) {
        if (showEmptyToast) appToast.warning('Não foi possível identificar seu usuário para carregar o histórico.');
        return;
      }
      if (peladaId == null) return;
      const [rows, receipts] = await Promise.all([
        canManageFinance ? listMonthlyPaymentsByUser({ peladaId, userId: userToLoad }) : listMyMonthlyPayments(peladaId),
        listReceiptsByUser({ peladaId, userId: userToLoad }),
      ]);
      setMonthlyHistory(rows);
      setReceiptHistory(receipts);
      setHistoryLoaded(true);
      if (rows.length === 0 && showEmptyToast) {
        appToast.success('Nenhuma mensalidade registrada para este jogador nesta pelada.');
      }
    } catch (err) {
      if (showEmptyToast) {
        appToast.error(getApiErrorMessage(err, 'Não foi possível listar as mensalidades do jogador.'));
      }
      setMonthlyHistory([]);
      setHistoryLoaded(false);
    } finally {
      setHistoryLoading(false);
    }
  }, [canManageFinance, peladaId]);

  async function onListMonthlyHistory(e: FormEvent) {
    e.preventDefault();
    if (peladaId == null || (canManageFinance && historyUserId === '')) {
      appToast.warning('Selecione o jogador para listar as mensalidades.');
      return;
    }
    const userToLoad = canManageFinance ? Number(historyUserId) : Number(currentUserId);
    await loadMonthlyHistoryForUser(userToLoad, true);
  }

  async function onSubmitReceipt(e: FormEvent) {
    e.preventDefault();
    if (peladaId == null) return;
    if (!receiptFile) {
      appToast.warning('Selecione o arquivo do comprovante.');
      return;
    }
    const cleanMonths = receiptMonths.filter(Boolean);
    if (cleanMonths.length === 0) {
      appToast.warning('Selecione ao menos um mês de referência.');
      return;
    }
    setReceiptSubmitting(true);
    try {
      await submitReceipt({ peladaId, referenceMonths: cleanMonths, file: receiptFile });
      appToast.success('Comprovante enviado para análise.');
      setReceiptFile(null);
      setReceiptMonths([]);
      setReceiptMonthInput('');
      if (canManageFinance) {
        await load();
      }
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível enviar o comprovante.'));
    } finally {
      setReceiptSubmitting(false);
    }
  }

  function addReceiptMonth() {
    if (!receiptMonthInput) return;
    setReceiptMonths((prev) => {
      if (prev.includes(receiptMonthInput)) return prev;
      return [...prev, receiptMonthInput].sort();
    });
  }

  function removeReceiptMonth(month: string) {
    setReceiptMonths((prev) => prev.filter((m) => m !== month));
  }

  async function openReceiptPreview(
    receiptId: number,
    options?: { title?: string; canReview?: boolean; receiptMeta?: FinanceReceipt | null },
  ) {
    setReceiptModalOpen(true);
    setReceiptPreviewLoading(true);
    setReceiptModalTitle(options?.title ?? 'Comprovante');
    setCanReviewActiveReceipt(Boolean(options?.canReview));
    setFinancePaidAt(todayIso());
    setActiveReceipt(options?.receiptMeta ?? null);
    try {
      const blob = await fetchReceiptBlob(receiptId);
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      const nextUrl = URL.createObjectURL(blob);
      setReceiptPreviewUrl(nextUrl);
      setReceiptPreviewType(blob.type);
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível carregar o comprovante.'));
      setReceiptModalOpen(false);
      setActiveReceipt(null);
    } finally {
      setReceiptPreviewLoading(false);
    }
  }

  async function openReceiptModal(row: FinanceDelinquentRow) {
    if (!row.pendingReceiptId) return;
    const receiptMeta: FinanceReceipt = {
      id: row.pendingReceiptId,
      userId: row.userId,
      userName: row.userName,
      peladaId: row.peladaId,
      referenceMonths: (row.overdueMonths ?? []).map((m) => m.slice(0, 7)),
      status: 'PENDING',
      originalFilename: 'comprovante',
      contentType: '',
      fileSizeBytes: 0,
      submittedAt: '',
    };
    await openReceiptPreview(row.pendingReceiptId, {
      title: 'Comprovante pendente',
      canReview: true,
      receiptMeta,
    });
  }

  function closeReceiptModal() {
    setReceiptModalOpen(false);
    setActiveReceipt(null);
    setCanReviewActiveReceipt(false);
    setReceiptModalTitle('Comprovante');
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptPreviewUrl(null);
    setReceiptPreviewType('');
  }

  async function onReviewReceipt(receiptId: number, action: 'approve' | 'reject') {
    setReviewingReceiptById((prev) => ({ ...prev, [receiptId]: true }));
    try {
      if (action === 'approve') {
        await approveReceipt(receiptId, { paidAt: financePaidAt });
        appToast.success('Comprovante aprovado e baixa realizada.');
      } else {
        await rejectReceipt(receiptId);
        appToast.success('Comprovante rejeitado.');
      }
      await load();
      closeReceiptModal();
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível analisar o comprovante.'));
    } finally {
      setReviewingReceiptById((prev) => ({ ...prev, [receiptId]: false }));
    }
  }

  const receiptByMonth = useMemo(() => {
    const map = new Map<string, FinanceReceipt>();
    receiptHistory
      .filter((r) => r.status !== 'REJECTED')
      .forEach((r) => {
        r.referenceMonths.forEach((m) => {
          if (!map.has(m)) map.set(m, r);
        });
      });
    return map;
  }, [receiptHistory]);

  const playerMonthRows = useMemo(() => {
    if (!isPlayer) return { paid: [] as string[], pending: [] as string[] };
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dueDay = peladaMonthlyDueDay ?? 15;
    const paidSet = new Set(monthlyHistory.map((r) => r.referenceMonth));

    const dataMonths = new Set<string>();
    for (const p of monthlyHistory) dataMonths.add(p.referenceMonth);
    for (const r of receiptHistory) {
      for (const month of r.referenceMonths) dataMonths.add(`${month}-01`);
    }
    for (let m = 0; m <= today.getMonth(); m += 1) {
      dataMonths.add(`${today.getFullYear()}-${String(m + 1).padStart(2, '0')}-01`);
    }

    const months = Array.from(dataMonths).sort((a, b) => b.localeCompare(a));
    const pending = months.filter((monthIso) => {
      if (paidSet.has(monthIso)) return false;
      const monthDate = new Date(`${monthIso}T00:00:00`);
      if (monthDate < currentMonth) return true;
      if (monthDate.getFullYear() === currentMonth.getFullYear() && monthDate.getMonth() === currentMonth.getMonth()) {
        return today.getDate() > dueDay;
      }
      return false;
    });
    const paid = months.filter((monthIso) => paidSet.has(monthIso));
    return { paid, pending };
  }, [isPlayer, monthlyHistory, receiptHistory, peladaMonthlyDueDay]);

  const receiptInfoByMonth = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of receiptHistory) {
      const statusLabel =
        r.status === 'PENDING' ? 'Comprovante enviado (em análise)' : r.status === 'APPROVED' ? 'Comprovante aprovado' : 'Comprovante rejeitado';
      for (const month of r.referenceMonths) {
        if (!map.has(month)) map.set(month, statusLabel);
      }
    }
    return map;
  }, [receiptHistory]);

  useEffect(() => {
    if (!isPlayer || peladaId == null || currentUserId == null) return;
    setPlayerMonthsLoading(true);
    void loadMonthlyHistoryForUser(Number(currentUserId), false).finally(() => setPlayerMonthsLoading(false));
  }, [isPlayer, peladaId, currentUserId, loadMonthlyHistoryForUser]);

  if (peladaId == null) {
    return (
      <div className={s.page}>
        <p className={s.lead}>Selecione uma pelada para usar o módulo financeiro.</p>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <h1>Financeiro — {peladaName ?? `Pelada #${peladaId}`}</h1>
      <p className={s.lead}>
        Registre pagamentos mensais ou diários. Mensalistas entram em inadimplência após o dia de vencimento configurado
        na pelada (sem quitação do mês).
        Diaristas entram em inadimplência no dia em que forem marcados presentes e o débito não for baixado.
      </p>
      {loading ? (
        <p className={s.lead}>Carregando…</p>
      ) : (
        <>
          {canManageFinance && (
            <section className={`${s.card} ${s.financeSectionTop}`}>
            <h2 className={s.cardTitle}>Inadimplência</h2>
            {delinquent.length === 0 ? (
              <p className={s.lead}>Nenhum inadimplente nesta pelada para o mês atual.</p>
            ) : (
              <div className={s.trajectoryTableWrap}>
                <table className={s.userListTable}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Tipo</th>
                      <th>Referência em atraso</th>
                      <th>Status</th>
                      <th style={{ width: '12rem' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delinquent.map((row) => (
                      <tr key={`${row.userId}-${row.peladaId}`}>
                        <td>{row.userName}</td>
                        <td>{row.email}</td>
                        <td>{row.billingType === 'DAILY' ? 'Diarista' : 'Mensalista'}</td>
                        <td>
                          {row.billingType === 'DAILY'
                            ? formatOverdueDailyDates(row.overdueDailyDates)
                            : formatOverdueMonths(row.overdueMonths)}
                        </td>
                        <td>{formatReminderSentAt(row.reminderSentAt)}</td>
                        <td className={s.financeActionRow}>
                          {row.pendingReceiptId ? (
                            <button type="button" className={s.btnPrimary} onClick={() => void openReceiptModal(row)}>
                              Ver comprovante
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={s.btn}
                            disabled={Boolean(sendingReminderByUser[row.userId])}
                            onClick={() => void onSendReminder(row)}
                          >
                            {sendingReminderByUser[row.userId]
                              ? 'Enviando…'
                              : row.reminderSentAt
                                ? 'Reenviar cobrança'
                                : 'Enviar cobrança'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </section>
          )}
          {canManageFinance && (
            <section className={s.card}>
              <h2 className={s.cardTitle}>Registrar pagamento</h2>
              <form className={`${s.form} ${s.financeFormCompact}`} onSubmit={(e) => void onSubmit(e)}>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="fin-user">
                  Jogador
                </label>
                <select
                  id="fin-user"
                  className={s.input}
                  value={payUserId === '' ? '' : String(payUserId)}
                  onChange={(ev) => setPayUserId(ev.target.value === '' ? '' : Number(ev.target.value))}
                  required
                >
                  <option value="">Selecione…</option>
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="fin-kind">
                  Tipo
                </label>
                <select
                  id="fin-kind"
                  className={s.input}
                  value={kind}
                  onChange={(ev) => setKind(ev.target.value as PaymentKind)}
                >
                  <option value="MONTHLY">Mensalidade</option>
                  <option value="DAILY">Diária</option>
                </select>
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="fin-amount">
                  Valor (R$)
                </label>
                <input
                  id="fin-amount"
                  className={s.input}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={amount}
                  onChange={(ev) => setAmount(maskCurrencyBRInput(ev.target.value))}
                  required
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="fin-paid">
                  Data do pagamento
                </label>
                <input
                  id="fin-paid"
                  className={s.input}
                  type="date"
                  value={paidAt}
                  onChange={(ev) => setPaidAt(ev.target.value)}
                  required
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="fin-ref">
                  Mês de referência
                </label>
                <input
                  id="fin-ref"
                  className={s.input}
                  type="month"
                  value={refMonth.slice(0, 7)}
                  onChange={(ev) => setRefMonth(`${ev.target.value}-01`)}
                  required
                />
              </div>
              <button className={s.btnPrimary} type="submit" disabled={submitting}>
                {submitting ? 'Salvando…' : 'Registrar'}
              </button>
              </form>
            </section>
          )}
          {isPlayer && (
            <section className={`${s.card} ${s.financeSectionTop}`}>
              <h2 className={s.cardTitle}>Enviar comprovante de mensalidade</h2>
              <form className={`${s.form} ${s.financeFormWide}`} onSubmit={(e) => void onSubmitReceipt(e)}>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="receipt-month">
                    Meses quitados
                  </label>
                  <div className={s.financeMonthPickerRow}>
                    <input
                      id="receipt-month"
                      className={s.input}
                      type="month"
                      value={receiptMonthInput}
                      onChange={(ev) => setReceiptMonthInput(ev.target.value)}
                    />
                    <button type="button" className={s.btn} onClick={addReceiptMonth}>
                      Adicionar
                    </button>
                  </div>
                  {receiptMonths.length > 0 ? (
                    <div className={s.financeMonthChips}>
                      {receiptMonths.map((month) => (
                        <button key={month} type="button" className={s.btn} onClick={() => removeReceiptMonth(month)}>
                          {new Date(`${month}-01T00:00:00`).toLocaleDateString('pt-BR', {
                            month: 'long',
                            year: 'numeric',
                          })}{' '}
                          ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={s.statsDetailMeta}>
                      Nenhum mês selecionado.
                    </p>
                  )}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="receipt-file">
                    Comprovante (PDF ou imagem)
                  </label>
                  <input
                    id="receipt-file"
                    className={s.input}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={(ev) => setReceiptFile(ev.target.files?.[0] ?? null)}
                    required
                  />
                </div>
                <button className={s.btnPrimary} type="submit" disabled={receiptSubmitting}>
                  {receiptSubmitting ? 'Enviando…' : 'Enviar comprovante'}
                </button>
              </form>
            </section>
          )}
          {isPlayer && (
            <section className={`${s.card} ${s.financeSectionTop}`}>
              <h2 className={s.cardTitle}>Meses pagos e pendentes</h2>
              <p className={s.lead} style={{ marginTop: 0 }}>
                Acompanhe sua situação mensal e o status dos comprovantes enviados.
              </p>
              {playerMonthsLoading ? <p className={s.lead}>Carregando meses…</p> : null}
              <div className={s.financeHistoryWrap}>
                <h3 className={s.cardTitle} style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Meses pagos
                </h3>
                {playerMonthRows.paid.length === 0 ? (
                  <p className={s.statsDetailMeta}>Nenhum mês pago encontrado.</p>
                ) : (
                  <div className={s.trajectoryTableWrap}>
                    <table className={s.userListTable}>
                      <thead>
                        <tr>
                          <th>Mês</th>
                          <th>Situação</th>
                          <th>Comprovante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerMonthRows.paid.map((monthIso) => {
                          const monthKey = monthIso.slice(0, 7);
                          return (
                            <tr key={`paid-${monthIso}`}>
                              <td>
                                {new Date(`${monthIso}T00:00:00`).toLocaleDateString('pt-BR', {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </td>
                              <td>Pago</td>
                              <td>{receiptInfoByMonth.get(monthKey) ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className={s.financeHistoryWrap}>
                <h3 className={s.cardTitle} style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Meses pendentes
                </h3>
                {playerMonthRows.pending.length === 0 ? (
                  <p className={s.statsDetailMeta}>Nenhum mês pendente no momento.</p>
                ) : (
                  <div className={s.trajectoryTableWrap}>
                    <table className={s.userListTable}>
                      <thead>
                        <tr>
                          <th>Mês</th>
                          <th>Situação</th>
                          <th>Comprovante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerMonthRows.pending.map((monthIso) => {
                          const monthKey = monthIso.slice(0, 7);
                          return (
                            <tr key={`pending-${monthIso}`}>
                              <td>
                                {new Date(`${monthIso}T00:00:00`).toLocaleDateString('pt-BR', {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </td>
                              <td>Pendente</td>
                              <td>{receiptInfoByMonth.get(monthKey) ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
          {!isPlayer && (
          <section className={`${s.card} ${s.financeSectionTop}`}>
            <h2 className={s.cardTitle}>Mensalidades por jogador</h2>
            <p className={s.lead} style={{ marginTop: 0 }}>
              Consulta disponível para Financeiro, Administrador e Administrador geral.
            </p>
            <form className={`${s.form} ${s.financeFormCompact}`} onSubmit={(e) => void onListMonthlyHistory(e)}>
              {canManageFinance && (
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="fin-history-user">
                    Jogador
                  </label>
                  <select
                    id="fin-history-user"
                    className={s.input}
                    value={historyUserId === '' ? '' : String(historyUserId)}
                    onChange={(ev) => setHistoryUserId(ev.target.value === '' ? '' : Number(ev.target.value))}
                    required
                  >
                    <option value="">Selecione…</option>
                    {filteredUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button className={s.btnPrimary} type="submit" disabled={historyLoading}>
                {historyLoading ? 'Listando…' : 'Listar pagamentos'}
              </button>
            </form>
            <div className={s.financeHistoryWrap}>
              {monthlyHistory.length === 0 ? (
                <p className={s.lead}>
                  {historyLoaded
                    ? 'Nenhuma mensalidade registrada para o jogador selecionado nesta pelada.'
                    : 'Selecione um jogador e clique em listar para ver as mensalidades registradas.'}
                </p>
              ) : (
                <div className={s.trajectoryTableWrap}>
                  <table className={s.userListTable}>
                    <thead>
                      <tr>
                        <th>Mês de referência</th>
                        <th>Data do pagamento</th>
                        <th>Valor</th>
                        <th>Comprovante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyHistory.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {new Date(`${row.referenceMonth}T00:00:00`).toLocaleDateString('pt-BR', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </td>
                          <td>{new Date(`${row.paidAt}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                          <td>
                            {`R$ ${(row.amountCents / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}
                          </td>
                          <td>
                            {row.receiptId ? (
                              <button
                                type="button"
                                className={s.btn}
                                onClick={() =>
                                  void openReceiptPreview(row.receiptId as number, {
                                    title: 'Comprovante de pagamento',
                                    canReview: false,
                                  })
                                }
                              >
                                Ver comprovante
                              </button>
                            ) : (
                              (() => {
                                const fromReceipt = receiptByMonth.get(row.referenceMonth);
                                if (!fromReceipt) return <span className={s.statsDetailMeta}>—</span>;
                                return (
                                  <button
                                    type="button"
                                    className={s.btn}
                                    onClick={() =>
                                      void openReceiptPreview(fromReceipt.id, {
                                        title: 'Comprovante de pagamento',
                                        canReview: false,
                                      })
                                    }
                                  >
                                    Ver comprovante
                                  </button>
                                );
                              })()
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
          )}
        </>
      )}
      <FormModal open={receiptModalOpen} onClose={closeReceiptModal} title={receiptModalTitle}>
        {receiptPreviewLoading ? (
          <p className={s.lead}>Carregando comprovante…</p>
        ) : receiptPreviewUrl ? (
          <div className={s.form}>
            {receiptPreviewType.includes('image/') ? (
              <img src={receiptPreviewUrl} alt="Comprovante" style={{ maxWidth: '100%', borderRadius: 8 }} />
            ) : (
              <iframe title="Comprovante" src={receiptPreviewUrl} style={{ width: '100%', height: 520, border: 'none' }} />
            )}
            {canReviewActiveReceipt && activeReceipt ? (
              <>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="modal-paid-at">
                    Data do pagamento (baixa financeira)
                  </label>
                  <input
                    id="modal-paid-at"
                    className={s.input}
                    type="date"
                    value={financePaidAt}
                    onChange={(ev) => setFinancePaidAt(ev.target.value)}
                    required
                  />
                </div>
                <div className={s.financeActionRow}>
                  <button
                    type="button"
                    className={s.btnPrimary}
                    disabled={!activeReceipt || Boolean(reviewingReceiptById[activeReceipt.id])}
                    onClick={() => activeReceipt && void onReviewReceipt(activeReceipt.id, 'approve')}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className={s.btn}
                    disabled={!activeReceipt || Boolean(reviewingReceiptById[activeReceipt.id])}
                    onClick={() => activeReceipt && void onReviewReceipt(activeReceipt.id, 'reject')}
                  >
                    Recusar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <p className={s.lead}>Não foi possível exibir o comprovante.</p>
        )}
      </FormModal>
    </div>
  );
}
