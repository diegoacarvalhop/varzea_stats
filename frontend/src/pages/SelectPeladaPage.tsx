import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { setPeladaContext } from '@/lib/peladaContext';
import { peladaLogoAbsoluteUrl } from '@/lib/peladaLogoUrl';
import { isAdminGeral } from '@/lib/roles';
import { appToast } from '@/lib/appToast';
import { createPelada, listPeladas, type Pelada } from '@/services/peladaService';
import s from '@/styles/pageShared.module.scss';

function PeladaPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5.5l2.5 4.5h-5L12 5.5z" />
      <path d="M7 13.5h10" />
    </svg>
  );
}

function PeladaListThumb({ pelada }: { pelada: Pelada }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = pelada.hasLogo && !imgFailed;

  return (
    <span className={s.peladaListIconWrap} aria-hidden>
      {showImg ? (
        <img
          className={s.peladaListIconImg}
          src={peladaLogoAbsoluteUrl(pelada.id)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <PeladaPlaceholderIcon className={s.peladaListIconPlaceholder} />
      )}
    </span>
  );
}

export function SelectPeladaPage() {
  const navigate = useNavigate();
  const { isAuthenticated, roles } = useAuth();
  const isAdminGlobal = isAdminGeral(roles);

  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listPeladas();
      setPeladas(list);
    } catch {
      appToast.error('Não foi possível carregar as peladas.');
      setPeladas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedPeladas = useMemo(
    () => [...peladas].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [peladas],
  );

  const filteredPeladas = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    if (!q) return sortedPeladas;
    return sortedPeladas.filter((p) => p.name.toLocaleLowerCase('pt-BR').includes(q));
  }, [search, sortedPeladas]);

  const totalPages = Math.max(1, Math.ceil(filteredPeladas.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStart = (page - 1) * pageSize;
  const pagedPeladas = filteredPeladas.slice(pageStart, pageStart + pageSize);

  function choose(p: Pelada) {
    setPeladaContext(p.id, p.name, Boolean(p.hasLogo));
    navigate(isAuthenticated ? '/' : '/login', { replace: true });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      appToast.warning('Informe o nome do grupo.');
      return;
    }
    setCreating(true);
    try {
      const p = await createPelada(newName.trim(), newLogo);
      setNewName('');
      setNewLogo(null);
      appToast.success('Pelada criada.');
      await load();
      choose(p);
    } catch {
      appToast.error(
        'Não foi possível criar a pelada (apenas o administrador geral pode cadastrar). Verifique nome e imagem (PNG, JPEG, GIF ou WebP, até 2 MB).',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={s.page}>
      <h1>Peladas disponíveis</h1>
      <p className={s.lead}>
        Selecione a pelada desejada para continuar para o login. A lista é exibida em ordem alfabética.
      </p>
      {!isAuthenticated && (
        <p className={s.lead} style={{ marginTop: '-0.75rem' }}>
          Se você é <strong>administrador geral</strong> e ainda não existem peladas,{' '}
          <Link to="/login">entre aqui</Link> para criar a primeira.
        </p>
      )}

      {isAuthenticated && isAdminGlobal && (
        <div className={s.card} style={{ marginBottom: '1.25rem' }}>
          <h2 className={s.cardTitle}>Nova pelada</h2>
          <form className={s.form} onSubmit={(e) => void onCreate(e)} style={{ maxWidth: '36rem' }}>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="pelada-name">
                Nome do grupo
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </label>
              <input
                id="pelada-name"
                className={s.input}
                value={newName}
                onChange={(ev) => setNewName(ev.target.value)}
                placeholder="Ex.: Pelada do Juqueri"
                required
                disabled={!isAuthenticated}
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="pelada-logo">
                Logomarca (opcional)
              </label>
              <input
                id="pelada-logo"
                className={s.input}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                disabled={!isAuthenticated}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  setNewLogo(f ?? null);
                }}
              />
              <span className={s.statsDetailMeta}>
                PNG, JPEG, GIF ou WebP — até 2 MB. Aparece no fundo do site, no ícone da aba e ao lado do nome VARzea.
              </span>
            </div>
            <button className={s.btnPrimary} type="submit" disabled={creating || !isAuthenticated}>
              {creating ? 'Criando…' : 'Cadastrar e entrar'}
            </button>
          </form>
          {!isAuthenticated && (
            <p className={s.lead} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <Link to="/login">Entre como administrador</Link> para criar peladas.
            </p>
          )}
        </div>
      )}

      <div className={s.card}>
        <h2 className={s.cardTitle}>Escolha sua pelada</h2>
        <div className={s.formInline}>
          <div className={s.field} style={{ flex: 1, minWidth: '16rem' }}>
            <label className={s.fieldLabel} htmlFor="pelada-search">
              Buscar pelada
            </label>
            <input
              id="pelada-search"
              className={s.input}
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              placeholder="Digite o nome da pelada"
            />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel} htmlFor="pelada-page-size">
              Itens por página
            </label>
            <select
              id="pelada-page-size"
              className={s.input}
              value={String(pageSize)}
              onChange={(ev) => setPageSize(Number(ev.target.value))}
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
        {loading ? (
          <p className={s.lead}>Carregando…</p>
        ) : filteredPeladas.length === 0 ? (
          <p className={s.lead}>Nenhuma pelada cadastrada ainda.</p>
        ) : (
          <>
            <ul className={s.matchList}>
            {pagedPeladas.map((p) => (
              <li key={p.id} className={s.matchItem}>
                <button type="button" className={s.matchLink} onClick={() => choose(p)}>
                  <PeladaListThumb pelada={p} />
                  <span className={s.matchMeta}>{p.name}</span>
                  <span className={s.matchChevron}>→</span>
                </button>
              </li>
            ))}
            </ul>
            <div className={s.formInline} style={{ justifyContent: 'space-between', marginTop: '0.9rem' }}>
              <span className={s.statsDetailMeta}>
                Mostrando {pageStart + 1}-{Math.min(pageStart + pageSize, filteredPeladas.length)} de{' '}
                {filteredPeladas.length} peladas
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className={s.btnGhost} type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </button>
                <span className={s.statsDetailMeta}>
                  Página {page} de {totalPages}
                </span>
                <button
                  className={s.btnGhost}
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isAuthenticated && (
        <p className={s.lead} style={{ marginTop: '1rem' }}>
          <Link to="/">Voltar ao dashboard</Link>
        </p>
      )}
    </div>
  );
}
