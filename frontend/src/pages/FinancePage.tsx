import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { getApiErrorMessage } from '@/lib/apiError';
import { maskCurrencyBRInput, parseMaskedMoneyToCents } from '@/lib/moneyMask';
import {
  listMonthlyPaymentsByUser,
  listDelinquent,
  recordPayment,
  sendDelinquentReminder,
  type FinanceDelinquentRow,
  type FinanceMonthlyPayment,
  type PaymentKind,
} from '@/services/financeService';
import { listUsers, type UserSummary } from '@/services/userService';
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

export function FinancePage() {
  const { peladaId, peladaName } = useAuth();
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
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const load = useCallback(async () => {
    if (peladaId == null) {
      setUsers([]);
      setDelinquent([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [uList, del] = await Promise.all([listUsers(), listDelinquent(peladaId)]);
      setUsers(uList);
      setDelinquent(del);
    } catch {
      appToast.error('Não foi possível carregar dados financeiros.');
      setUsers([]);
      setDelinquent([]);
    } finally {
      setLoading(false);
    }
  }, [peladaId]);

  useEffect(() => {
    document.title = 'Financeiro · VARzea Stats';
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    if (peladaId == null) return [];
    return users.filter(
      (u) =>
        u.peladaId === peladaId ||
        (Array.isArray(u.peladaIds) && u.peladaIds.includes(peladaId)),
    );
  }, [users, peladaId]);

  const today = new Date();
  const showDelinquent = today.getDate() > 15;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (peladaId == null || payUserId === '') {
      appToast.warning('Selecione o jogador.');
      return;
    }
    const amountCents = parseMaskedMoneyToCents(amount);
    if (amountCents == null || amountCents <= 0) {
      appToast.warning('Informe o valor pago.');
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

  async function onListMonthlyHistory(e: FormEvent) {
    e.preventDefault();
    if (peladaId == null || historyUserId === '') {
      appToast.warning('Selecione o jogador para listar as mensalidades.');
      return;
    }
    setHistoryLoading(true);
    try {
      const rows = await listMonthlyPaymentsByUser({ peladaId, userId: Number(historyUserId) });
      setMonthlyHistory(rows);
      setHistoryLoaded(true);
      if (rows.length === 0) {
        appToast.success('Nenhuma mensalidade registrada para este jogador nesta pelada.');
      }
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível listar as mensalidades do jogador.'));
      setMonthlyHistory([]);
      setHistoryLoaded(false);
    } finally {
      setHistoryLoading(false);
    }
  }

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
        Registre pagamentos mensais ou diários. Após o dia 15, mensalistas sem pagamento do mês aparecem como
        inadimplentes para gestores e para o próprio jogador no painel.
      </p>
      {loading ? (
        <p className={s.lead}>Carregando…</p>
      ) : (
        <>
          <section className={s.card}>
            <h2 className={s.cardTitle}>Registrar pagamento</h2>
            <form className={s.form} style={{ maxWidth: '28rem' }} onSubmit={(e) => void onSubmit(e)}>
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
          <section className={s.card} style={{ marginTop: '1.25rem' }}>
            <h2 className={s.cardTitle}>Mensalidades por jogador</h2>
            <p className={s.lead} style={{ marginTop: 0 }}>
              Consulta disponível para Financeiro, Admin da pelada e Admin geral.
            </p>
            <form className={s.form} style={{ maxWidth: '28rem' }} onSubmit={(e) => void onListMonthlyHistory(e)}>
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
              <button className={s.btnPrimary} type="submit" disabled={historyLoading}>
                {historyLoading ? 'Listando…' : 'Listar pagamentos'}
              </button>
            </form>
            <div style={{ marginTop: '1rem' }}>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
          <section className={s.card} style={{ marginTop: '1.25rem' }}>
            <h2 className={s.cardTitle}>Inadimplência (mensalistas)</h2>
            {!showDelinquent ? (
              <p className={s.lead}>A lista de inadimplentes do mês só é exibida após o dia 15.</p>
            ) : delinquent.length === 0 ? (
              <p className={s.lead}>Nenhum inadimplente nesta pelada para o mês atual.</p>
            ) : (
              <div className={s.trajectoryTableWrap}>
                <table className={s.userListTable}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Mês(es) em atraso</th>
                      <th>Status</th>
                      <th style={{ width: '12rem' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delinquent.map((row) => (
                      <tr key={`${row.userId}-${row.peladaId}`}>
                        <td>{row.userName}</td>
                        <td>{row.email}</td>
                        <td>{formatOverdueMonths(row.overdueMonths)}</td>
                        <td>{formatReminderSentAt(row.reminderSentAt)}</td>
                        <td>
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
        </>
      )}
    </div>
  );
}
