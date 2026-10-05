import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../lib/api';
import { BellIcon } from './icons';
import { Button } from './ui';
import { glyph, useActionStatus } from './morph';

interface Notification {
  id: string;
  type: string;
  link_id: string | null;
  link_name: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list({ limit: 10 });
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // Silently fail - the bell is non-critical UI
    }
  }, []);

  // Poll for new notifications every 15s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllAction = useActionStatus();

  const handleMarkAllRead = async () =>
    markAllAction.run(async () => {
      try {
        await notificationsApi.markAllRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        return true;
      } catch {
        return false;
      }
    });

  const handleNotificationClick = async (notif: Notification) => {
    // Mark as read
    if (!notif.read) {
      try {
        await notificationsApi.markRead([notif.id]);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
    // Navigate to link detail
    if (notif.link_id) {
      navigate(`/dashboard/links/${notif.link_id}`);
      setOpen(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-control text-text-tertiary transition-colors duration-150 ease-expo hover:bg-hover hover:text-foreground"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-accent-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full z-50 mb-2 w-80 overflow-hidden rounded-panel border border-border bg-surface shadow-overlay">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
            <span className="text-xs font-medium text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                status={markAllAction.status}
                icon={glyph.checkAll}
                busyLabel="Marking"
                doneLabel="Done"
                onClick={() => void handleMarkAllRead()}
                className="h-7 px-2 text-[11px] text-accent hover:text-accent-hover"
              >
                Mark all read
              </Button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-tertiary">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full border-b border-border-subtle px-4 py-3 text-left transition-colors duration-150 ease-expo last:border-b-0 hover:bg-hover ${
                    !notif.read ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs leading-relaxed text-foreground">
                        {notif.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-text-tertiary">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
