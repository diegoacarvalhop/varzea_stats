import { useEffect, useId, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePeladaBranding } from '@/hooks/usePeladaBranding';
import { getPeladaId, getPeladaName } from '@/lib/peladaContext';
import {
  FINANCE_MODULE_ROLES,
  hasAnyRole,
  hasRole,
  isAdminGeral,
  isAnyAdmin,
  MEDIA_ROLES,
  PELADA_SETTINGS_ROLES,
  roleDisplayLabel,
} from '@/lib/roles';
import { effectiveMonthlyDueDayInMonth } from '@/lib/effectiveMonthlyDueDay';
import { listPeladas, type Pelada } from '@/services/peladaService';
import pageShared from '@/styles/pageShared.module.scss';
import styles from './Layout.module.scss';

function navClass(isActive: boolean) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

const DEFAULT_FAVICON = '/favicon.svg';
const APP_TITLE = 'VARzea Stats';

export function Layout() {
  const peladaGearTooltipId = useId();
  const location = useLocation();
  const {
    name,
    roles,
    peladaId,
    peladaName,
    peladaMonthlyDueDay,
    refreshProfile,
    logout,
    membershipPeladaIds,
    monthlyDelinquentPeladaIds,
    billingMonthlyByPelada,
    switchPelada,
  } = useAuth();
  const { logoUrl } = usePeladaBranding();
  const [headerLogoBroken, setHeaderLogoBroken] = useState(false);
  const [membershipPeladas, setMembershipPeladas] = useState<Pelada[]>([]);

  useEffect(() => {
    setHeaderLogoBroken(false);
  }, [logoUrl]);

  useEffect(() => {
    if (membershipPeladaIds.length <= 1) {
      setMembershipPeladas([]);
      return;
    }
    void listPeladas()
      .then((list) => {
        const set = new Set(membershipPeladaIds);
        setMembershipPeladas(list.filter((p) => set.has(p.id)));
      })
      .catch(() => setMembershipPeladas([]));
  }, [membershipPeladaIds]);

  const resolvedPeladaLabel =
    roles && roles.length > 0 && !isAdminGeral(roles)
      ? peladaName?.trim() || (peladaId != null ? `Pelada #${peladaId}` : 'Sua pelada')
      : getPeladaName() ?? (getPeladaId() ? `Pelada #${getPeladaId()}` : null);

  useEffect(() => {
    document.title = resolvedPeladaLabel ? `${resolvedPeladaLabel} · ${APP_TITLE}` : APP_TITLE;
  }, [resolvedPeladaLabel]);

  useEffect(() => {
    const href = logoUrl ?? DEFAULT_FAVICON;
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (logoUrl) {
      link.removeAttribute('type');
    } else {
      link.type = 'image/svg+xml';
    }
    link.href = href;
  }, [logoUrl]);

  const adminGeralOnUsersRoute =
    isAdminGeral(roles) && location.pathname.startsWith('/admin/users');
  const adminSemPelada = hasRole(roles, 'ADMIN') && !isAdminGeral(roles) && peladaId == null;
  const adminOnboardingCriarPelada =
    adminSemPelada && location.pathname === '/pelada';
  const adminMustPickPelada =
    ((isAdminGeral(roles) && !getPeladaId()) || adminSemPelada) &&
    location.pathname !== '/pelada' &&
    !adminGeralOnUsersRoute;

  const showPeladaBar = Boolean(resolvedPeladaLabel);
  const canSwitchPeladaAdmin = isAdminGeral(roles);
  const canSwitchPeladaMember = !isAdminGeral(roles) && membershipPeladaIds.length > 1;
  const showNav = !adminOnboardingCriarPelada;
  const brandTo = adminOnboardingCriarPelada ? '/pelada' : '/painel';

  /** ID numérico da pelada em contexto (evita falha de banner com peladaId string vs ids numéricos do /me). */
  const numericPeladaId = useMemo(() => {
    if (peladaId == null) return null;
    const n = Number(peladaId);
    return Number.isFinite(n) ? n : null;
  }, [peladaId]);

  /**
   * Mensalista na pelada em contexto (diarista = billingMonthlyByPelada[id] === false).
   * Chave ausente conta como mensalista; mapa vazio costuma vir do /me quando ainda não havia PLAYER na sessão local.
   */
  const isMensalistaNaPeladaAtual = useMemo(() => {
    if (numericPeladaId == null) return false;
    return billingMonthlyByPelada[String(numericPeladaId)] !== false;
  }, [numericPeladaId, billingMonthlyByPelada]);

  const dueDayThisMonth =
    peladaMonthlyDueDay != null
      ? effectiveMonthlyDueDayInMonth(peladaMonthlyDueDay, new Date())
      : effectiveMonthlyDueDayInMonth(15, new Date());

  /** Não exige hasRole(PLAYER): o /me só inclui a pelada em monthlyDelinquentPeladaIds para quem o backend trata como jogador na cobrança. */
  const showFinanceDelinquentBanner = useMemo(() => {
    if (numericPeladaId == null || !roles || !isMensalistaNaPeladaAtual) {
      return false;
    }
    const today = new Date();
    if (today.getDate() <= dueDayThisMonth) return false;
    const ids = monthlyDelinquentPeladaIds ?? [];
    return ids.some((x) => Number(x) === numericPeladaId);
  }, [
    numericPeladaId,
    roles,
    isMensalistaNaPeladaAtual,
    dueDayThisMonth,
    monthlyDelinquentPeladaIds,
  ]);

  /** Atualiza /me após o vencimento (sem depender da lista de inadimplência no array de deps — evita corrida com Strict Mode e mantém sessão alinhada ao financeiro). */
  useEffect(() => {
    if (numericPeladaId == null || !roles || !isMensalistaNaPeladaAtual) {
      return;
    }
    const today = new Date();
    if (today.getDate() <= dueDayThisMonth) return;
    const tid = window.setTimeout(() => {
      void refreshProfile();
    }, 400);
    return () => window.clearTimeout(tid);
  }, [numericPeladaId, roles, isMensalistaNaPeladaAtual, dueDayThisMonth, refreshProfile]);

  if (adminMustPickPelada) {
    return <Navigate to="/pelada" replace />;
  }

  return (
    <div className={styles.shell}>
      {logoUrl && (
        <>
          <div
            className={styles.bgBrand}
            style={{ backgroundImage: `url(${logoUrl})` }}
            aria-hidden
          />
          <div className={styles.bgBrandScrim} aria-hidden />
        </>
      )}
      <div className={styles.shellContent}>
        <header className={styles.header}>
          <Link to={brandTo} className={styles.brand}>
            {logoUrl && !headerLogoBroken ? (
              <img
                src={logoUrl}
                alt=""
                className={styles.brandLogoImg}
                width={36}
                height={36}
                onError={() => setHeaderLogoBroken(true)}
              />
            ) : (
              <span className={styles.logoMark} aria-hidden>
                ⚽
              </span>
            )}
            <span className={styles.brandText}>VARzea</span>
          </Link>
          {showNav && (
            <nav className={styles.nav}>
              <NavLink to="/painel" className={({ isActive }) => navClass(isActive)}>
                Dashboard
              </NavLink>
              <NavLink to="/matches" className={({ isActive }) => navClass(isActive)}>
                Partidas
              </NavLink>
              <NavLink to="/stats" className={({ isActive }) => navClass(isActive)}>
                Estatísticas
              </NavLink>
              <NavLink to="/ranking" className={({ isActive }) => navClass(isActive)}>
                Ranking
              </NavLink>
              {hasRole(roles, 'PLAYER') && !isAdminGeral(roles) && (
                <NavLink to="/minhas-peladas" className={({ isActive }) => navClass(isActive)}>
                  Minhas peladas
                </NavLink>
              )}
              {hasAnyRole(roles, MEDIA_ROLES) && (
                <NavLink to="/media" className={({ isActive }) => navClass(isActive)}>
                  Mídia
                </NavLink>
              )}
              {hasAnyRole(roles, FINANCE_MODULE_ROLES) && (
                <NavLink to="/financeiro" className={({ isActive }) => navClass(isActive)}>
                  Financeiro
                </NavLink>
              )}
              {isAnyAdmin(roles) && (
                <NavLink to="/admin/users" className={({ isActive }) => navClass(isActive)}>
                  Usuários
                </NavLink>
              )}
            </nav>
          )}
          <span className={styles.spacer} />
          <div className={styles.user}>
            <span className={styles.userName}>
              Olá, <strong>{name}</strong>
            </span>
            {roles && roles.length > 0 && (
              <span className={styles.userRoles}>
                {roles.map((r) => (
                  <span key={r} className={pageShared.roleTag} style={{ marginTop: 0 }}>
                    {roleDisplayLabel(r)}
                  </span>
                ))}
              </span>
            )}
            {!adminOnboardingCriarPelada && (
              <NavLink
                to="/perfil"
                className={({ isActive }) => (isActive ? `${styles.btnProfile} ${styles.btnProfileActive}` : styles.btnProfile)}
              >
                Perfil
              </NavLink>
            )}
            <button type="button" className={styles.btnLogout} onClick={logout}>
              Sair
            </button>
          </div>
        </header>
        {showPeladaBar && (
          <div className={styles.peladaBar}>
            <span className={styles.peladaLabelWrap}>
              Pelada: <strong>{resolvedPeladaLabel}</strong>
              {hasAnyRole(roles, PELADA_SETTINGS_ROLES) && (
                <Link
                  to="/pelada/config"
                  className={styles.peladaGearLink}
                  aria-label="Configurações da pelada"
                  aria-describedby={peladaGearTooltipId}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.peladaGearIcon}>
                    <path
                      d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42L9.2 5.32c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.51.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span id={peladaGearTooltipId} className={styles.peladaGearTooltip} role="tooltip">
                    Configuração da pelada
                  </span>
                </Link>
              )}
              {roles && roles.length > 0 && !isAdminGeral(roles) && (
                <span style={{ opacity: 0.75, marginLeft: '0.35rem' }}>(contexto atual)</span>
              )}
            </span>
            {canSwitchPeladaMember && membershipPeladas.length > 0 && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.75rem' }}>
                <span className={styles.peladaBarMeta}>Trocar</span>
                <select
                  className={styles.peladaSelect}
                  value={peladaId ?? ''}
                  onChange={(ev) => {
                    const id = Number(ev.target.value);
                    const p = membershipPeladas.find((x) => x.id === id);
                    if (p) {
                      switchPelada(p.id, p.name, Boolean(p.hasLogo), p.monthlyDueDay);
                    }
                  }}
                >
                  {membershipPeladas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canSwitchPeladaAdmin && (
              <Link to="/pelada" className={styles.peladaBarLink}>
                Trocar pelada
              </Link>
            )}
          </div>
        )}
        {showFinanceDelinquentBanner && (
          <div className={styles.financeAlert} role="status">
            Inadimplente na mensalidade desta pelada (após o dia {dueDayThisMonth} do mês). Regularize com o gestor ou
            pelo módulo financeiro.
          </div>
        )}
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
