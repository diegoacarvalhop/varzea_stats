import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLanceRankings,
  getVoteRanking,
  type LanceRankings,
  type VoteRanking,
} from '@/services/statsService';
import {
  formatMatchPlacar,
  getCurrentOpenMatch,
  type Match,
} from '@/services/matchService';
import { useAuth } from '@/hooks/useAuth';
import { hasAnyRole, isAnyAdmin, MEDIA_ROLES } from '@/lib/roles';
import s from '@/styles/pageShared.module.scss';

function TempoRealPreview({ match, loading }: { match: Match | null; loading: boolean }) {
  if (loading) return <>Carregando…</>;
  if (!match) return <>Nenhuma partida aberta no momento.</>;
  return (
    <>
      <strong>Partida #{match.id}</strong>
      <br />
      {new Date(match.date).toLocaleString('pt-BR')} · {match.location}
      <br />
      <span className={s.openMatchPlacar}>{formatMatchPlacar(match.teamScores)}</span>
    </>
  );
}

function RankingCardPreview({
  lances,
  votes,
  loading,
}: {
  lances: LanceRankings | null;
  votes: VoteRanking | null;
  loading: boolean;
}) {
  if (loading) return <>Carregando…</>;
  const topGol = lances?.blocks?.find((b) => b.eventType === 'GOAL')?.entries?.[0];
  const topCheia = votes?.bolaCheia?.[0];
  return (
    <>
      {topGol ? (
        <>
          Artilheiro: <strong>{topGol.playerName}</strong> · {topGol.eventCount} gol(s)
        </>
      ) : (
        <>Sem gols registrados nos lances.</>
      )}
      <br />
      {topCheia ? (
        <>
          Bola cheia: <strong>{topCheia.playerName}</strong> · {topCheia.voteCount} voto(s)
        </>
      ) : (
        <>Sem votos de bola cheia ainda.</>
      )}
    </>
  );
}

export function DashboardPage() {
  const { isAuthenticated, roles } = useAuth();
  const [voteRanking, setVoteRanking] = useState<VoteRanking | null>(null);
  const [lanceRankings, setLanceRankings] = useState<LanceRankings | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const [v, l, open] = await Promise.all([
        getVoteRanking(5),
        getLanceRankings(5),
        getCurrentOpenMatch(),
      ]);
      setVoteRanking(v);
      setLanceRankings(l);
      setOpenMatch(open);
    } catch {
      setVoteRanking(null);
      setLanceRankings(null);
      setOpenMatch(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  return (
    <div className={s.page}>
      <h1>Dashboard</h1>
      <p className={s.lead}>
        Atalhos para as áreas do VARzea Stats. O ranking reúne <strong>gols e demais lances</strong> por tipo, além da{' '}
        <strong>votação</strong> da galera.
      </p>
      {!isAuthenticated && (
        <p className={s.lead}>
          Faça login para registrar partidas, eventos e enviar mídia conforme seu perfil de acesso.
        </p>
      )}

      <div className={s.featureGrid}>
        <Link
          to={openMatch ? `/matches/${openMatch.id}` : '/matches'}
          className={s.featureCardLink}
        >
          <div className={s.featureIcon}>⚡</div>
          <h2>Tempo real</h2>
          <p className={s.featureText}>
            {openMatch
              ? 'Partida em andamento — abra para escalação, lances e placar ao vivo.'
              : 'Quando houver uma partida sem encerrar, ela aparece aqui. Crie ou retome pelo calendário de jogos.'}
          </p>
          <p className={s.featureCardPreview}>
            <TempoRealPreview match={openMatch} loading={previewLoading} />
          </p>
          <span className={s.featureCardCta}>
            {openMatch ? 'Ir para a partida aberta →' : 'Ver lista de partidas →'}
          </span>
        </Link>

        <Link to="/stats" className={s.featureCardLink}>
          <div className={s.featureIcon}>📊</div>
          <h2>Estatísticas</h2>
          <p className={s.featureText}>
            Consulte gols, cartões, assistências e votos — escolha o jogador na lista de quem já foi escalado.
          </p>
          <span className={s.featureCardCta}>Ir para estatísticas →</span>
        </Link>

        {hasAnyRole(roles, MEDIA_ROLES) && (
          <Link to="/media" className={s.featureCardLink}>
            <div className={s.featureIcon}>🎬</div>
            <h2>Mídia</h2>
            <p className={s.featureText}>
              Cadastre URLs de fotos e vídeos vinculadas à partida (administradores da pelada ou geral, e mídia).
            </p>
            <span className={s.featureCardCta}>Abrir mídia →</span>
          </Link>
        )}

        {isAnyAdmin(roles) && (
          <Link to="/admin/users" className={s.featureCardLink}>
            <div className={s.featureIcon}>👤</div>
            <h2>Usuários</h2>
            <p className={s.featureText}>
              Cadastre contas e papéis. O administrador geral vê todas as peladas; o da pelada só a sua.
            </p>
            <span className={s.featureCardCta}>Gerenciar usuários →</span>
          </Link>
        )}

        <Link to="/ranking#ranking-lances" className={s.featureCardLink}>
          <div className={s.featureIcon}>🏆</div>
          <h2>Ranking</h2>
          <p className={s.featureText}>
            Gols, assistências, cartões e outros lances — cada tipo com sua tabela. Depois, bola cheia e bola murcha.
          </p>
          <p className={s.featureCardPreview}>
            <RankingCardPreview lances={lanceRankings} votes={voteRanking} loading={previewLoading} />
          </p>
          <span className={s.featureCardCta}>Ver rankings completos →</span>
        </Link>
      </div>
    </div>
  );
}
