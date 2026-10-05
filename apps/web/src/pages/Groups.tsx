import { useCallback, useEffect, useState } from 'react';
import { groupsApi, ApiError } from '../lib/api';
import {
  Button,
  EmptyState,
  InlineError,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  Skeleton,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  cx,
} from '../components/ui';
import { GroupsIcon, TrashIcon } from '../components/icons';
import { glyph, useActionStatus } from '../components/morph';

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

/** Each row owns its own status so removals animate independently. */
function RemoveStudentButton({ onRemove }: { onRemove: () => Promise<boolean> }) {
  const { status, run } = useActionStatus();
  return (
    <Button
      variant="ghost"
      size="sm"
      status={status}
      icon={glyph.trash}
      busyLabel="Removing"
      doneLabel="Removed"
      className="text-destructive hover:bg-destructive/10"
      onClick={() => void run(onRemove)}
    >
      Remove
    </Button>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const createAction = useActionStatus();

  const [selected, setSelected] = useState<Group | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Import form
  const [bulkText, setBulkText] = useState('');
  const importAction = useActionStatus();
  const [importResult, setImportResult] = useState<string>('');

  const [oneStudent, setOneStudent] = useState('');
  const [oneNational, setOneNational] = useState('');
  const [oneName, setOneName] = useState('');
  const addAction = useActionStatus();

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
    setError('');
    await createAction.run(async () => {
      try {
        await groupsApi.create(newName.trim());
        setNewName('');
        await loadGroups();
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create group');
        return false;
      }
    });
  };

  const removeGroup = async (group: Group) => {
    if (
      !confirm(
        `Delete "${group.name}"? Its member list is removed and any links restricted to it become public.`,
      )
    )
      return;
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
    setError('');
    setImportResult('');
    await importAction.run(async () => {
      try {
        const result = await groupsApi.bulkImport(selected.id, bulkText);
        setImportResult(
          `${result.added} added${result.skipped.length ? `, ${result.skipped.length} skipped` : ''}`,
        );
        setBulkText('');
        const data = await groupsApi.credentials(selected.id);
        setCredentials(data.credentials);
        await loadGroups();
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Import failed');
        return false;
      }
    });
  };

  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !oneStudent.trim() || !oneNational.trim()) return;
    setError('');
    await addAction.run(async () => {
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
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not add student');
        return false;
      }
    });
  };

  const removeCredential = async (credential: Credential): Promise<boolean> => {
    if (!selected) return false;
    try {
      await groupsApi.removeCredential(selected.id, credential.id);
      setCredentials((prev) => prev.filter((c) => c.id !== credential.id));
      await loadGroups();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove student');
      return false;
    }
  };

  return (
    <div>
      <PageHeader
        title="Viewer groups"
        description="A group is the list of people allowed to open a restricted link. Members sign in with their student ID and national ID, and that identity is burned into the watermark."
      />

      {error && (
        <div className="mb-5 max-w-3xl">
          <InlineError>{error}</InlineError>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Groups column */}
        <div className="lg:col-span-1">
          <Panel className="p-5">
            <PanelHeader title="New group" />
            <form onSubmit={createGroup} className="mt-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Distributed Systems, Fall 2026"
                aria-label="Group name"
              />
              <Button
                type="submit"
                variant="primary"
                status={createAction.status}
                icon={glyph.plus}
                busyLabel="Creating"
                doneLabel="Created"
                disabled={!newName.trim()}
                className="mt-3 w-full"
              >
                Create group
              </Button>
            </form>
          </Panel>

          <div className="mt-4 space-y-2">
            {loading &&
              [...Array(3)].map((_, i) => (
                <Panel key={i} className="p-4">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </Panel>
              ))}

            {!loading && groups.length === 0 && (
              <EmptyState
                icon={<GroupsIcon size={18} />}
                title="No groups yet"
                description="Create a group, then paste your class list to give those students access."
              />
            )}

            {groups.map((group) => {
              const active = selected?.id === group.id;
              return (
                <Panel
                  key={group.id}
                  className={cx(
                    'p-4 transition-colors duration-150 ease-expo',
                    active ? 'border-accent-line bg-accent-muted' : 'hover:border-border-strong',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void openGroup(group)}
                      aria-pressed={active}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-foreground">{group.name}</p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {group.member_count} member{group.member_count === 1 ? '' : 's'}
                        <span className="mx-1.5 text-border-strong">/</span>
                        {group.link_count} link{group.link_count === 1 ? '' : 's'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeGroup(group)}
                      aria-label={`Delete group ${group.name}`}
                      className="shrink-0 rounded-chip p-1 text-text-tertiary transition-colors duration-150 ease-expo hover:bg-destructive/10 hover:text-destructive"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>

        {/* Members column */}
        <div className="lg:col-span-2">
          {!selected ? (
            <EmptyState
              icon={<GroupsIcon size={18} />}
              title="Select a group"
              description="Choose a group on the left to manage its members."
            />
          ) : (
            <div className="space-y-5">
              <Panel className="p-5">
                <PanelHeader
                  title={selected.name}
                  description="Paste a class list, one student per line, as studentId,nationalId[,name]."
                />
                <form onSubmit={importBulk} className="mt-4">
                  <Textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={5}
                    aria-label="Class list"
                    placeholder={'40123456,0012345678,Ali Rezaei\n40123457,0012345679,Sara Ahmadi'}
                    className="font-mono text-xs"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      status={importAction.status}
                      icon={glyph.upload}
                      busyLabel="Importing"
                      doneLabel="Imported"
                      disabled={!bulkText.trim()}
                    >
                      Import list
                    </Button>
                    {importResult && (
                      <span className="text-xs text-text-secondary">{importResult}</span>
                    )}
                  </div>
                </form>
              </Panel>

              <Panel className="p-5">
                <PanelHeader title="Add one student" />
                <form onSubmit={addOne} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    value={oneStudent}
                    onChange={(e) => setOneStudent(e.target.value)}
                    placeholder="Student ID"
                    aria-label="Student ID"
                  />
                  <Input
                    value={oneNational}
                    onChange={(e) => setOneNational(e.target.value)}
                    placeholder="National ID"
                    aria-label="National ID"
                  />
                  <Input
                    value={oneName}
                    onChange={(e) => setOneName(e.target.value)}
                    placeholder="Name (optional)"
                    aria-label="Name"
                  />
                  <div className="sm:col-span-3">
                    <Button
                      type="submit"
                      variant="secondary"
                      status={addAction.status}
                      icon={glyph.plus}
                      busyLabel="Adding"
                      doneLabel="Added"
                      disabled={!oneStudent.trim() || !oneNational.trim()}
                    >
                      Add student
                    </Button>
                  </div>
                </form>
              </Panel>

              <Table>
                <thead>
                  <tr>
                    <Th>Student ID</Th>
                    <Th>Name</Th>
                    <Th align="right">Added</Th>
                    <Th align="right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMembers && (
                    <tr>
                      <Td span className="py-6 text-sm text-text-tertiary">
                        Loading members
                      </Td>
                    </tr>
                  )}
                  {!loadingMembers && credentials.length === 0 && (
                    <tr>
                      <Td span className="py-6 text-sm text-text-tertiary">
                        No members yet. Import a list or add one student above.
                      </Td>
                    </tr>
                  )}
                  {credentials.map((c) => (
                    <Tr key={c.id}>
                      <Td label="Student ID">
                        <span className="font-mono text-sm text-foreground">{c.student_id}</span>
                      </Td>
                      <Td label="Name">
                        <span className="text-sm text-text-secondary">
                          {c.name || <span className="text-text-tertiary">Not provided</span>}
                        </span>
                      </Td>
                      <Td align="right" label="Added">
                        <span className="text-xs text-text-tertiary">{c.created_at}</span>
                      </Td>
                      <Td align="right">
                        <RemoveStudentButton onRemove={() => removeCredential(c)} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>

              <p className="text-xs text-text-tertiary">
                National IDs are stored only as bcrypt hashes and are never returned by the API.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
