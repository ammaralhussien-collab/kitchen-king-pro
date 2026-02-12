import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  received: { label: 'Received', className: 'bg-status-received/15 text-status-received' },
  accepted: { label: 'Accepted', className: 'bg-status-preparing/15 text-status-preparing' },
  preparing: { label: 'Preparing', className: 'bg-status-preparing/15 text-status-preparing' },
  ready: { label: 'Ready', className: 'bg-status-ready/15 text-status-ready' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-status-delivery/15 text-status-delivery' },
  completed: { label: 'Completed', className: 'bg-status-completed/15 text-status-completed' },
  canceled: { label: 'Canceled', className: 'bg-status-canceled/15 text-status-canceled' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', config.className)}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
