import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PasswordField } from '@/components/PasswordField';
import { SearchableSelect } from '@/components/SearchableSelect';
import { appToast } from '@/lib/appToast';
import { getPeladaId } from '@/lib/peladaContext';
import { isAdminGeral, isAdminPelada } from '@/lib/roles';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/services/authService';
import { listPeladas, type Pelada } from '@/services/peladaService';
import { createUser, listUsers, patchUser, type UserSummary } from '@/services/userService';
import s from '@/styles/pageShared.module.scss';

type MatrixRow = {
  feature: string;
  adminGeral: boolean;
  adminPelada: boolean;
  scout: boolean;
  media: boolean;
  player: boolean;
  financeiro: boolean;
};

const PERMISSION_MATRIX: MatrixRow[] = [
  {
    feature: 'Criar nova pelada (grupo)',
    adminGeral: true,
    adminPelada: false,
    scout: false,
    media: false,
    player: false,
    financeiro: false,
  },
  {
    feature:
      'Cadastrar e editar usuários (cadastro público cria só jogador; depois o jogador escolhe peladas em Minhas peladas)',
    adminGeral: true,
    adminPelada: true,
    scout: false,
    media: false,
    player: false,
    financeiro: false,
  },
  {
    feature: 'Criar partida e encerrar partida',
    adminGeral: true,
    adminPelada: true,
    scout: true,
    media: true,
    player: false,
    financeiro: false,
  },
  {
    feature: 'Criar equipes e jogadores na partida',
    adminGeral: true,
    adminPelada: true,
    scout: true,
    media: false,
    player: false,
    financeiro: false,
  },
  {
    feature: 'Registrar lances (gols, cartões, assistências…)',
    adminGeral: true,
    adminPelada: true,
    scout: true,
    media: true,
    player: false,
    financeiro: false,
  },
  {
    feature: 'Anexar mídia (URL) à partida',
    adminGeral: true,
    adminPelada: true,
    scout: false,
    media: true,
    player: false,
    financeiro: false,
  },
  {
    feature: 'Consultar partidas, estatísticas e ranking (leitura)',
    adminGeral: true,
    adminPelada: true,
    scout: true,
    media: true,
    player: true,
    financeiro: false,
  },
  {
    feature: 'Votar bola cheia / bola murcha (API pública; qualquer visitante)',
    adminGeral: true,
    adminPelada: true,
    scout: true,
    media: true,
    player: true,
    financeiro: false,
  },
  {
    feature: 'Registrar pagamentos e ver inadimplência na pelada',
    adminGeral: true,
    adminPelada: true,
    scout: false,
    media: false,
    player: false,
    financeiro: true,
  },
];

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  {
    value: 'ADMIN_GERAL',
    label: 'Administrador geral',
    hint: 'Todas as peladas, cria grupos e qualquer tipo de usuário. Só outro administrador geral pode marcar este perfil ao cadastrar. Não pode ser combinado com outros perfis.',
  },
  {
    value: 'ADMIN',
    label: 'Administrador da pelada',
    hint: 'Gestão completa dentro da pelada vinculada; cadastra usuários só nessa pelada.',
  },
  {
    value: 'SCOUT',
    label: 'Scout / mesário',
    hint: 'Organiza partida: equipes, jogadores, lances e encerramento.',
  },
  {
    value: 'MEDIA',
    label: 'Mídia',
    hint: 'Registra lances e anexa links de foto/vídeo; cria e encerra partidas.',
  },
  {
    value: 'FINANCEIRO',
    label: 'Financeiro',
    hint: 'Registra pagamentos e consulta inadimplência na pelada em que participa.',
  },
  {
    value: 'PLAYER',
    label: 'Jogador',
    hint: 'Acompanha dados no app (leitura); sem edição de partida ou mídia.',
  },
];

function cell(ok: boolean) {
  return <span className={ok ? s.matrixYes : s.matrixNo}>{ok ? '●' : '—'}</span>;
}

function toggleRoleInSet(prev: Set<Role>, role: Role, checked: boolean): Set<Role> {
  const next = new Set(prev);
  if (role === 'ADMIN_GERAL') {
    if (checked) {
      return new Set<Role>(['ADMIN_GERAL']);
    }
    next.delete('ADMIN_GERAL');
    if (next.size === 0) next.add('PLAYER');
    return next;
  }
  if (checked) {
    next.delete('ADMIN_GERAL');
    next.add(role);
    return next;
  }
  next.delete(role);
  if (next.size === 0) next.add('PLAYER');
  return next;
}

