import { useCallback, useEffect, useState } from 'react';
import { groupsApi, ApiError } from '../lib/api';

interface Group {
  id: string;
  name: string;
  member_count: number;
  link_count: number;
  created_at: string;
}

interface Credential {
  id: string;
  student_id: string;
  name: string | null;
  created_at: string;
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<Group | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Import form
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  const [oneStudent, setOneStudent] = useState('');
  const [oneNational, setOneNational] = useState('');
  const [oneName, setOneName] = useState('');

  const loadGroups = useCallback(async () => {
    try {
      const data = await groupsApi.list();
      setGroups(data.groups);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const openGroup = async (group: Group) => {
    setSelected(group);
    setLoadingMembers(true);
    setImportResult('');
    try {
      const data = await groupsApi.credentials(group.id);
      setCredentials(data.credentials);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load credentials');
    } finally {
      setLoadingMembers(false);
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await groupsApi.create(newName.trim());
      setNewName('');
      await loadGroups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create group');
    } finally {
      setCreating(false);
    }
  };

  const removeGroup = async (group: Group) => {
    if (!confirm(`Delete "${group.name}"? Its member list is removed and any links restricted to it become public.`)) return;
    try {
      await groupsApi.remove(group.id);
      if (selected?.id === group.id) {
        setSelected(null);
        setCredentials([]);
      }
      await loadGroups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete group');
    }
  };

  const importBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !bulkText.trim()) return;
    setImporting(true);
    setError('');
    setImportResult('');
    try {
      const result = await groupsApi.bulkImport(selected.id, bulkText);
      setImportResult(
        `${result.added} added${result.skipped.length ? `, ${result.skipped.length} skipped` : ''}`,
      );
      setBulkText('');
      const data = await groupsApi.credentials(selected.id);
      setCredentials(data.credentials);
      await loadGroups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !oneStudent.trim() || !oneNational.trim()) return;
    setError('');
    try {
      await groupsApi.addCredential(selected.id, {
        student_id: oneStudent.trim(),
        national_id: oneNational.trim(),
        name: oneName.trim() || undefined,
      });
      setOneStudent('');
      setOneNational('');
      setOneName('');
      const data = await groupsApi.credentials(selected.id);
      setCredentials(data.credentials);
      await loadGroups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add student');
    }
  };

  const removeCredential = async (credential: Credential) => {
    if (!selected) return;
    try {
      await groupsApi.removeCredential(selected.id, credential.id);
      setCredentials((prev) => prev.filter((c) => c.id !== credential.id));
      await loadGroups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove student');
    }
  };

  const inputClass =
    'w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary';
  const labelClass = 'block text-[13px] text-text-secondary mb-2 font-sans font-medium';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-sans font-semibold text-foreground">Viewer groups</h1>
        <p className="text-sm text-text-secondary font-sans mt-1">
          A group is the list of people allowed to open a restricted link. Members sign in with
          their student ID and national ID, and that identity is burned into the watermark.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-5 max-w-2xl">
          <p className="text-sm text-destructive font-sans">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups column */}
        <div className="lg:col-span-1">
          <form onSubmit={createGroup} className="bg-surface border border-border rounded-lg p-5">
            <label className={labelClass}>New group</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Distributed Systems — Fall 2026"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="mt-3 w-full bg-accent text-background font-sans font-medium text-sm py-2.5 rounded-md hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating…' : 'Create group'}
            </button>
          </form>

          <div className="mt-5 space-y-2">
            {loading && <p className="text-sm text-text-tertiary font-sans">Loading…</p>}
            {!loading && groups.length === 0 && (
              <p className="text-sm text-text-tertiary font-sans">No groups yet.</p>
            )}
            {groups.map((group) => (
              <div
                key={group.id}
                className={`bg-surface border rounded-lg p-4 cursor-pointer transition-colors ${
                  selected?.id === group.id ? 'border-accent' : 'border-border hover:border-text-tertiary'
                }`}
                onClick={() => void openGroup(group)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-sans font-medium text-foreground">{group.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeGroup(group);
                    }}
                    className="text-xs text-text-tertiary hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-xs text-text-tertiary font-sans mt-1">
                  {group.member_count} member{group.member_count === 1 ? '' : 's'} · {group.link_count} link
                  {group.link_count === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Members column */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-sm text-text-tertiary font-sans">
                Select a group to manage its members.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-surface border border-border rounded-lg p-5">
                <p className="text-sm font-sans font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-text-tertiary font-sans mt-1">
                  Paste a class list, one student per line:
                  <code className="ml-1 font-mono">studentId,nationalId[,name]</code>
                </p>
                <form onSubmit={importBulk} className="mt-3">
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={5}
                    placeholder={'40123456,0012345678,Ali Rezaei\n40123457,0012345679,Sara Ahmadi'}
                    className={`${inputClass} font-mono text-xs`}
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="submit"
                      disabled={importing || !bulkText.trim()}
                      className="bg-accent text-background font-sans font-medium text-sm px-4 py-2 rounded-md hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {importing ? 'Importing…' : 'Import list'}
                    </button>
                    {importResult && (
                      <span className="text-xs text-text-secondary font-sans">{importResult}</span>
                    )}
                  </div>
                </form>
              </div>

              <div className="bg-surface border border-border rounded-lg p-5">
                <p className="text-sm font-sans font-medium text-foreground">Add one student</p>
                <form onSubmit={addOne} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <input
                    value={oneStudent}
                    onChange={(e) => setOneStudent(e.target.value)}
                    placeholder="Student ID"
                    className={inputClass}
                  />
                  <input
                    value={oneNational}
                    onChange={(e) => setOneNational(e.target.value)}
                    placeholder="National ID"
                    className={inputClass}
                  />
                  <input
                    value={oneName}
                    onChange={(e) => setOneName(e.target.value)}
                    placeholder="Name (optional)"
                    className={inputClass}
                  />
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={!oneStudent.trim() || !oneNational.trim()}
                      className="text-sm font-sans font-medium px-4 py-2 rounded-md border border-border hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add student
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Student ID</th>
                      <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Name</th>
                      <th className="text-right text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Added</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingMembers && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-text-tertiary font-sans">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loadingMembers && credentials.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-text-tertiary font-sans">
                          No members yet.
                        </td>
                      </tr>
                    )}
                    {credentials.map((c) => (
                      <tr key={c.id} className="border-b border-border-subtle last:border-0">
                        <td className="px-4 py-3 text-sm font-mono text-foreground">{c.student_id}</td>
                        <td className="px-4 py-3 text-sm font-sans text-text-secondary">{c.name || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-sans text-text-tertiary">
                          {c.created_at}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void removeCredential(c)}
                            className="text-xs text-text-tertiary hover:text-destructive transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-text-tertiary font-sans">
                National IDs are stored only as bcrypt hashes and are never returned by the API.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
