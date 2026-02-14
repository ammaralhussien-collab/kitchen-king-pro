import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface CreateDriverModalProps {
  onCreated: () => void;
}

const CreateDriverModal = ({ onCreated }: CreateDriverModalProps) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'مطلوب';
    if (!form.email.trim()) {
      e.email = 'مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'إيميل غير صالح';
    }
    if (!form.password) {
      e.password = 'مطلوب';
    } else if (form.password.length < 10) {
      e.password = 'على الأقل 10 أحرف';
    }
    if (form.phone && !/^\+?\d+$/.test(form.phone)) {
      e.phone = 'أرقام فقط (+ بالبداية مسموح)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePhoneChange = (value: string) => {
    // Allow only digits and optional leading +
    const cleaned = value.replace(/[^\d+]/g, '');
    // Ensure + only at start
    const sanitized = cleaned.charAt(0) === '+' 
      ? '+' + cleaned.slice(1).replace(/\+/g, '') 
      : cleaned.replace(/\+/g, '');
    setForm(prev => ({ ...prev, phone: sanitized }));
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('الجلسة منتهية، سجّل دخول من جديد');
      setSubmitting(false);
      return;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-driver`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      toast.success('تم إنشاء السائق بنجاح ✅');
      toast.info('شارك بيانات الدخول مع السائق ليقدر يفوت على صفحة /driver', { duration: 6000 });
      setOpen(false);
      setForm({ full_name: '', email: '', password: '', phone: '' });
      setErrors({});
      onCreated();
    } else if (response.status === 409) {
      toast.error('هذا البريد مستخدم مسبقاً');
    } else {
      toast.error(result.error || 'صار في مشكلة… جرّب مرة تانية');
    }

    setSubmitting(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        إضافة سائق
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة سائق جديد</DialogTitle>
            <DialogDescription>أدخل بيانات السائق لإنشاء حساب جديد</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="driver-name">الاسم الكامل *</Label>
              <Input
                id="driver-name"
                value={form.full_name}
                onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="مثلاً: أحمد خالد"
              />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="driver-email">البريد الإلكتروني *</Label>
              <Input
                id="driver-email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="driver@example.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="driver-password">كلمة المرور *</Label>
              <Input
                id="driver-password"
                type="password"
                dir="ltr"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="على الأقل 10 أحرف"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="driver-phone">رقم الهاتف</Label>
              <Input
                id="driver-phone"
                type="tel"
                dir="ltr"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+49123456789"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'جاري الإنشاء...' : 'إنشاء السائق'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateDriverModal;