export function UsersAdminPage() {
  const { roles: viewerRoles, peladaId: viewerPeladaId, peladaName: viewerPeladaName } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [peladasLoadFailed, setPeladasLoadFailed] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(() => new Set(['PLAYER']));
  const [newUserPeladaId, setNewUserPeladaId] = useState<number | ''>(() => {
    const raw = getPeladaId();
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : '';
  });
  const [submitting, setSubmitting] = useState(false);

  const [editUser, setEditUser] = useState<UserSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoles, setEditRoles] = useState<Set<Role>>(new Set());
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editPeladaIds, setEditPeladaIds] = useState<Set<number>>(new Set());
  const [editSaving, setEditSaving] = useState(false);

  const roleOptionsForForm = useMemo(
    () =>
      isAdminGeral(viewerRoles) ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.value !== 'ADMIN_GERAL'),
    [viewerRoles],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      appToast.error('Não foi possível carregar a lista de usuários.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPeladasLoadFailed(false);
    void listPeladas()
      .then((list) => {
        setPeladas(list);
      })
      .catch(() => {
        setPeladasLoadFailed(true);
        appToast.error('Não foi possível carregar a lista de peladas para o vínculo do usuário.');
      });
  }, []);

  useEffect(() => {
    if (isAdminPelada(viewerRoles) && viewerPeladaId != null) {
      setNewUserPeladaId(viewerPeladaId);
    }
  }, [viewerRoles, viewerPeladaId]);

  useEffect(() => {
    if (!isAdminGeral(viewerRoles)) {
      setSelectedRoles((prev) => {
        if (!prev.has('ADMIN_GERAL')) return prev;
        const n = new Set(prev);
        n.delete('ADMIN_GERAL');
        if (n.size === 0) n.add('PLAYER');
        return n;
      });
    }
  }, [viewerRoles]);

  const rolesListSorted = useMemo(
    () => Array.from(selectedRoles).sort((a, b) => a.localeCompare(b)),
    [selectedRoles],
  );

  const peladaSelectOptions = useMemo(
    () => peladas.map((p) => ({ value: String(p.id), label: p.name })),
    [peladas],
  );

  const onlyAdminGeral = selectedRoles.size === 1 && selectedRoles.has('ADMIN_GERAL');
  const editOnlyAdminGeral = editRoles.size === 1 && editRoles.has('ADMIN_GERAL');

  function openEdit(u: UserSummary) {
    setEditUser(u);
    setEditName(u.name);
    setEditRoles(new Set(u.roles ?? ['PLAYER']));
    setEditActive(u.accountActive !== false);
    setEditPassword('');
    const pids = u.peladaIds?.length ? u.peladaIds : u.peladaId != null ? [u.peladaId] : [];
    setEditPeladaIds(new Set(pids.filter((x): x is number => x != null)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedRoles.size === 0) {
      appToast.warning('Marque pelo menos um perfil.');
      return;
    }
    if (!onlyAdminGeral && (newUserPeladaId === '' || newUserPeladaId == null)) {
      appToast.warning('Selecione a pelada (obrigatória exceto para administrador geral sozinho).');
      return;
    }
    if (!newPassword.trim()) {
      appToast.warning('Informe a senha inicial.');
      return;
    }
    setSubmitting(true);
    try {
      await createUser({
        name: name.trim(),
        email: email.trim(),
        roles: rolesListSorted,
        password: newPassword.trim(),
        peladaId: onlyAdminGeral ? null : Number(newUserPeladaId),
      });
      appToast.success('Usuário criado.');
      setName('');
      setEmail('');
      setNewPassword('');
      setSelectedRoles(new Set(['PLAYER']));
      if (isAdminPelada(viewerRoles) && viewerPeladaId != null) {
        setNewUserPeladaId(viewerPeladaId);
      } else {
        const ctx = getPeladaId();
        const n = ctx ? Number(ctx) : NaN;
        setNewUserPeladaId(Number.isFinite(n) ? n : '');
      }
      await loadUsers();
    } catch (err: unknown) {
      appToast.apiError(err, 'Falha ao cadastrar. Verifique os dados ou se o e-mail já existe.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    if (editRoles.size === 0) {
      appToast.warning('Marque pelo menos um perfil.');
      return;
    }
    if (
      isAdminGeral(viewerRoles) &&
      !editOnlyAdminGeral &&
      (editPeladaIds.size === 0 || ![...editPeladaIds].every((id) => peladas.some((p) => p.id === id)))
    ) {
      appToast.warning('Marque pelo menos uma pelada válida (exceto para conta só administrador geral).');
      return;
    }
    setEditSaving(true);
    try {
      const rolesSorted = Array.from(editRoles).sort((a, b) => a.localeCompare(b));
      const payload: Parameters<typeof patchUser>[1] = {
        name: editName.trim(),
        roles: rolesSorted,
        accountActive: editActive,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      if (isAdminGeral(viewerRoles) && !editOnlyAdminGeral) {
        payload.peladaIds = [...editPeladaIds].sort((a, b) => a - b);
      }
      await patchUser(editUser.id, payload);
      appToast.success('Usuário atualizado.');
      setEditUser(null);
      await loadUsers();
    } catch (err: unknown) {
      appToast.apiError(err, 'Falha ao salvar alterações.');
    } finally {
      setEditSaving(false);
    }
  }

  function peladaLabelsForUser(u: UserSummary): string {
    if (u.roles?.length === 1 && u.roles[0] === 'ADMIN_GERAL') {
      return '—';
    }
    const ids = u.peladaIds?.length ? u.peladaIds : u.peladaId != null ? [u.peladaId] : [];
    if (ids.length === 0) {
      return '—';
    }
    return ids
      .map((id) => peladas.find((p) => p.id === id)?.name ?? `#${id}`)
      .join(', ');
  }

  return (
    <div className={s.page}>
      <h1>Usuários</h1>
      <p className={s.lead}>
        Cadastro de contas com <strong>um ou mais perfis</strong> por pessoa. <strong>Administrador geral</strong> e{' '}
        <strong>administrador da pelada</strong> acessam esta tela; o segundo só vê e cria usuários ligados à própria
        pelada. O perfil <strong>administrador geral</strong> não pode ser combinado com outros na mesma conta. Contas{' '}
        <strong>inativas</strong> continuam podendo entrar no sistema, mas ficam de fora das peladas até serem reativadas.
      </p>

      <section className={s.card} aria-labelledby="perm-matrix-title">
        <h2 className={s.cardTitle} id="perm-matrix-title">
          O que cada papel pode fazer
        </h2>
        <div className={s.permissionMatrixWrap}>
          <table className={s.permissionMatrix}>
            <thead>
              <tr>
                <th scope="col">Funcionalidade</th>
                <th scope="col">Admin geral</th>
                <th scope="col">Admin pelada</th>
                <th scope="col">Scout</th>
                <th scope="col">Mídia</th>
                <th scope="col">Financeiro</th>
                <th scope="col">Jogador</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{cell(row.adminGeral)}</td>
                  <td>{cell(row.adminPelada)}</td>
                  <td>{cell(row.scout)}</td>
                  <td>{cell(row.media)}</td>
                  <td>{cell(row.financeiro)}</td>
                  <td>{cell(row.player)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={s.card} style={{ marginTop: '1.25rem' }} aria-labelledby="new-user-title">
        <h2 className={s.cardTitle} id="new-user-title">
          Novo usuário
        </h2>
        <form className={s.form} onSubmit={(e) => void onSubmit(e)} style={{ maxWidth: '32rem' }}>
          <div className={s.field}>
            <label className={s.fieldLabel} htmlFor="u-name">
              Nome
              <span className={s.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="u-name"
              className={s.input}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel} htmlFor="u-email">
              E-mail (login)
              <span className={s.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="u-email"
              className={s.input}
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <PasswordField
            id="u-pass"
            label="Senha inicial"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required
            minLength={6}
            showStrengthMeter
          />
          <fieldset className={s.field} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className={s.fieldLabel}>
              Perfis (marque todos que esta pessoa exercerá)
              <span className={s.requiredMark} aria-hidden title="Pelo menos um perfil">
                *
              </span>
            </legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
              {roleOptionsForForm.map((o) => (
                <label key={o.value} className={s.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(o.value)}
                    onChange={(ev) => {
                      setSelectedRoles((prev) => toggleRoleInSet(prev, o.value, ev.target.checked));
                    }}
                  />
                  <span>
                    <strong>{o.label}</strong> — {o.hint}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {!onlyAdminGeral && (
            <div className={s.field}>
              {isAdminPelada(viewerRoles) && viewerPeladaId != null ? (
                <>
                  <span className={s.fieldLabel}>
                    Pelada
                    <span className={s.requiredMark} aria-hidden>
                      *
                    </span>
                  </span>
                  <p className={s.lead} style={{ marginTop: 0, marginBottom: '0.35rem' }}>
                    <strong>{viewerPeladaName?.trim() || `Pelada #${viewerPeladaId}`}</strong> — todos os cadastros desta
                    tela ficam nesta pelada.
                  </p>
                </>
              ) : (
                <SearchableSelect
                  id="u-pelada"
                  label={
                    <>
                      Pelada
                      <span className={s.requiredMark} aria-hidden>
                        *
                      </span>
                    </>
                  }
                  value={newUserPeladaId === '' ? '' : String(newUserPeladaId)}
                  onChange={(v) => setNewUserPeladaId(v === '' ? '' : Number(v))}
                  options={peladaSelectOptions}
                  emptyOption={{ value: '', label: 'Selecione…' }}
                  disabled={peladasLoadFailed || peladas.length === 0}
                  required
                />
              )}
              {!isAdminPelada(viewerRoles) && (
                <span className={s.statsDetailMeta}>
                  Contas com pelada só enxergam dados dela. O padrão é a pelada que o admin geral está administrando
                  agora.
                </span>
              )}
            </div>
          )}
          <button className={s.btnPrimary} type="submit" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Cadastrar usuário'}
          </button>
        </form>
      </section>

      {editUser && (
        <section className={s.card} style={{ marginTop: '1.25rem' }} aria-labelledby="edit-user-title">
          <h2 className={s.cardTitle} id="edit-user-title">
            Editar — {editUser.email}
          </h2>
          <form className={s.form} onSubmit={(e) => void onSaveEdit(e)} style={{ maxWidth: '32rem' }}>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="eu-name">
                Nome
              </label>
              <input
                id="eu-name"
                className={s.input}
                value={editName}
                onChange={(ev) => setEditName(ev.target.value)}
                required
              />
            </div>
            <label className={s.checkboxRow}>
              <input type="checkbox" checked={editActive} onChange={(ev) => setEditActive(ev.target.checked)} />
              <span>Conta ativa nas peladas</span>
            </label>
            <PasswordField
              id="eu-pass"
              label="Nova senha (opcional)"
              value={editPassword}
              onChange={setEditPassword}
              autoComplete="new-password"
              minLength={6}
            />
            <fieldset className={s.field} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className={s.fieldLabel}>Perfis</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
                {roleOptionsForForm.map((o) => (
                  <label key={o.value} className={s.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={editRoles.has(o.value)}
                      onChange={(ev) => {
                        setEditRoles((prev) => toggleRoleInSet(prev, o.value, ev.target.checked));
                      }}
                    />
                    <span>
                      <strong>{o.label}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {isAdminGeral(viewerRoles) && !editOnlyAdminGeral && (
              <fieldset className={s.field} style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className={s.fieldLabel}>Peladas (membros)</legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {peladas.map((p) => (
                    <label key={p.id} className={s.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={editPeladaIds.has(p.id)}
                        onChange={(ev) => {
                          setEditPeladaIds((prev) => {
                            const n = new Set(prev);
                            if (ev.target.checked) n.add(p.id);
                            else n.delete(p.id);
                            return n;
                          });
                        }}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button className={s.btnPrimary} type="submit" disabled={editSaving}>
                {editSaving ? 'Salvando…' : 'Salvar alterações'}
              </button>
              <button type="button" className={s.btn} onClick={() => setEditUser(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className={s.card} style={{ marginTop: '1.25rem' }} aria-labelledby="user-list-title">
        <h2 className={s.cardTitle} id="user-list-title">
          Usuários cadastrados
        </h2>
        {loading ? (
          <p className={s.lead}>Carregando…</p>
        ) : users.length === 0 ? (
          <p className={s.lead}>Nenhum usuário retornado.</p>
        ) : (
          <div className={s.trajectoryTableWrap}>
            <table className={s.userListTable}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfis</th>
                  <th>Peladas</th>
                  <th>Ativo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {(u.roles ?? []).map((r) => (
                          <span key={r} className={s.rolePill}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{peladaLabelsForUser(u)}</td>
                    <td>{u.accountActive === false ? 'Não' : 'Sim'}</td>
                    <td>
                      <button type="button" className={s.btn} onClick={() => openEdit(u)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
