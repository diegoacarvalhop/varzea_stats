import { FormEvent, useMemo, useState } from 'react';
import { PasswordField } from '@/components/PasswordField';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { roleDisplayLabel } from '@/lib/roles';
import s from '@/styles/pageShared.module.scss';

const PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  ADMIN_GERAL: [
    'Criar e configurar peladas',
    'Cadastrar e editar usuários de qualquer pelada',
    'Acessar todos os módulos do sistema',
  ],
  ADMIN: [
    'Gerenciar usuários da sua pelada',
    'Gerenciar partidas, estatísticas e ranking da sua pelada',
    'Acessar módulo financeiro da sua pelada',
  ],
  SCOUT: [
    'Criar equipes e lançar eventos da partida',
    'Criar e encerrar partidas',
    'Consultar estatísticas e ranking',
  ],
  MEDIA: [
    'Registrar lances da partida',
    'Anexar mídia em partidas',
    'Consultar estatísticas e ranking',
  ],
  FINANCEIRO: ['Registrar pagamentos', 'Consultar inadimplência e enviar cobranças por e-mail'],
  PLAYER: ['Consultar partidas, estatísticas e ranking', 'Gerenciar vínculo em Minhas peladas'],
};

export function ProfilePage() {
  const { name, email, roles, peladaId, peladaName, membershipPeladaIds, billingMonthlyByPelada, updateMemberships, changePassword } =
    useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingBillingMode, setSavingBillingMode] = useState(false);

  const isPlayerContext = useMemo(() => (roles ?? []).includes('PLAYER') && peladaId != null, [roles, peladaId]);
  const billingMonthlyCurrent = useMemo(() => {
    if (peladaId == null) return true;
    return billingMonthlyByPelada[String(peladaId)] !== false;
  }, [peladaId, billingMonthlyByPelada]);

  const capabilities = useMemo(() => {
    const roleList = roles ?? [];
    const set = new Set<string>();
    for (const role of roleList) {
      for (const capability of PERMISSIONS_BY_ROLE[role] ?? []) {
        set.add(capability);
      }
    }
    return Array.from(set);
  }, [roles]);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 6) {
      appToast.warning('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      appToast.warning('A confirmação não coincide com a nova senha.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(senhaAtual, novaSenha);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      appToast.success('Senha alterada com sucesso.');
    } catch {
      appToast.error('Não foi possível alterar a senha. Verifique a senha atual.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function onToggleBillingMode(nextMonthly: boolean) {
    if (peladaId == null) return;
    const peladaIds = membershipPeladaIds.length > 0 ? membershipPeladaIds : [peladaId];
    const billingMonthlyMap: Record<string, boolean> = {};
    for (const id of peladaIds) {
      const current = billingMonthlyByPelada[String(id)];
      billingMonthlyMap[String(id)] = id === peladaId ? nextMonthly : current !== false;
    }
    setSavingBillingMode(true);
    try {
      await updateMemberships({ peladaIds, billingMonthlyByPelada: billingMonthlyMap });
      appToast.success(nextMonthly ? 'Perfil atualizado para mensalista.' : 'Perfil atualizado para diarista.');
    } catch {
      appToast.error('Não foi possível atualizar seu tipo de cobrança.');
    } finally {
      setSavingBillingMode(false);
    }
  }

  return (
    <div className={s.page}>
      <h1>Perfil</h1>
      <p className={s.lead}>Confira seus dados de acesso, seus papéis e o que você pode fazer na aplicação.</p>

      <section className={s.card} aria-labelledby="profile-data-title">
        <h2 className={s.cardTitle} id="profile-data-title">
          Dados da conta
        </h2>
        <div className={s.form} style={{ gap: '0.75rem' }}>
          <p>
            <strong>Nome:</strong> {name ?? '—'}
          </p>
          <p>
            <strong>E-mail:</strong> {email ?? '—'}
          </p>
          <div>
            <strong>Perfis:</strong>{' '}
            {(roles ?? []).map((role) => (
              <span key={role} className={s.rolePill} style={{ marginLeft: '0.35rem' }}>
                {roleDisplayLabel(role)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={s.card} style={{ marginTop: '1.25rem' }} aria-labelledby="profile-perms-title">
        <h2 className={s.cardTitle} id="profile-perms-title">
          O que seu perfil permite
        </h2>
        {capabilities.length === 0 ? (
          <p className={s.lead}>Nenhuma permissão mapeada para o seu perfil.</p>
        ) : (
          <ul className={s.statList}>
            {capabilities.map((capability) => (
              <li key={capability} className={s.statRow}>
                <span className={s.statKey}>{capability}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isPlayerContext && (
        <section className={s.card} style={{ marginTop: '1.25rem' }} aria-labelledby="profile-billing-title">
          <h2 className={s.cardTitle} id="profile-billing-title">
            Tipo de cobrança na pelada atual
          </h2>
          <p className={s.lead} style={{ marginTop: 0 }}>
            Pelada: <strong>{peladaName ?? `#${peladaId}`}</strong>
          </p>
          <p className={s.statsDetailMeta} style={{ marginTop: '-0.25rem', marginBottom: '0.35rem' }}>
            Os valores cobrados seguem o que está cadastrado em Configuração da pelada.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label className={s.checkboxRow}>
              <input
                type="checkbox"
                checked={billingMonthlyCurrent}
                disabled={savingBillingMode}
                onChange={(ev) => {
                  if (ev.target.checked) void onToggleBillingMode(true);
                }}
              />
              <span>Mensalista — pagamento mensal</span>
            </label>
            <label className={s.checkboxRow}>
              <input
                type="checkbox"
                checked={!billingMonthlyCurrent}
                disabled={savingBillingMode}
                onChange={(ev) => {
                  if (ev.target.checked) void onToggleBillingMode(false);
                }}
              />
              <span>Diarista — pagamento por dia de jogo</span>
            </label>
          </div>
        </section>
      )}

      <section className={s.card} style={{ marginTop: '1.25rem' }} aria-labelledby="profile-pass-title">
        <h2 className={s.cardTitle} id="profile-pass-title">
          Alterar senha
        </h2>
        <form className={s.form} onSubmit={(e) => void onChangePassword(e)} style={{ maxWidth: '32rem' }}>
          <PasswordField
            id="profile-current-password"
            label="Senha atual"
            value={senhaAtual}
            onChange={setSenhaAtual}
            autoComplete="current-password"
            required
          />
          <PasswordField
            id="profile-new-password"
            label="Nova senha"
            value={novaSenha}
            onChange={setNovaSenha}
            autoComplete="new-password"
            required
            minLength={6}
            showStrengthMeter
          />
          <PasswordField
            id="profile-new-password-confirm"
            label="Confirmar nova senha"
            value={confirmarNovaSenha}
            onChange={setConfirmarNovaSenha}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <button className={s.btnPrimary} type="submit" disabled={savingPassword}>
            {savingPassword ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </section>
    </div>
  );
}
