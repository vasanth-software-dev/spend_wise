import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createTransactionThunk } from '../../store/slices/transactionSlice.js';
import { fetchCalendarMonthThunk, fetchCalendarDayThunk } from '../../store/slices/calendarSlice.js';
import { fetchDashboardThunk } from '../../store/slices/dashboardSlice.js';
import { api } from '../../services/api.js';
import { toast } from '../../components/ui/Toast.js';
import type { Category, Transaction } from '../../types/index.js';
import { describeScanFailure, validateImageFile } from './imageValidation.js';
import { preprocessImage, type PreprocessedImage } from './imagePreprocessing.js';
import { createOCRProviders, disposeOCRProviders, recognizeWithFallback } from './ocr/index.js';
import { extractReceiptData } from './receiptExtractionService.js';
import { extractReceiptBreakdown } from './receiptBreakdown.js';
import { cropToGuide, perspectiveCorrect } from './imageProcessing.js';
import type { Point } from './receiptDetection.js';
import { ScannerModeSelector, type ScannerMode } from './ScannerModeSelector.js';
import { ReceiptUpload } from './ReceiptUpload.js';
import { LiveReceiptScanner } from './LiveReceiptScanner.js';
import { ReceiptReview, type ReviewForm } from './ReceiptReview.js';
import type { ExtractedReceiptData, OCRService, OCRError } from './types.js';

type ScannerStep = 'capture' | 'processing' | 'review' | 'error';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fills the date, e.g. when scanning from a calendar day. */
  defaultDate?: string | null;
  onSuccess?: (transaction: Transaction) => void;
}

/**
 * The temporary, in-memory image lifecycle for a single scan.
 *
 * `objectUrl` and the original `File` are both revoked and dereferenced the
 * moment a scan is confirmed, discarded or replaced. Nothing is uploaded, cached
 * or persisted, so there is no receipt image on the server to leak or retain.
 */
type ApplyExtraction = (
  extraction: ExtractedReceiptData,
  allCategories: Category[],
  preview: string,
  rawText?: string,
) => void;

