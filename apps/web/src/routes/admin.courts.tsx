import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Court } from '@courtly/contracts';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CourtFormDialog } from '@/components/court-form-dialog';
import { EmptyState, ErrorState } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { SportIcon } from '@/components/sport-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/error-messages';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { adminCourtsQueryOptions, useUpdateCourt } from '@/queries/admin';

export const Route = createFileRoute('/admin/courts')({
  component: AdminCourtsPage,
});

function AdminCourtsPage() {
  const courts = useQuery(adminCourtsQueryOptions());
  const updateCourt = useUpdateCourt();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Court | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(court: Court) {
    setEditing(court);
    setDialogOpen(true);
  }

  async function toggleActive(court: Court) {
    setTogglingId(court.id);

    try {
      await updateCourt.mutateAsync({
        courtId: court.id,
        patch: { isActive: !court.isActive },
      });
      toast.success(court.isActive ? 'Court deactivated' : 'Court activated');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTogglingId(null);
    }
  }

  const activeCount = (courts.data ?? []).filter((court) => court.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin"
        title="Courts"
        description="Create, edit and deactivate courts. Deactivating keeps every booking."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            New court
          </Button>
        }
      />

      {courts.isSuccess && courts.data.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {activeCount} active {activeCount === 1 ? 'court' : 'courts'} &middot;{' '}
          {courts.data.length} total
        </p>
      ) : null}

      {courts.isPending ? <Skeleton className="h-48 rounded-2xl" /> : null}

      {courts.isError ? (
        <ErrorState
          title="Could not load courts"
          message={errorMessage(courts.error)}
          onRetry={() => void courts.refetch()}
        />
      ) : null}

      {courts.isSuccess && courts.data.length === 0 ? (
        <EmptyState
          title="No courts yet"
          description="Create the facility's first court."
          action={<Button onClick={openCreate}>New court</Button>}
        />
      ) : null}

      {courts.isSuccess && courts.data.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Court</TableHead>
                <TableHead className="px-4">Sport</TableHead>
                <TableHead className="px-4">Price</TableHead>
                <TableHead className="px-4">Hours</TableHead>
                <TableHead className="px-4">Active</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courts.data.map((court) => (
                <TableRow
                  key={court.id}
                  className={cn('hover:bg-muted/40', !court.isActive && 'bg-muted/20')}
                >
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <SportIcon
                        sportType={court.sportType}
                        className={cn('size-9 rounded-lg', !court.isActive && 'opacity-60')}
                        iconClassName="size-4"
                      />
                      <span
                        className={cn('font-medium', !court.isActive && 'text-muted-foreground')}
                      >
                        {court.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 capitalize">{court.sportType}</TableCell>
                  <TableCell className="px-4 tabular-nums">
                    {formatPrice(court.hourlyPriceCents)}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums">
                    {court.opensAt}&ndash;{court.closesAt}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={court.isActive}
                        disabled={togglingId === court.id}
                        onCheckedChange={() => void toggleActive(court)}
                        aria-label={`${court.isActive ? 'Deactivate' : 'Activate'} ${court.name}`}
                      />
                      <Badge
                        variant={court.isActive ? 'secondary' : 'outline'}
                        className={cn(
                          'gap-1.5',
                          court.isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-1.5 rounded-full',
                            court.isActive ? 'bg-primary' : 'bg-muted-foreground',
                          )}
                        />
                        {court.isActive ? 'Active' : 'Deactivated'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(court)}>
                      <PencilIcon aria-hidden="true" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <CourtFormDialog
        open={dialogOpen}
        court={editing}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditing(null);
          }
        }}
      />
    </div>
  );
}
