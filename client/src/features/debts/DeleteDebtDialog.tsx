import React from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { formatINR } from '../../utils/format.js';
interface Props { isOpen: boolean; personName: string; remaining: number; busy: boolean; onCancel: () => void; onConfirm: () => void; }
export const DeleteDebtDialog: React.FC<Props> = ({ isOpen, personName, remaining, busy, onCancel, onConfirm }) => (
<Modal isOpen={isOpen} onClose={onCancel} title="Delete debt?" description="This permanently removes the debt and its payment history. This cannot be undone." maxWidth="sm">
<div className="space-y-4">
<div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs">Debt with <strong>{personName}</strong> — remaining <strong>{formatINR(remaining)}</strong> — will be deleted with all payments.</div>
<div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button><Button variant="danger" size="sm" isLoading={busy} onClick={onConfirm} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>Delete Debt</Button></div>
</div>
</Modal>);
