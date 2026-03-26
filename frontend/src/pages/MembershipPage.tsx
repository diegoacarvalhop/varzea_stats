import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getPublicPeladaCards, type PeladaPublicCard } from '@/services/peladaService';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { getApiErrorMessage } from '@/lib/apiError';
import s from '@/styles/pageShared.module.scss';

export function MembershipPage() {
  const { membershipPeladaIds, billingMonthlyByPelada, updateMemberships } = useAuth();
  const [cards, setCards] = useState<PeladaPublicCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(membershipPeladaIds));
  const [monthlyByPelada, setMonthlyByPelada] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPublicPeladaCards();
      setCards(list);
    } catch {
      appToast.error('Não foi possível carregar as peladas.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Minhas peladas · VARzea Stats';
    void load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set(membershipPeladaIds));
    setMonthlyByPelada((prev) => {
      const next: Record<number, boolean> = {};
      for (const id of membershipPeladaIds) {
        const authVal = billingMonthlyByPelada[String(id)];
        next[id] = typeof authVal === 'boolean' ? authVal : id in prev ? prev[id] : true;
      }
      return next;
    });
  }, [membershipPeladaIds, billingMonthlyByPelada]);

  const sorted = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [cards],
  );

  function togglePelada(id: number, on: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) {
        n.add(id);
        setMonthlyByPelada((m) => ({ ...m, [id]: m[id] !== false }));
      } else {
        n.delete(id);
      }
      return n;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const peladaIds = [...selected].sort((a, b) => a - b);
    const billingMonthlyByPelada: Record<string, boolean> = {};
    for (const id of peladaIds) {
      billingMonthlyByPelada[String(id)] = monthlyByPelada[id] !== false;
    }
    setSaving(true);
    try {
      await updateMemberships({ peladaIds, billingMonthlyByPelada });
      appToast.success('Peladas atualizadas.');
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível salvar.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.page}>
      <h1>Minhas peladas</h1>
      <p className={s.lead}>
        Marque em quais peladas você participa. Você pode alterar quando quiser. Para cada pelada, indique se prefere{' '}
        <strong>mensalista</strong> (pagamento mensal até o dia de vencimento definido pela pelada) ou{' '}
        <strong>só diária</strong> quando jogar.
      </p>
      {loading ? (
        <p className={s.lead}>Carregando…</p>
      ) : (
        <form className={s.card} onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sorted.map((p) => {
              const on = selected.has(p.id);
              return (
                <li
                  key={p.id}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '0.85rem 1rem',
                  }}
                >
                  <label className={s.checkboxRow} style={{ alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(ev) => togglePelada(p.id, ev.target.checked)}
                    />
                    <span>
                      <strong>{p.name}</strong>
                      <span className={s.statsDetailMeta} style={{ display: 'block', marginTop: '0.25rem' }}>
                        {p.location?.trim() || 'Local não informado'} · {p.scheduleLabel?.trim() || 'Horário não informado'}
                      </span>
                    </span>
                  </label>
                  {on && (
                    <label className={s.checkboxRow} style={{ marginTop: '0.65rem', marginLeft: '1.6rem' }}>
                      <input
                        type="checkbox"
                        checked={monthlyByPelada[p.id] !== false}
                        onChange={(ev) =>
                          setMonthlyByPelada((m) => ({
                            ...m,
                            [p.id]: ev.target.checked,
                          }))
                        }
                      />
                      <span>Sou mensalista nesta pelada (cobrança mensal até o vencimento configurado pelo grupo)</span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          {sorted.length === 0 ? (
            <p className={s.lead}>Nenhuma pelada ativa disponível.</p>
          ) : (
            <button className={s.btnPrimary} type="submit" disabled={saving} style={{ marginTop: '1.25rem' }}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
