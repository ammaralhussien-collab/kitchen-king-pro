import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, Search } from 'lucide-react';

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  roles: string[];
  created_at: string;
}

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  staff: 'bg-blue-100 text-blue-800',
  driver: 'bg-amber-100 text-amber-800',
  user: 'bg-muted text-muted-foreground',
};

const AdminUsersPage = () => {
  const { user, loading, isAdmin } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ userId: string; newRole: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchUsers = async (searchTerm = '') => {
    setFetching(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers(search);
    }
  }, [isAdmin]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isAdmin) fetchUsers(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const requestRoleChange = (userId: string, newRole: string) => {
    if (userId === user?.id) {
      toast.error('ما فيك تغيّر صلاحيتك بنفسك');
      return;
    }
    setPendingChange({ userId, newRole });
    setConfirmOpen(true);
  };

  const confirmRoleChange = async () => {
    if (!pendingChange) return;
    setUpdating(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_user_id: pendingChange.userId,
        new_role: pendingChange.newRole,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      toast.success('تم تحديث الصلاحية ✅');
      fetchUsers(search);
    } else {
      toast.error(result.error || 'صار في مشكلة… جرّب مرة تانية');
    }

    setUpdating(false);
    setConfirmOpen(false);
    setPendingChange(null);
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user || !isAdmin) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-lg text-muted-foreground">ما عندك صلاحية تدخل لهون</p>
    </div>
  );

  const getUserRole = (u: ManagedUser) => {
    if (u.roles.length === 0) return 'user';
    return u.roles[0];
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">إدارة المستخدمين</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الإيميل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {fetching ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const currentRole = getUserRole(u);
            return (
              <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold truncate">
                        {u.full_name || u.email}
                      </span>
                      <Badge className={`text-xs ${roleBadgeColors[currentRole] || roleBadgeColors.user}`}>
                        {currentRole}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-x-3">
                      <span>{u.email}</span>
                      {u.phone && <span>• {u.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {u.id === user?.id ? (
                      <span className="text-xs text-muted-foreground">أنت</span>
                    ) : (
                      <Select
                        value={currentRole}
                        onValueChange={(val) => requestRoleChange(u.id, val)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Customer</SelectItem>
                          <SelectItem value="driver">Driver</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">ما في مستخدمين.</p>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الصلاحية</AlertDialogTitle>
            <AlertDialogDescription>
              أكيد بدك تغيّر دور المستخدم؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updating}>
              تمام، غيّر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
