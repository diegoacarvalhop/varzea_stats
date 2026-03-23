import { useState } from 'react';
import type { MatchMediaItem } from '@/services/mediaService';
import { mediaHostname, youtubeThumbnailUrl, youtubeVideoId } from '@/utils/mediaPreview';
import styles from './MatchMediaGallery.module.scss';

const TYPE_LABEL: Record<MatchMediaItem['type'], string> = {
  VIDEO: 'Vídeo',
  IMAGE: 'Imagem',
  AUDIO: 'Áudio',
  OTHER: 'Mídia',
};

const FALLBACK_ICON: Record<MatchMediaItem['type'], string> = {
  VIDEO: '▶',
  IMAGE: '◻',
  AUDIO: '♪',
  OTHER: '◇',
};

function PreviewArea({ item }: { item: MatchMediaItem }) {
  const yt = youtubeVideoId(item.url);
  const [imgOk, setImgOk] = useState(true);

  if (yt) {
    return (
      <>
        <img
          className={styles.previewImg}
          src={youtubeThumbnailUrl(yt)}
          alt=""
          loading="lazy"
        />
        <span className={styles.playBadge} aria-hidden>
          ▶ Abrir
        </span>
      </>
    );
  }

  if (item.type === 'IMAGE' && imgOk) {
    return (
      <img
        className={styles.previewImg}
        src={item.url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgOk(false)}
      />
    );
  }

  return (
    <div className={styles.previewFallback}>
      <span aria-hidden>{FALLBACK_ICON[item.type]}</span>
      <span className={styles.fallbackLabel}>{TYPE_LABEL[item.type]}</span>
    </div>
  );
}

function MediaCard({ item }: { item: MatchMediaItem }) {
  const yt = youtubeVideoId(item.url);
  const [showEmbed, setShowEmbed] = useState(false);
  const host = mediaHostname(item.url);

  return (
    <article className={styles.card}>
      <a
        className={styles.previewLink}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir ${TYPE_LABEL[item.type]} em ${host} (nova aba)`}
      >
        <PreviewArea item={item} />
      </a>
      <div className={styles.meta}>
        <div className={styles.typeRow}>
          <span className={styles.pill}>{TYPE_LABEL[item.type]}</span>
        </div>
        <span className={styles.host}>{host}</span>
        <div className={styles.actions}>
          <a className={styles.btnOpen} href={item.url} target="_blank" rel="noopener noreferrer">
            Abrir link
          </a>
          {yt && (
            <button
              type="button"
              className={styles.btnInline}
              onClick={() => setShowEmbed((v) => !v)}
              aria-expanded={showEmbed}
            >
              {showEmbed ? 'Fechar preview' : 'Ver aqui'}
            </button>
          )}
        </div>
      </div>
      {showEmbed && yt && (
        <div className={styles.embed}>
          <iframe
            className={styles.embedIframe}
            title={`YouTube — ${host}`}
            src={`https://www.youtube-nocookie.com/embed/${yt}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </article>
  );
}

export function MatchMediaGallery({ items }: { items: MatchMediaItem[] }) {
  return (
    <section className={styles.wrap} aria-labelledby="match-media-heading">
      <div className={styles.head}>
        <h2 className={styles.title} id="match-media-heading">
          Mídias da pelada
        </h2>
        <p className={styles.sub}>
          Fotos, vídeos e áudios compartilhados para esta partida. Use <strong>Abrir link</strong> no celular ou{' '}
          <strong>Ver aqui</strong> para YouTube.
        </p>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>Ainda não há mídias registradas para esta partida.</p>
      ) : (
        <div className={styles.strip} role="list">
          {items.map((item) => (
            <div key={item.id} role="listitem">
              <MediaCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
