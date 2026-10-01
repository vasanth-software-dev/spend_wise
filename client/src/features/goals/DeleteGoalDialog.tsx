import React from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { formatINR } from '../../utils/format.js';
import type { Goal } from '../../types/index.js';

interface DeleteGoalDialogProps {
  isOpen: boolean;
  goal: Goal;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteGoalDialog: React.FC<DeleteGoalDialogProps> = ({
  isOpen,
  goal,
  busy,
  onCancel,
  onConfirm,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title="Delete goal?"
    description="This permanently removes the goal and its contribution history. This cannot be undone."
    maxWidth="sm"
  >
    <div className="space-y-4">
      <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-slate-700 dark:text-slate-200">
        <strong>{goal.name}</strong> — {formatINR(goal.currentAmount)} saved of{' '}
        {formatINR(goal.targetAmount)} — will be deleted with all contributions.
        Your transactions and reports are not affected.
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          isLoading={busy}
          onClick={onConfirm}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Delete Goal
        </Button>
      </div>
    </div>
  </Modal>
);
