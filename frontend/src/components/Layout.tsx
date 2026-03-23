import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePeladaBranding } from '@/hooks/usePeladaBranding';
import { getPeladaId, getPeladaName } from '@/lib/peladaContext';
import { hasAnyRole, isAdminGeral, isAnyAdmin, MEDIA_ROLES } from '@/lib/roles';
import pageShared from '@/styles/pageShared.module.scss';
import styles from './Layout.module.scss';

function navClass(isActive: boolean) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

const DEFAULT_FAVICON = '/favicon.svg';
const APP_TITLE = 'VARzea Stats';

export function Layout() {
  const location = useLocation();
  const { isAuthenticated, name, roles, peladaId, peladaName, logout } = useAuth();
  const { logoUrl } = usePeladaBranding();
  const [headerLogoBroken, setHeaderLogoBroken] = useState(false);

  useEffect(() => {
    setHeaderLogoBroken(false);
  }, [logoUrl]);

  const resolvedPeladaLabel =
    roles && roles.length > 0 && !isAdminGeral(roles)
      ? (peladaName?.trim() || (peladaId != null ? `Pelada #${peladaId}` : 'Sua pelada'))
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

  const guestNoPelada = !isAuthenticated && !getPeladaId();
  const guestOnNonPublicRoute = !isAuthenticated && location.pathname !== '/pelada';
  const adminNoPelada = isAuthenticated && isAdminGeral(roles) && !getPeladaId();
  /** Admin geral pode gerir usuários globais sem escolher pelada no contexto local. */
  const adminGeralOnUsersRoute =
    isAuthenticated && isAdminGeral(roles) && location.pathname.startsWith('/admin/users');
  const mustPickPelada =
    (guestNoPelada || guestOnNonPublicRoute || adminNoPelada) &&
    location.pathname !== '/pelada' &&
    !adminGeralOnUsersRoute;
  if (mustPickPelada) {
    return <Navigate to="/pelada" replace />;
  }

  const showPeladaBar = Boolean(resolvedPeladaLabel) && isAuthenticated;
  const canSwitchPelada = isAdminGeral(roles) || !isAuthenticated;
  const showNav = isAuthenticated;

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
          <Link to="/" className={styles.brand}>
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
              <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
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
              {hasAnyRole(roles, MEDIA_ROLES) && (
                <NavLink to="/media" className={({ isActive }) => navClass(isActive)}>
                  Mídia
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
            {isAuthenticated ? (
              <>
                <span className={styles.userName}>
                  Olá, <strong>{name}</strong>
                </span>
                {roles && roles.length > 0 && (
                  <span className={styles.userRoles}>
                    {roles.map((r) => (
                      <span key={r} className={pageShared.roleTag} style={{ marginTop: 0 }}>
                        {r}
                      </span>
                    ))}
                  </span>
                )}
                <button type="button" className={styles.btnLogout} onClick={logout}>
                  Sair
                </button>
              </>
            ) : (
              <span className={styles.guestHint}>Selecione uma pelada para continuar</span>
            )}
          </div>
        </header>
        {showPeladaBar && (
          <div className={styles.peladaBar}>
            <span>
              Pelada: <strong>{resolvedPeladaLabel}</strong>
              {roles && roles.length > 0 && !isAdminGeral(roles) && (
                <span style={{ opacity: 0.75, marginLeft: '0.35rem' }}>(definida pelo admin)</span>
              )}
            </span>
            {canSwitchPelada && (
              <Link to="/pelada" className={styles.peladaBarLink}>
                {isAdminGeral(roles) ? 'Trocar pelada' : 'Trocar'}
              </Link>
            )}
          </div>
        )}
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
