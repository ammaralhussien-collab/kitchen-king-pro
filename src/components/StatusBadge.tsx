import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';
import type { TranslationKey } from '@/i18n/translations';

const statusStyles: Record<string, string> = {
  received: 'bg-status-received/15 text-status-received',
  accepted: 'bg-status-preparing/15 text-status-preparing',
  preparing: 'bg-status-preparing/15 text-status-preparing',
  ready: 'bg-status-ready/15 text-status-ready',
  out_for_delivery: 'bg-status-delivery/15 text-status-delivery',
  completed: 'bg-status-completed/15 text-status-completed',
  canceled: 'bg-status-canceled/15 text-status-canceled',
};

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useI18n();
  const style = statusStyles[status] ?? 'bg-muted text-muted-foreground';
  const key = `status.${status}` as TranslationKey;
  const label = t(key) !== key ? t(key) : status.replace('_', ' ');

  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', style)}>
      {label}
    </span>
  );
};

export default StatusBadge;
