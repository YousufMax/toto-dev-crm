import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  recordId: string;
  recordDescription: string;
  moduleName: 'Sales Order' | 'Expense' | 'Resource Payout';
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  recordId,
  recordDescription,
  moduleName,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      setError('Please type DELETE to confirm permanent deletion.');
      return;
    }

    try {
      setIsDeleting(true);
      setError('');
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl shadow-rose-950/50">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                {title}
              </h3>
              <p className="text-xs text-rose-400/90 font-medium">
                Super Admin Exclusive Authorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Content */}
        <div className="py-5 space-y-4">
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-rose-300">
                Permanent Data Removal Warning
              </p>
              <p className="text-slate-400 leading-relaxed">
                Deleting this <strong className="text-white">{moduleName}</strong> will permanently remove it from the CRM active dataset, reports, KPI calculations, and synchronized Google Sheets.
              </p>
            </div>
          </div>

          {/* Record Details */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Record ID:</span>
              <span className="font-mono font-bold text-blue-400">{recordId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Details:</span>
              <span className="font-medium text-slate-200 truncate max-w-[220px]" title={recordDescription}>
                {recordDescription}
              </span>
            </div>
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">
              Type <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={e => {
                setConfirmInput(e.target.value);
                if (error) setError('');
              }}
              placeholder="DELETE"
              disabled={isDeleting}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || confirmInput.trim().toUpperCase() !== 'DELETE'}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-900/30 hover:bg-rose-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Confirm Permanent Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
