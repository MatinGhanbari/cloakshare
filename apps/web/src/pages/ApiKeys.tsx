import { useEffect, useState } from 'react';
import { apiKeysApi } from '../lib/api';
import {
  Button,
  CopyField,
  EmptyState,
  InlineError,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { KeyIcon, PlusIcon } from '../components/icons';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    apiKeysApi
      .list()
      .then((data) => setKeys(data.api_keys))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load API keys');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const result = await apiKeysApi.create(newKeyName.trim());
      setNewKey(result.key);
      setNewKeyName('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await apiKeysApi.revoke(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  return (
    <div>
      <PageHeader
        title="API keys"
        description="Keys authenticate the API and the SDKs. A key is shown once at creation, then only its prefix is kept."
      />

      {error && (
        <div className="mb-6 max-w-3xl">
          <InlineError>{error}</InlineError>
        </div>
      )}

      <Panel className="mb-6 p-5">
        <PanelHeader title="Create a key" />
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name, for example Production"
            aria-label="Key name"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            loading={creating}
            disabled={!newKeyName.trim()}
          >
            <PlusIcon size={14} />
            Create
          </Button>
        </form>
      </Panel>

      {/* Shown once, right after creation. */}
      {newKey && (
        <Panel className="mb-6 border-accent-line bg-accent-muted p-5">
          <PanelHeader
            title="Copy this key now"
            description="It will not be shown again."
            actions={
              <Button variant="ghost" size="sm" onClick={() => setNewKey('')}>
                Dismiss
              </Button>
            }
          />
          <CopyField value={newKey} className="mt-4" />
        </Panel>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Panel key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-3 w-32" />
            </Panel>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={<KeyIcon size={18} />}
          title="No API keys"
          description="Create a key above to call the API or connect an SDK."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Key</Th>
              <Th align="right">Last used</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <Tr key={key.id}>
                <Td label="Name">
                  <span className="text-sm text-foreground">{key.name}</span>
                </Td>
                <Td label="Key">
                  <span className="font-mono text-xs text-text-tertiary">{key.key_prefix}...</span>
                </Td>
                <Td align="right" label="Last used">
                  <span className="whitespace-nowrap text-xs text-text-tertiary">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                  </span>
                </Td>
                <Td align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(key.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    Revoke
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
