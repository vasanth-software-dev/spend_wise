import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Image as ImageIcon, Loader2, RotateCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createTransactionThunk } from '../../store/slices/transactionSlice.js';
import { fetchCalendarMonthThunk, fetchCalendarDayThunk } from '../../store/slices/calendarSlice.js';
import { fetchDashboardThunk } from '../../store/slices/dashboardSlice.js';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.js';
import type { Category, PaymentMethod, Transaction } from '../../types/index.js';
import { ACCEPT_ATTRIBUTE, describeScanFailure, validateImageFile } from './imageValidation.js';
import { preprocessImage, type PreprocessedImage } from './imagePreprocessing.js';
import { createOCRProviders, disposeOCRProviders, recognizeWithFallback } from './ocr/index.js';
import { extractReceiptData } from './receiptExtractionService.js';
import type { ExtractedReceiptData, OCRService, OCRError } from './types.js';

type ScannerStep = 'capture' | 'processing' | 'review' | 'error';

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string }> = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI (GPay/PhonePe/Paytm)' },
  { id: 'bank', label: 'Net Banking / IMPS' },
  { id: 'card', label: 'Debit / Credit Card' },
  { id: 'wallet', label: 'Mobile Wallet' },
  { id: 'other', label: 'Other' },
];

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
  preview: string
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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Review form state. Fields the OCR could not read stay empty on purpose.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => defaultDate || todayISO());
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [description, setDescription] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
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
    setMerchant('');
    setAmount('');
    setDate(defaultDate || todayISO());
    setCategoryId('');
    // Cash is the default for the primary use case, but it stays fully editable.
    setPaymentMethod('cash');
    setDescription('');
    setTicketNumber('');
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
            preprocessed.previewUrl
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
    (extraction, allCategories, preview) => {
      setPreviewUrl((current) => {
        if (current && current !== preview) URL.revokeObjectURL(current);
        return preview;
      });

      setMerchant(extraction.merchant || '');
      setAmount(extraction.amount !== null ? String(extraction.amount) : '');
      setDate(extraction.date || defaultDate || todayISO());
      setTicketNumber(extraction.ticketNumber || '');
      setDescription(extraction.description || '');

      if (extraction.paymentMethod) {
        setPaymentMethod(extraction.paymentMethod);
      } else {
        setPaymentMethod('cash');
      }

      // Resolve the suggested category name to a real category id. A suggestion
      // with no matching category is ignored rather than inventing one.
      if (extraction.category) {
        const match = allCategories.find(
          (category) => category.name.toLowerCase() === extraction.category!.toLowerCase()
        );
        setCategoryId(match?._id || '');
      } else {
        setCategoryId('');
      }

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
      const numericAmount = parseFloat(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setFormError('Please enter the amount shown on the ticket.');
        return;
      }
      if (!merchant.trim()) {
        setFormError('Please enter who you paid.');
        return;
      }
      if (!date) {
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
            merchant: merchant.trim(),
            date,
            refNo: ticketNumber.trim() || undefined,
          });
          setIsSubmitting(false);
          return;
        }

        const created = await dispatch(
          createTransactionThunk({
            type: 'expense',
            amount: numericAmount,
            currency: 'INR',
            categoryId: categoryId || undefined,
            merchant: merchant.trim(),
            description: description.trim() || undefined,
            paymentMethod,
            refNo: ticketNumber.trim() || undefined,
            externalTransactionId: ticketNumber.trim() || undefined,
            transactionDate: new Date(date),
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
        const expenseDate = new Date(date);
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
          dispatch(fetchCalendarDayThunk(date));
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
      amount,
      merchant,
      date,
      ticketNumber,
      categoryId,
      description,
      paymentMethod,
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
      {/* Hidden pickers: one opens the camera, one the gallery. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {step === 'capture' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850/40 p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Snap a photo of your ticket</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Fill the frame with the ticket, keep it flat and well lit, then check the amount before saving.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              variant="primary"
              onClick={() => cameraInputRef.current?.click()}
              leftIcon={<Camera className="w-4 h-4" />}
            >
              Take Photo
            </Button>
            <Button
              variant="outline"
              onClick={() => galleryInputRef.current?.click()}
              leftIcon={<ImageIcon className="w-4 h-4" />}
            >
              Choose Image
            </Button>
          </div>

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
            <Button variant="outline" onClick={handleScanAgain} leftIcon={<RotateCw className="w-4 h-4" />}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Enter Manually
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          {previewUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850/40">
              <img
                src={previewUrl}
                alt="Scanned receipt preview"
                className="w-full max-h-56 object-contain"
              />
              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/70 text-[10px] font-semibold text-white">
                Temporary · deleted after saving
              </span>
            </div>
          )}

          {unreadCount > 0 && (
            <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-[11px] font-semibold text-amber-700 dark:text-amber-300 leading-relaxed">
              {unreadCount === 1 ? 'One field could' : `${unreadCount} fields could`} not be read
              clearly. Please fill {unreadCount === 1 ? 'it in' : 'them in'} before saving.
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400 font-mono pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={lowConfidence.amount ? 'Enter amount' : '0.00'}
                className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border rounded-xl text-2xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:font-sans placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 ${
                  lowConfidence.amount
                    ? 'border-amber-400 dark:border-amber-500/60'
                    : 'border-slate-200 dark:border-slate-700/80 focus:border-brand-500'
                }`}
              />
            </div>
            {amount && (
              <span className="pb-2.5 text-sm font-extrabold font-mono tabular-financial text-slate-400">
                {formatINR(parseFloat(amount) || 0)}
              </span>
            )}
          </div>

          <Input
            label="Merchant"
            placeholder={lowConfidence.merchant ? 'Enter merchant' : 'e.g. PVR Cinemas'}
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
          />

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Category
            </label>
            <CategorySelect
              categories={expenseCategories}
              value={categoryId}
              onChange={setCategoryId}
              valueMode="id"
              placeholder="Select category..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors font-medium"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={`w-full py-2 px-3 bg-white dark:bg-slate-900 border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors font-medium ${
                  lowConfidence.date
                    ? 'border-amber-400 dark:border-amber-500/60'
                    : 'border-slate-200 dark:border-slate-700 focus:border-brand-500'
                }`}
              />
            </div>
          </div>

          <Input
            label="Description (Optional)"
            placeholder="e.g. Movie ticket"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <Input
            label="Ticket / Receipt No. (Optional)"
            placeholder="e.g. TKT-4821"
            value={ticketNumber}
            onChange={(event) => setTicketNumber(event.target.value)}
          />

          {/* Duplicate prompt. Advisory: the user decides, the app never blocks. */}
          {duplicates.length > 0 && (
            <div className="p-3.5 rounded-2xl border border-rose-500/25 bg-rose-500/10">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    Possible duplicate expense
                  </p>
                  {duplicates.map((existing) => (
                    <p key={existing._id} className="text-[11px] text-rose-700/90 dark:text-rose-400/90 mt-1">
                      {existing.merchant} · {formatINR(existing.amount)} ·{' '}
                      {new Date(existing.transactionDate).toLocaleDateString('en-IN')}
                    </p>
                  ))}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Stop here and let the user inspect the existing entry.
                        onClose();
                      }}
                    >
                      Review Existing
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={isSubmitting}
                      onClick={() => void handleConfirm({ skipDuplicateCheck: true })}
                    >
                      Add Anyway
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold">
              {formError}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleScanAgain}
                leftIcon={<RotateCw className="w-4 h-4" />}
              >
                Scan Again
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              onClick={() => {
                setDuplicateAcknowledged(false);
                void handleConfirm();
              }}
            >
              Add Expense
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

function todayISO(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
