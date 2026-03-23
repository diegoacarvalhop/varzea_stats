import { getPeladaId } from '@/lib/peladaContext';
import { peladaLogoAbsoluteUrl } from '@/lib/peladaLogoUrl';
import { isAdminGeral } from '@/lib/roles';
import { useAuth } from '@/hooks/useAuth';

/**
 * Pelada usada para fundo, favicon e ícone do header: conta com pelada fixa, ou pelada escolhida no contexto (admin geral / visitante).
 *
 * A URL da logomarca é sempre montada quando há `peladaId` (GET /peladas/{id}/logo é público).
 * Antes o fundo dependia de `hasLogo` no storage/JWT; valores antigos `null` viravam `false` e sumiam a marca.
 */
export function usePeladaBranding(): { peladaId: number | null; logoUrl: string | null } {
  const { roles, peladaId: authPeladaId } = useAuth();

  const ctxRaw = getPeladaId();
  const ctxId = ctxRaw ? Number(ctxRaw) : null;
  const ctxIdOk = ctxId != null && Number.isFinite(ctxId) ? ctxId : null;

  const isGeral = isAdminGeral(roles);

  const peladaId =
    authPeladaId != null && !isGeral ? authPeladaId : ctxIdOk != null ? ctxIdOk : null;

  const logoUrl = peladaId != null ? peladaLogoAbsoluteUrl(peladaId) : null;

  return { peladaId, logoUrl };
}