interface ScanSession {
  /** The user's original file, held in memory only for the duration of a scan. */
  file: File;
  preprocessed: PreprocessedImage | null;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.categories.categories) as Category[];

  const [step, setStep] = useState<ScannerStep>('capture');
  const [progress, setProgress] = useState<{ percent: number | null; status: string }>({
    percent: null,
    status: '',
  });
  const [errorMessage, setErrorMessage] = useState("We couldn't read this ticket clearly.");

  const sessionRef = useRef<ScanSession | null>(null);
  const providersRef = useRef<OCRService[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Unified review form (single source; ReceiptReview edits via onPatch).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<ScannerMode>('upload');
  const emptyForm = (): ReviewForm => ({
    merchant: '', amount: '', date: defaultDate || todayISO(), time: '',
    categoryId: '', paymentMethod: 'cash', description: '', ticketNumber: '',
    subtotal: '', discount: '', cgst: '', sgst: '', igst: '', total: '', items: [],
  });
  const [form, setForm] = useState<ReviewForm>(emptyForm);
  const [lowConfidence, setLowConfidence] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Transaction[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  const expenseCategories = categories.filter(
    (category) => category.type === 'expense' || category.type === 'both'
  );

  /**
   * Frees the current temporary image and cancels any in-flight OCR.
   *
   * Only the re-encoded preprocessed copy ever gets an object URL (that is what
   * the preview shows); the user's original file is held as a `File` reference
   * and simply dropped, so no second URL is ever created for it.
   */
  const releaseSession = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    const session = sessionRef.current;
    if (session?.preprocessed) {
      URL.revokeObjectURL(session.preprocessed.previewUrl);
    }
    // Dropping the reference is what releases the original file.
    sessionRef.current = null;

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setLowConfidence({});
    setFormError(null);
    setDuplicates([]);
    setDuplicateAcknowledged(false);
    setErrorMessage("We couldn't read this ticket clearly.");
    setProgress({ percent: null, status: '' });
  }, [defaultDate]);

  /**
   * Holds the current `applyExtraction` so the scan loop can stay a single
   * `useCallback` without depending on a declaration further down the file.
   */
  const applyExtractionRef = useRef<ApplyExtraction>(() => {});

  const getProviders = useCallback((): OCRService[] => {
    if (!providersRef.current) {
      // No server endpoint is configured, so this resolves to the on-device
      // engine alone: zero cost, no external dependency, works offline.
      providersRef.current = createOCRProviders({ serverEndpoint: null });
    }
    return providersRef.current;
  }, []);

  /**
   * Runs the full scan for one file: validate, preprocess locally, OCR, extract.
   *
   * A rotation hint from a first pass is fed back into preprocessing and the
   * image is re-OCR'd once, which recovers most sideways captures without
   * asking the user to retake the photo.
   */
  const runScan = useCallback(
    async (file: File) => {
      let rotationHint: number | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        setProgress({ percent: null, status: 'Preparing image' });
        const preprocessed = await preprocessImage(file, { rotationDegrees: rotationHint });

        // Keep only the current temporary copy; the previous attempt's URL is
        // revoked immediately.
        const previous = sessionRef.current?.preprocessed;
        if (previous) URL.revokeObjectURL(previous.previewUrl);

        if (!sessionRef.current) {
          sessionRef.current = { file, preprocessed };
        } else {
          sessionRef.current.preprocessed = preprocessed;
        }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const { result } = await recognizeWithFallback(getProviders(), preprocessed.blob, {
            onProgress: setProgress,
            signal: controller.signal,
          });

          if (attempt === 0 && rotationHint === null && result.rotationDegrees) {
            // Text was read but the page looked rotated: straighten and retry
            // once before giving the user a poor result.
            rotationHint = result.rotationDegrees;
            continue;
          }

          applyExtractionRef.current(
            extractReceiptData(result, categories),
            categories,
            preprocessed.previewUrl,
            result.text
          );
          setStep('review');
          return;
        } catch (error) {
          const ocrError = error as OCRError;
          if (ocrError.code === 'CANCELLED') return;

          if (attempt === 0 && ocrError.code === 'NO_TEXT_FOUND' && rotationHint === null) {
            // Empty first read is often a rotated ticket: try 180° once.
            rotationHint = 180;
            continue;
          }

          setErrorMessage(describeScanFailure(ocrError.code));
          setStep('error');
          return;
        }
      }

      setErrorMessage("We couldn't read this ticket clearly.");
      setStep('error');
    },
    [categories, getProviders]
  );

  /** Fills the review form from an extraction, leaving unread fields empty. */
  const applyExtraction = useCallback<ApplyExtraction>(
    (extraction, allCategories, preview, rawText) => {
      setPreviewUrl((current) => {
        if (current && current !== preview) URL.revokeObjectURL(current);
        return preview;
      });

      const breakdown = extractReceiptBreakdown(rawText || '');
      const num = (v: number | null) => (v === null ? '' : String(v));
      // Breakdown total wins when the base extractor found nothing.
      const totalStr =
        extraction.amount !== null ? String(extraction.amount) : num(breakdown.total);
      let categoryId = '';
      if (extraction.category) {
        const match = allCategories.find(
          (c) => c.name.toLowerCase() === extraction.category!.toLowerCase()
        );
        categoryId = match?._id || '';
      }
      setForm({
        merchant: extraction.merchant || '',
        amount: totalStr,
        date: extraction.date || defaultDate || todayISO(),
        time: extraction.time || '',
        categoryId,
        paymentMethod: extraction.paymentMethod || 'cash',
        description: extraction.description || '',
        ticketNumber: extraction.ticketNumber || '',
        subtotal: num(breakdown.subtotal),
        discount: num(breakdown.discount),
        cgst: num(breakdown.cgst),
        sgst: num(breakdown.sgst),
        igst: num(breakdown.igst),
        total: totalStr,
        items: breakdown.items,
      });

      setLowConfidence({
        merchant: extraction.merchant === null,
        amount: extraction.amount === null,
        date: extraction.date === null,
      });

      setDuplicates([]);
      setDuplicateAcknowledged(false);
      setFormError(null);
    },
    [defaultDate]
  );

  // Keeps the ref pointed at the latest callback so the scan loop never closes
  // over a stale one.
  applyExtractionRef.current = applyExtraction;

  const handleFileSelected = useCallback(
    async (selected: File | null | undefined) => {
      if (!selected) return;

      // Replace any previous temporary image before accepting a new one.
      releaseSession();
      resetForm();

      try {
        const validated = validateImageFile(selected);
        setStep('processing');
        await runScan(validated.file);
      } catch (error) {
        const ocrError = error as OCRError;
        setErrorMessage(describeScanFailure(ocrError.code));
        setStep('error');
      }
    },
    [releaseSession, resetForm, runScan]
  );

  /** Live capture: perspective-correct / crop, then shared OCR pipeline. */
  const handleLiveCapture = useCallback(
    async (captured: File, quad: Point[] | null) => {
      releaseSession();
      resetForm();
      try {
        const validated = validateImageFile(captured);
        setStep('processing');
        let working = validated.file;
        try {
          working = quad ? await perspectiveCorrect(working, quad) : await cropToGuide(working);
        } catch { /* best-effort; fall through with raw capture */ }
        await runScan(working);
      } catch (error) {
        const ocrError = error as OCRError;
        setErrorMessage(describeScanFailure(ocrError.code));
        setStep('error');
      }
    },
    [releaseSession, resetForm, runScan]
  );

  /** "Try again" returns to the camera/gallery choice. */
  const handleScanAgain = useCallback(() => {
    releaseSession();
    resetForm();
    setStep('capture');
  }, [releaseSession, resetForm]);

  /**
   * Asks the server whether this looks like a transaction already recorded.
   *
   * Advisory only: a match shows "Possible duplicate expense" with Review
   * existing / Add anyway, and never blocks the user from saving.
   */
  const checkDuplicates = useCallback(
    async (candidate: { amount: number; merchant: string; date: string; refNo?: string }) => {
      try {
        const res = await api.post('/transactions/check-duplicate', {
          amount: candidate.amount,
          merchant: candidate.merchant,
          transactionDate: candidate.date,
          refNo: candidate.refNo || undefined,
          type: 'expense',
        });
        const matched = res.data?.data?.matchedTransaction;
        setDuplicates(matched ? [matched as Transaction] : []);
      } catch {
        // A failed duplicate probe must not block the expense; the server also
        // warns on create, so the ledger is still protected.
        setDuplicates([]);
      }
    },
    []
  );

  /**
   * Confirms the scan and creates the expense through the existing transaction
   * path. Nothing is written until the user reaches this button.
   */
  const handleConfirm = useCallback(
    async (options: { skipDuplicateCheck?: boolean } = {}) => {
      const saveTotal = form.total.trim() || form.amount.trim();
      const numericAmount = parseFloat(saveTotal);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setFormError('Please enter the amount shown on the ticket.');
        return;
      }
      if (!form.merchant.trim()) {
        setFormError('Please enter who you paid.');
        return;
      }
      if (!form.date) {
        setFormError('Please choose the date.');
        return;
      }

      if (duplicates.length > 0 && !options.skipDuplicateCheck && !duplicateAcknowledged) {
        return;
      }

      setIsSubmitting(true);
      setFormError(null);

      try {
        if (duplicates.length === 0 && !options.skipDuplicateCheck) {
          await checkDuplicates({
            amount: numericAmount,
            merchant: form.merchant.trim(),
            date: form.date,
            refNo: form.ticketNumber.trim() || undefined,
          });
          setIsSubmitting(false);
          return;
        }

        const created = await dispatch(
          createTransactionThunk({
            type: 'expense',
            amount: numericAmount,
            currency: 'INR',
            categoryId: form.categoryId || undefined,
            merchant: form.merchant.trim(),
            description: form.description.trim() || undefined,
            paymentMethod: form.paymentMethod,
            refNo: form.ticketNumber.trim() || undefined,
            externalTransactionId: form.ticketNumber.trim() || undefined,
            transactionDate: new Date(form.time ? `${form.date}T${form.time}` : form.date),
            notes: undefined,
            // Attribution label only: the transaction is otherwise identical to
            // a manually entered one, so it flows through the dashboard,
            // calendar, reports and category totals automatically.
            source: 'receipt_scan',
          })
        ).unwrap();

        // Refresh the surfaces a scanned expense must appear in immediately.
        // `fetchCalendarMonthThunk` refuses a future month, so the refresh is
        // skipped for a back-dated scan and the calendar picks it up on its next
        // load instead of the request failing.
        const expenseDate = new Date(form.date);
        const now = new Date();
        const isCurrentOrPastMonth =
          expenseDate.getFullYear() < now.getFullYear() ||
          (expenseDate.getFullYear() === now.getFullYear() &&
            expenseDate.getMonth() <= now.getMonth());

        dispatch(fetchDashboardThunk('30d'));
        if (isCurrentOrPastMonth) {
          dispatch(
            fetchCalendarMonthThunk({
              year: expenseDate.getFullYear(),
              month: expenseDate.getMonth() + 1,
            })
          );
          dispatch(fetchCalendarDayThunk(form.date));
        }

        toast.success('Expense added from your receipt');

        // The temporary image is deleted the moment the expense exists.
        releaseSession();
        resetForm();
        setStep('capture');

        if (onSuccess) onSuccess(created);
        onClose();
      } catch (error: any) {
        setFormError(error?.response?.data?.message || 'Failed to save the expense.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      form,
      duplicates.length,
      duplicateAcknowledged,
      checkDuplicates,
      createTransactionThunk,
      dispatch,
      fetchDashboardThunk,
      fetchCalendarMonthThunk,
      fetchCalendarDayThunk,
      releaseSession,
      resetForm,
      onClose,
      onSuccess,
    ]
  );

  // Revoke every temporary URL and tear down the OCR worker when the modal
  // unmounts, so nothing survives the session in memory.
  useEffect(() => {
    if (!isOpen) {
      releaseSession();
      disposeOCRProviders(providersRef.current || []).then(() => {
        providersRef.current = null;
      });
      setStep('capture');
      setMode('upload');
    }
  }, [isOpen, releaseSession]);

  const unreadCount = Object.values(lowConfidence).filter(Boolean).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan Receipt / Ticket"
      description="Photograph a bus ticket, movie ticket, restaurant bill or grocery receipt. Reading happens on this device and the image is deleted once you save."
      maxWidth="lg"
    >
      {step === 'capture' && (
        <div className="space-y-4">
          <ScannerModeSelector mode={mode} onChange={setMode} />
          {mode === 'upload' ? (
            <ReceiptUpload onFile={(f) => void handleFileSelected(f)} busy={false} />
          ) : (
            <LiveReceiptScanner
              busy={false}
              onPickFromGallery={() => setMode('upload')}
              onClose={() => setMode('upload')}
              onCapture={(file, quad) => void handleLiveCapture(file, quad)}
            />
          )}

          {mode === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Enter manually instead
              </button>

              <div className="flex items-start gap-2 pt-1">
                <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Runs entirely on your device using open-source OCR. Nothing is uploaded, and the photo is
                  discarded after you save.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="py-10 text-center">
          <Loader2 className="w-8 h-8 mx-auto text-brand-600 dark:text-brand-400 animate-spin" />
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-4">
            {progress.status || 'Reading your ticket'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            The first scan may take a moment while the OCR engine loads.
          </p>
          {progress.percent !== null && (
            <div className="mt-4 mx-auto max-w-[220px]">
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/10">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{errorMessage}</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 leading-relaxed">
                  Try a brighter, flatter photo, or add it yourself.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={handleScanAgain}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Enter Manually
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <ReceiptReview
          previewUrl={previewUrl}
          form={form}
          onPatch={(patch) => setForm((f) => ({ ...f, ...patch }))}
          lowConfidence={lowConfidence}
          unreadCount={unreadCount}
          expenseCategories={expenseCategories}
          duplicates={duplicates}
          formError={formError}
          isSubmitting={isSubmitting}
          onRetake={handleScanAgain}
          onCancel={onClose}
          onSave={() => { setDuplicateAcknowledged(false); void handleConfirm(); }}
          onReviewExisting={onClose}
          onSaveAnyway={() => void handleConfirm({ skipDuplicateCheck: true })}
        />
      )}
    </Modal>
  );
};

function todayISO(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
