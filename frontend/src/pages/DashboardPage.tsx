import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLanceRankings, type LanceRankings } from '@/services/statsService';
import {
  formatMatchPlacarForListItem,
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
      <span className={s.openMatchPlacar}>{formatMatchPlacarForListItem(match) || '—'}</span>
    </>
  );
}

function RankingCardPreview({ lances, loading }: { lances: LanceRankings | null; loading: boolean }) {
  if (loading) return <>Carregando…</>;
  const topGol = lances?.blocks?.find((b) => b.eventType === 'GOAL')?.entries?.[0];
  return (
    <>
      {topGol ? (
        <>
          Artilheiro: <strong>{topGol.playerName}</strong> · {topGol.eventCount} gol(s)
        </>
      ) : (
        <>Sem gols registrados nos lances.</>
      )}
    </>
  );
}

export function DashboardPage() {
  const { isAuthenticated, roles } = useAuth();
  const [lanceRankings, setLanceRankings] = useState<LanceRankings | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const [l, open] = await Promise.all([getLanceRankings(5), getCurrentOpenMatch()]);
      setLanceRankings(l);
      setOpenMatch(open);
    } catch {
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
        Atalhos para as áreas do VARzea Stats. O ranking reúne <strong>gols e demais lances</strong> por tipo.
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
            Consulte gols, cartões e assistências — escolha o jogador na lista de quem já foi escalado.
          </p>
          <span className={s.featureCardCta}>Ir para estatísticas →</span>
        </Link>

        {hasAnyRole(roles, MEDIA_ROLES) && (
          <Link to="/media" className={s.featureCardLink}>
            <div className={s.featureIcon}>🎬</div>
            <h2>Mídia</h2>
            <p className={s.featureText}>
              Cadastre URLs de fotos e vídeos vinculadas à partida (administrador geral ou administrador, e mídia).
            </p>
            <span className={s.featureCardCta}>Abrir mídia →</span>
          </Link>
        )}

        {isAnyAdmin(roles) && (
          <Link to="/admin/users" className={s.featureCardLink}>
            <div className={s.featureIcon}>👤</div>
            <h2>Usuários</h2>
            <p className={s.featureText}>
              Cadastre contas e papéis. O administrador geral vê todas as peladas; o administrador só a sua.
            </p>
            <span className={s.featureCardCta}>Gerenciar usuários →</span>
          </Link>
        )}

        <Link to="/ranking#ranking-lances" className={s.featureCardLink}>
          <div className={s.featureIcon}>🏆</div>
          <h2>Ranking</h2>
          <p className={s.featureText}>
            Gols, assistências, cartões e outros lances — cada tipo com sua tabela.
          </p>
          <p className={s.featureCardPreview}>
            <RankingCardPreview lances={lanceRankings} loading={previewLoading} />
          </p>
          <span className={s.featureCardCta}>Ver rankings completos →</span>
        </Link>
      </div>
    </div>
  );
}
