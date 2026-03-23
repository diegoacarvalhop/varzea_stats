import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMatchPlacar, listFinishedMatches, type Match } from '@/services/matchService';
import { appToast } from '@/lib/appToast';
import { SearchableSelect } from '@/components/SearchableSelect';
import { uploadMedia, type MediaType } from '@/services/mediaService';
import s from '@/styles/pageShared.module.scss';

function formatFinishedMatchLabel(m: Match): string {
  const dateStr = new Date(m.date).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `Partida #${m.id} · ${dateStr} · ${m.location} · ${formatMatchPlacar(m.teamScores)}`;
}

export function MediaPage() {
  const [url, setUrl] = useState('');
  const [matchId, setMatchId] = useState('');
  const [finishedMatches, setFinishedMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesLoadFailed, setMatchesLoadFailed] = useState(false);
  const [type, setType] = useState<MediaType>('IMAGE');
  const [lastSavedMatchId, setLastSavedMatchId] = useState<number | null>(null);

  const matchSelectOptions = useMemo(
    () =>
      finishedMatches.map((m) => ({
        value: String(m.id),
        label: formatFinishedMatchLabel(m),
      })),
    [finishedMatches],
  );

  const mediaTypeOptions = useMemo(
    () => [
      { value: 'IMAGE', label: 'Imagem' },
      { value: 'VIDEO', label: 'Vídeo' },
      { value: 'AUDIO', label: 'Áudio' },
      { value: 'OTHER', label: 'Outro' },
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMatchesLoading(true);
      setMatchesLoadFailed(false);
      try {
        const list = await listFinishedMatches();
        if (!cancelled) setFinishedMatches(list);
      } catch {
        if (!cancelled) {
          setMatchesLoadFailed(true);
          appToast.error('Não foi possível carregar as partidas finalizadas.');
          setFinishedMatches([]);
        }
      } finally {
        if (!cancelled) setMatchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLastSavedMatchId(null);
    const trimmed = url.trim();
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        appToast.error('Use uma URL que comece com http:// ou https://.');
        return;
      }
    } catch {
      appToast.error('Informe uma URL válida.');
      return;
    }
    try {
      const mid = Number(matchId);
      if (!Number.isFinite(mid)) {
        appToast.warning('Selecione uma partida.');
        return;
      }
      const res = await uploadMedia({ url: trimmed, type, matchId: mid });
      appToast.success(`Mídia salva (#${res.id}). Quem abrir o detalhe da partida verá o link na galeria.`);
      setLastSavedMatchId(res.matchId);
      setUrl('');
    } catch {
      appToast.error('Falha no envio. Confira URL, partida e permissões.');
    }
  }

  return (
    <div className={s.page}>
      <h1>Upload de mídia</h1>
      <p className={s.lead}>
        Associe um link público a uma <strong>partida encerrada</strong>. Os jogadores e visitantes veem tudo na página
        da partida, em <strong>Mídias da pelada</strong>.
      </p>
      <div className={s.card}>
        <form className={s.form} onSubmit={onSubmit}>
          <div className={s.field}>
            <label className={s.fieldLabel} htmlFor="media-url">
              URL
              <span className={s.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="media-url"
              className={s.input}
              value={url}
              onChange={(ev) => setUrl(ev.target.value)}
              required
              placeholder="https://..."
            />
          </div>
          <SearchableSelect
            id="media-match"
            label={
              <>
                Partida encerrada
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </>
            }
            value={matchId}
            onChange={setMatchId}
            options={matchSelectOptions}
            emptyOption={{
              value: '',
              label: matchesLoading ? 'Carregando partidas…' : 'Selecione a partida',
            }}
            disabled={matchesLoading || matchesLoadFailed}
            required
          />
          {!matchesLoading && !matchesLoadFailed && finishedMatches.length === 0 && (
            <p className={s.lead} style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Não há partidas finalizadas. Encerre uma partida na lista de partidas antes de registrar mídia.
            </p>
          )}
          <SearchableSelect
            id="media-type"
            label="Tipo"
            value={type}
            onChange={(v) => setType(v as MediaType)}
            options={mediaTypeOptions}
          />
          <button
            className={s.btnPrimary}
            type="submit"
            disabled={matchesLoading || matchesLoadFailed || finishedMatches.length === 0}
          >
            Enviar
          </button>
        </form>
        {lastSavedMatchId != null && (
          <p className={s.lead} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <Link to={`/matches/${lastSavedMatchId}`}>Abrir detalhe da partida e ver a galeria →</Link>
          </p>
        )}
      </div>
    </div>
  );
}
