import { useState, useEffect } from 'react';
import { teamsApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  Button,
  Chip,
  Field,
  InlineError,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  invited_at: string;
  expires_at: string;
}

const roleTone = (role: string): 'accent' | 'warning' | 'neutral' => {
  if (role === 'owner') return 'accent';
  if (role === 'admin') return 'warning';
  return 'neutral';
};

export default function Team() {
  const { user, activeOrg } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const myRole = activeOrg?.role || 'viewer';
  const canInvite = ['admin', 'owner'].includes(myRole);
  const canManage = ['admin', 'owner'].includes(myRole);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      const data = await teamsApi.listMembers();
      setMembers(data.members);
      setInvites(data.pending_invites);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setError('');
    try {
      await teamsApi.invite(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('member');
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    try {
      await teamsApi.revokeInvite(id);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    try {
      await teamsApi.changeRole(memberId, newRole);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the organization?')) return;
    try {
      await teamsApi.removeMember(memberId);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-8 h-6 w-32" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Panel key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-3 w-16" />
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description={
          activeOrg
            ? `${activeOrg.name} on the ${activeOrg.plan} plan. Roles decide who can invite, manage billing, and read the audit log.`
            : undefined
        }
      />

      {error && (
        <div className="mb-6 max-w-3xl">
          <InlineError>{error}</InlineError>
        </div>
      )}

      {/* Invite form */}
      {canInvite && (
        <Panel className="mb-6 p-5">
          <PanelHeader title="Invite member" />
          <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Email" htmlFor="invite-email" className="flex-1">
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </Field>
            <Field label="Role" htmlFor="invite-role" className="sm:w-40">
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                {myRole === 'owner' && <option value="admin">Admin</option>}
              </Select>
            </Field>
            <Button type="submit" variant="primary" loading={inviting} className="sm:mb-0">
              Invite
            </Button>
          </form>
        </Panel>
      )}

      {/* Members table */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Members <span className="font-mono text-text-tertiary">{members.length}</span>
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th align="right">Joined</Th>
              {canManage && (
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const initials = (m.name || m.email).slice(0, 2).toUpperCase();
              const isMe = m.user_id === user?.id;
              return (
                <Tr key={m.id}>
                  <Td label="User">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-elevated text-[10px] font-medium text-text-secondary">
                        {initials}
                      </div>
                      <div className="min-w-0 max-w-[22ch]">
                        <div className="truncate text-sm text-foreground" title={m.email}>
                          {m.email}
                        </div>
                        {m.name && (
                          <div className="truncate text-xs text-text-tertiary">{m.name}</div>
                        )}
                      </div>
                      {isMe && <Chip tone="accent">you</Chip>}
                    </div>
                  </Td>
                  <Td label="Role">
                    {canManage && !isMe ? (
                      <Select
                        aria-label={`Role for ${m.email}`}
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.id, e.target.value)}
                        className="h-9 w-28 py-0 text-xs lg:w-32"
                      >
                        <option value="viewer">viewer</option>
                        <option value="member">member</option>
                        {myRole === 'owner' && <option value="admin">admin</option>}
                      </Select>
                    ) : (
                      <Chip tone={roleTone(m.role)}>{m.role}</Chip>
                    )}
                  </Td>
                  <Td align="right" label="Joined">
                    <span className="whitespace-nowrap text-xs text-text-tertiary">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'Not recorded'}
                    </span>
                  </Td>
                  {canManage && (
                    <Td align="right">
                      {!isMe && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(m.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      )}
                    </Td>
                  )}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Pending invites <span className="font-mono text-text-tertiary">{invites.length}</span>
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th align="right">Expires</Th>
                {canInvite && (
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <Tr key={inv.id}>
                  <Td label="Email">
                    <span className="text-sm text-foreground">{inv.email}</span>
                  </Td>
                  <Td label="Role">
                    <Chip tone={roleTone(inv.role)}>{inv.role}</Chip>
                  </Td>
                  <Td align="right" label="Expires">
                    <span className="whitespace-nowrap text-xs text-text-tertiary">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </Td>
                  {canInvite && (
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Revoke
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  );
}
