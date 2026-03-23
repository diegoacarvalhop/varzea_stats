import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createMatch, formatMatchPlacar, listMatches, type Match } from '@/services/matchService';
import { useAuth } from '@/hooks/useAuth';
import { hasAnyRole, MATCH_MANAGER_ROLES } from '@/lib/roles';
import { appToast } from '@/lib/appToast';
import { fromDatetimeLocalToUtcIso, toDatetimeLocalString } from '@/utils/datetimeLocal';
import s from '@/styles/pageShared.module.scss';

export function MatchesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, roles } = useAuth();
  const canCreate = isAuthenticated && hasAnyRole(roles, MATCH_MANAGER_ROLES);

  const [matches, setMatches] = useState<Match[]>([]);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => toDatetimeLocalString());

  const loadMatches = useCallback(async () => {
    try {
      const data = await listMatches();
      setMatches(data);
    } catch {
      appToast.error('Não foi possível carregar as partidas.');
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (window.location.hash !== '#nova-partida') return;
    if (!canCreate) {
      window.history.replaceState(null, '', '/matches');
      return;
    }
    const id = window.requestAnimationFrame(() => {
      document.getElementById('nova-partida')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', '/matches');
    });
    return () => window.cancelAnimationFrame(id);
  }, [canCreate]);

  async function onCreateMatch(e: FormEvent) {
    e.preventDefault();
    try {
      const instant = fromDatetimeLocalToUtcIso(date);
      const created = await createMatch({ date: instant, location: location.trim() });
      setLocation('');
      setDate(toDatetimeLocalString());
      appToast.success('Partida criada. Abrindo a tela da partida…');
      await loadMatches();
      navigate(`/matches/${created.id}`, { replace: false });
    } catch {
      appToast.error('Falha ao criar partida. Verifique permissões (administrador, SCOUT ou MEDIA).');
    }
  }

  return (
    <div className={s.page}>
      <h1>Partidas</h1>
      <p className={s.lead}>
        Crie uma partida e abra o <strong>detalhe</strong> para montar as equipes, jogadores e registrar todos os
        lances desta pelada. Os stats só fazem sentido no contexto de cada jogo.
      </p>
      {canCreate && (
        <div className={s.card} id="nova-partida">
          <h2 className={s.cardTitle}>Nova partida</h2>
          <form className={s.form} onSubmit={onCreateMatch}>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="match-datetime">
                Data e hora
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </label>
              <input
                id="match-datetime"
                className={s.input}
                type="datetime-local"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="match-location">
                Local / campo
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </label>
              <input
                id="match-location"
                className={s.input}
                value={location}
                onChange={(ev) => setLocation(ev.target.value)}
                required
                placeholder="Ex.: Campo do Juqueri"
              />
            </div>
            <button className={s.btnPrimary} type="submit">
              Criar e ir para a partida
            </button>
          </form>
        </div>
      )}

      {!canCreate && (
        <p className={s.lead}>
          Faça login como <strong>administrador</strong>, <strong>SCOUT</strong> ou <strong>MEDIA</strong> para criar
          partidas.
        </p>
      )}

      <h2 className={s.cardTitle} style={{ marginTop: '0.5rem' }}>
        Jogos
      </h2>
      <ul className={s.matchList}>
        {matches.map((m) => (
          <li key={m.id} className={s.matchItem}>
            <Link to={`/matches/${m.id}`} className={s.matchLink}>
              <span className={s.matchId}>#{m.id}</span>
              {m.finishedAt && <span className={s.matchFinishedTag}>Encerrada</span>}
              <span className={s.matchMeta}>{new Date(m.date).toLocaleString('pt-BR')}</span>
              <span className={s.matchMeta}>{m.location}</span>
              <span className={s.matchPlacar}>{formatMatchPlacar(m.teamScores)}</span>
              <span className={s.matchChevron}>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
