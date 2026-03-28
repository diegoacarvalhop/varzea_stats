import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { getApiErrorMessage } from '@/lib/apiError';
import { hmsDurationValueToSeconds, secondsToHmsDurationValue } from '@/lib/durationTime';
import { centsToMasked, maskCurrencyBRInput, parseMaskedMoneyToCents } from '@/lib/moneyMask';
import { listPeladas, updatePeladaSettings, type Pelada } from '@/services/peladaService';
import s from '@/styles/pageShared.module.scss';

/** ISO-8601: 1 = segunda … 7 = domingo */
const WEEKDAYS: { iso: number; label: string }[] = [
  { iso: 1, label: 'Seg' },
  { iso: 2, label: 'Ter' },
  { iso: 3, label: 'Qua' },
  { iso: 4, label: 'Qui' },
  { iso: 5, label: 'Sex' },
  { iso: 6, label: 'Sáb' },
  { iso: 7, label: 'Dom' },
];

export function PeladaSettingsPage() {
  const { peladaId } = useAuth();
  const [pelada, setPelada] = useState<Pelada | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [active, setActive] = useState(true);
  const [location, setLocation] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [monthlyDueDay, setMonthlyDueDay] = useState('');
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [monthlyFee, setMonthlyFee] = useState('');
  const [dailyFee, setDailyFee] = useState('');
  const [teamCount, setTeamCount] = useState('');
  const [linePlayersPerTeam, setLinePlayersPerTeam] = useState('');
  const [teamNames, setTeamNames] = useState('');
  const [matchDuration, setMatchDuration] = useState('');
  const [matchGoals, setMatchGoals] = useState('');

  const load = useCallback(async () => {
    if (peladaId == null) {
      setPelada(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listPeladas();
      const p = list.find((x) => x.id === peladaId) ?? null;
      setPelada(p);
      if (p) {
        setActive(p.active !== false);
        setLocation(p.location ?? '');
        setScheduleTime(p.scheduleTime ?? '');
        const due = p.monthlyDueDay;
        setMonthlyDueDay(typeof due === 'number' && due >= 1 && due <= 31 ? String(due) : '');
        setWeekdays(new Set(p.scheduleWeekdays ?? []));
        setMonthlyFee(centsToMasked(p.monthlyFeeCents));
        setDailyFee(centsToMasked(p.dailyFeeCents));
        setTeamCount(p.teamCount != null ? String(p.teamCount) : '');
        setLinePlayersPerTeam(
          p.linePlayersPerTeam != null && p.linePlayersPerTeam > 0 ? String(p.linePlayersPerTeam) : '',
        );
        setTeamNames(p.teamNames ?? '');
        setMatchDuration(secondsToHmsDurationValue(p.matchDurationSeconds ?? null));
        setMatchGoals(p.matchGoalsToEnd != null ? String(p.matchGoalsToEnd) : '');
      }
    } catch {
      appToast.error('Não foi possível carregar os dados da pelada.');
      setPelada(null);
    } finally {
      setLoading(false);
    }
  }, [peladaId]);

  useEffect(() => {
    document.title = 'Configuração da pelada · VARzea Stats';
    void load();
  }, [load]);

  function toggleWeekday(iso: number, on: boolean) {
    setWeekdays((prev) => {
      const n = new Set(prev);
      if (on) n.add(iso);
      else n.delete(iso);
      return n;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (peladaId == null || pelada == null) {
      return;
    }
    const tcTrim = teamCount.trim();
    if (tcTrim === '') {
      appToast.warning('Informe a quantidade de equipes (mínimo 2).');
      return;
    }
    const tc = Number(tcTrim);
    if (!Number.isFinite(tc) || tc < 2) {
      appToast.warning('Quantidade de equipes deve ser pelo menos 2.');
      return;
    }
    const lpTrim = linePlayersPerTeam.trim();
    let linePlayersPayload = 0;
    if (lpTrim !== '') {
      const lp = Number(lpTrim);
      if (!Number.isFinite(lp) || lp < 1) {
        appToast.warning('Jogadores por equipe deve ser um número inteiro ≥ 1 ou deixe em branco (sem limite no sorteio).');
        return;
      }
      linePlayersPayload = Math.floor(lp);
    }
    const monthlyCents = parseMaskedMoneyToCents(monthlyFee);
    const dailyCents = parseMaskedMoneyToCents(dailyFee);
    if (monthlyFee.trim() !== '' && monthlyCents == null) {
      appToast.warning('Valor da mensalidade inválido.');
      return;
    }
    if (dailyFee.trim() !== '' && dailyCents == null) {
      appToast.warning('Valor da diária inválido.');
      return;
    }
    const durationSec = hmsDurationValueToSeconds(matchDuration);
    const mg = matchGoals.trim() === '' ? null : Number(matchGoals);
    const weekdayList = [...weekdays].sort((a, b) => a - b);
    const dueTrim = monthlyDueDay.trim();
    const dueNum = dueTrim === '' ? 15 : Number(dueTrim);
    if (!Number.isFinite(dueNum) || dueNum < 1 || dueNum > 31) {
      appToast.warning('Dia de vencimento da mensalidade deve ser um número entre 1 e 31.');
      return;
    }
    setSaving(true);
    try {
      await updatePeladaSettings(peladaId, {
        active,
        location: location.trim() || null,
        scheduleTime: scheduleTime.trim(),
        monthlyDueDay: Math.floor(dueNum),
        scheduleWeekdays: weekdayList,
        monthlyFeeCents: monthlyCents,
        dailyFeeCents: dailyCents,
        teamCount: tc,
        linePlayersPerTeam: linePlayersPayload,
        teamNames: teamNames.trim() || null,
        matchDurationSeconds: durationSec,
        matchGoalsToEnd: mg != null && Number.isFinite(mg) ? mg : null,
      });
      appToast.success('Configurações salvas.');
      await load();
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível salvar.'));
    } finally {
      setSaving(false);
    }
  }

  if (peladaId == null) {
    return (
      <div className={s.page}>
        <p className={s.lead}>Selecione uma pelada no contexto do sistema.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={s.page}>
        <p className={s.lead}>Carregando…</p>
      </div>
    );
  }

  if (!pelada) {
    return (
      <div className={s.page}>
        <p className={s.lead}>Pelada não encontrada.</p>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <h1>Configuração — {pelada.name}</h1>
      <p className={s.lead}>
        Valores financeiros, equipes, local, dias e horário da pelada, e regras de partida. O sorteio de times usa a
        lista de presença e equilibra por estatísticas dos jogadores.
      </p>
      {pelada.scheduleLegacyLabel ? (
        <p className={s.lead} style={{ marginTop: '-0.5rem' }}>
          Horário atual (texto antigo): <strong>{pelada.scheduleLegacyLabel}</strong>. Ao salvar com os campos abaixo,
          esse texto será substituído pelo novo formato.
        </p>
      ) : null}
      <form className={`${s.card} ${s.form}`} onSubmit={(e) => void onSubmit(e)} style={{ maxWidth: '36rem' }}>
        <label className={s.checkboxRow}>
          <input type="checkbox" checked={active} onChange={(ev) => setActive(ev.target.checked)} />
          <span>Pelada ativa (aparece na página inicial pública)</span>
        </label>
        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="ps-loc">
            Local
          </label>
          <input
            id="ps-loc"
            className={s.input}
            value={location}
            onChange={(ev) => setLocation(ev.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={s.field}>
          <span className={s.fieldLabel} id="ps-days-label">
            Dias da pelada
          </span>
          <div className={s.weekdayGrid} role="group" aria-labelledby="ps-days-label">
            {WEEKDAYS.map(({ iso, label }) => (
              <label key={iso} className={s.checkboxRow} style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={weekdays.has(iso)}
                  onChange={(ev) => toggleWeekday(iso, ev.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.fieldLabel} htmlFor="ps-due">
              Dia de vencimento
            </label>
            <input
              id="ps-due"
              className={s.input}
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              placeholder="15"
              value={monthlyDueDay}
              onChange={(ev) => setMonthlyDueDay(ev.target.value)}
            />
          </div>
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.fieldLabel} htmlFor="ps-time">
              Horário da pelada
            </label>
            <input
              id="ps-time"
              className={s.input}
              type="time"
              value={scheduleTime}
              onChange={(ev) => setScheduleTime(ev.target.value)}
            />
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.fieldLabel} htmlFor="ps-mf">
              Valor da mensalidade
            </label>
            <input
              id="ps-mf"
              className={s.input}
              inputMode="numeric"
              autoComplete="off"
              placeholder="R$ 0,00"
              value={monthlyFee}
              onChange={(ev) => setMonthlyFee(maskCurrencyBRInput(ev.target.value))}
            />
          </div>
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.fieldLabel} htmlFor="ps-df">
              Valor da diária
            </label>
            <input
              id="ps-df"
              className={s.input}
              inputMode="numeric"
              autoComplete="off"
              placeholder="R$ 0,00"
              value={dailyFee}
              onChange={(ev) => setDailyFee(maskCurrencyBRInput(ev.target.value))}
            />
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.fieldLabel} htmlFor="ps-tc">
              Quantidade de equipes
            </label>
            <input
              id="ps-tc"
              className={s.input}
              type="number"
              min={2}
              placeholder="4"
              value={teamCount}
              onChange={(ev) => setTeamCount(ev.target.value)}
            />
          </div>
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.fieldLabel} htmlFor="ps-lp">
              Jogadores de linha por equipe
            </label>
            <input
              id="ps-lp"
              className={s.input}
              type="number"
              min={1}
              placeholder="Ex.: 5"
              value={linePlayersPerTeam}
              onChange={(ev) => setLinePlayersPerTeam(ev.target.value)}
            />
            <span className={s.statsDetailMeta} style={{ display: 'block', marginTop: '0.35rem' }}>
              No sorteio da partida: teto de jogadores de campo por time (goleiros não contam). Vazio = sem limite.
            </span>
          </div>
        </div>
        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="ps-tn">
            Nomes das equipes (um por linha, vírgula ou ponto e vírgula)
          </label>
          <textarea
            id="ps-tn"
            className={s.input}
            rows={4}
            value={teamNames}
            onChange={(ev) => setTeamNames(ev.target.value)}
          />
        </div>
        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="ps-md">
            Duração de cada partida (HH:MM:SS), opcional
          </label>
          <input
            id="ps-md"
            className={s.input}
            type="time"
            step={1}
            value={matchDuration}
            onChange={(ev) => setMatchDuration(ev.target.value)}
          />
        </div>
        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="ps-mg">
            Gols para encerrar a partida, opcional
          </label>
          <input
            id="ps-mg"
            className={s.input}
            type="number"
            min={1}
            value={matchGoals}
            onChange={(ev) => setMatchGoals(ev.target.value)}
          />
        </div>
        <div className={s.formActions}>
          <button className={s.btnPrimary} type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
