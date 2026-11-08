import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Court } from '@courtly/contracts';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CourtFormDialog } from '@/components/court-form-dialog';
import { EmptyState, ErrorState } from '@/components/feedback';
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Courts</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit and deactivate courts. Deactivating keeps every booking.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          New court
        </Button>
      </header>

      {courts.isPending ? <Skeleton className="h-48 rounded-xl" /> : null}

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
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Court</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courts.data.map((court) => (
                <TableRow key={court.id}>
                  <TableCell className="font-medium">{court.name}</TableCell>
                  <TableCell>{court.sportType}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatPrice(court.hourlyPriceCents)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {court.opensAt}&ndash;{court.closesAt}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={court.isActive}
                        disabled={togglingId === court.id}
                        onCheckedChange={() => void toggleActive(court)}
                        aria-label={`${court.isActive ? 'Deactivate' : 'Activate'} ${court.name}`}
                      />
                      <Badge variant={court.isActive ? 'secondary' : 'outline'}>
                        {court.isActive ? 'Active' : 'Deactivated'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(court)}>
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
