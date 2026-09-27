import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  UserRound,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Plus,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  Tag,
  CreditCard,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Person, Transaction } from '../types/index.js';
import { formatDate, formatINR } from '../utils/format.js';
import { Card, CardTitle } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { TransactionDrawer } from '../features/transactions/TransactionDrawer.js';
import { TransactionModal } from '../features/transactions/TransactionModal.js';
import { toast } from '../components/ui/Toast.js';

interface CategoryStat {
  id: string;
  name: string;
  count: number;
  total: number;
}

interface PersonDetailsResponse {
  person: Person;
  transactions: Transaction[];
  totalSent: number;
  totalReceived: number;
  totalAmount: number;
  netAmount: number;
  transactionCount: number;
  categories: CategoryStat[];
}

export const PeoplePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Directory State
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'has_vpa' | 'sent' | 'received'>('all');

  // Details State
  const [details, setDetails] = useState<PersonDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formVpa, setFormVpa] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirmation State
  const [personToDelete, setPersonToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy Feedback State
  const [copiedVpa, setCopiedVpa] = useState<string | null>(null);

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedVpa(text);
    setTimeout(() => setCopiedVpa(null), 2000);
  };

  const loadPeople = async () => {
    try {
      setLoading(true);
      const response = await api.get('/people');
      setPeople(response.data.data.people || []);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPersonDetails = async (personId: string) => {
    try {
      setDetailsLoading(true);
      const params: Record<string, string> = {};
      if (txSearch.trim()) params.search = txSearch.trim();
      if (txTypeFilter !== 'all') params.type = txTypeFilter;
      if (selectedCategory !== 'all') params.categoryId = selectedCategory;

      const response = await api.get(`/people/${personId}`, { params });
      setDetails(response.data.data);
    } catch {
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      loadPeople();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadPersonDetails(id);
    }
  }, [id, txSearch, txTypeFilter, selectedCategory]);

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingPersonId(null);
    setFormName('');
    setFormVpa('');
    setFormEmail('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (person: Person, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditMode(true);
    setEditingPersonId(person._id);
    setFormName(person.name);
    setFormVpa(person.vpa || '');
    setFormEmail(person.email || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Please enter a name for the person.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');

      if (isEditMode && editingPersonId) {
        await api.patch(`/people/${editingPersonId}`, {
          name: formName.trim(),
          vpa: formVpa.trim() || null,
          email: formEmail.trim() || null,
        });
        toast.success(`Updated details for "${formName.trim()}"`);
        if (id === editingPersonId) {
          await loadPersonDetails(editingPersonId);
        }
      } else {
        await api.post('/people', {
          name: formName.trim(),
          vpa: formVpa.trim() || undefined,
          email: formEmail.trim() || undefined,
        });
        toast.success(`Added "${formName.trim()}" to directory`);
      }

      setIsModalOpen(false);
      loadPeople();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save person. Please try again.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeletePerson = (personId: string, personName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPersonToDelete({ id: personId, name: personName });
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/people/${personToDelete.id}`);
      toast.success(`"${personToDelete.name}" removed from directory`);
      const deletedId = personToDelete.id;
      setPersonToDelete(null);
      setIsModalOpen(false);

      if (id === deletedId) {
        navigate('/people');
      } else {
        setPeople((prev) => prev.filter((p) => p._id !== deletedId));
        loadPeople();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete person.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered people for directory list
  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.vpa && p.vpa.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterType === 'has_vpa') return !!p.vpa;
      if (filterType === 'sent') return (p.totalSent || 0) > 0;
      if (filterType === 'received') return (p.totalReceived || 0) > 0;

      return true;
    });
  }, [people, searchQuery, filterType]);

  // Overall directory metrics
  const totalVolume = useMemo(() => people.reduce((sum, p) => sum + (p.totalAmount || 0), 0), [people]);
  const totalSentAll = useMemo(() => people.reduce((sum, p) => sum + (p.totalSent || 0), 0), [people]);
  const totalReceivedAll = useMemo(() => people.reduce((sum, p) => sum + (p.totalReceived || 0), 0), [people]);

  // Helper for initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper for gradient avatar
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-cyan-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-violet-500 to-fuchsia-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  // =========================================================================
  // COMMON PERSON MODALS (Edit & Delete Confirmation)
  // =========================================================================
  const renderPersonModals = () => (
    <>
      {/* Create / Edit Person Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? 'Edit Person Details' : 'Add Person Manually'}
        description={
          isEditMode
            ? 'Update the payee identity details and VPA handle.'
            : 'Create a new contact in your People directory to link transactions.'
        }
      >
        <form onSubmit={handleSavePerson} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Person / Payee Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. ABIRAMI P"
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Normalized automatically for duplicate prevention (e.g. ABIRAMI P, Abirami P).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Virtual Payment Address (VPA / UPI ID)
            </label>
            <input
              type="text"
              value={formVpa}
              onChange={(e) => setFormVpa(e.target.value)}
              placeholder="e.g. 8489906290@yapl"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Primary identity key used by Email Sync to automatically associate future transactions.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="e.g. abirami@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {isEditMode && editingPersonId ? (
              <Button
                type="button"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs px-2.5"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setIsModalOpen(false);
                  handleDeletePerson(editingPersonId, formName);
                }}
              >
                Delete Person
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={formSubmitting}>
                {isEditMode ? 'Update Person' : 'Save Person'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {personToDelete && (
        <Modal
          isOpen={true}
          onClose={() => !isDeleting && setPersonToDelete(null)}
          title="Remove Person"
          description="Are you sure you want to remove this person from your directory?"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Removing <strong className="text-slate-900 dark:text-white font-bold">"{personToDelete.name}"</strong> will remove their profile from your directory. All associated financial transactions will remain safely in your ledger.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPersonToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white border-transparent"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                isLoading={isDeleting}
                onClick={handleConfirmDelete}
              >
                Yes, Remove
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );

  // =========================================================================
  // VIEW 1: PERSON DETAILS PAGE (/people/:id)
  // =========================================================================
  if (id) {
    if (detailsLoading && !details) {
      return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      );
    }

    if (!details) {
      return (
        <div className="max-w-4xl mx-auto text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto">
            <UserRound className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Person Not Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This person profile may have been removed or has no associated transactions.
          </p>
          <Link to="/people">
            <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to People
            </Button>
          </Link>
        </div>
      );
    }

    const { person, transactions, totalSent, totalReceived, netAmount, transactionCount, categories } = details;

    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/people"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to People Directory
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => handleOpenEditModal(person)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDeletePerson(person._id, person.name)}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Profile Hero Card */}
        <Card className="relative overflow-hidden border-brand-100 dark:border-brand-900/40 bg-gradient-to-br from-white via-white to-brand-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                  person.name
                )} flex items-center justify-center text-white font-extrabold text-2xl sm:text-3xl shadow-md flex-shrink-0`}
              >
                {getInitials(person.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                    {person.name}
                  </h1>
                  <Badge variant="blue" size="sm">
                    Verified Payee
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {person.vpa ? (
                    <button
                      onClick={() => copyToClipboard(person.vpa!)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                      title="Click to copy VPA"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>{person.vpa}</span>
                      {copiedVpa === person.vpa ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No VPA registered</span>
                  )}

                  {person.email && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {person.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
                Net Balance Position
              </span>
              <div
                className={`text-2xl sm:text-3xl font-black mt-1 ${
                  netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {netAmount > 0 ? '+' : ''}
                {formatINR(netAmount)}
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">
                {netAmount >= 0 ? 'Net Received from Person' : 'Net Sent to Person'}
              </span>
            </div>
          </div>
        </Card>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Sent</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
              {formatINR(totalSent)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Expenses paid to {person.name}</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Received</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              {formatINR(totalReceived)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Credits from {person.name}</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Transactions</span>
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
              {transactionCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total transactions logged</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Categories</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
              {categories.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Distinct spending categories</p>
          </Card>
        </div>

        {/* Category Breakdown Chips */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Category Distribution (Click to filter)
              </span>
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Clear Category Filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400'
                }`}
              >
                All ({transactionCount})
              </button>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {formatINR(cat.total)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Transactions Ledger */}
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle className="text-lg">Transaction History</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing {transactions.length} transactions with {person.name}
              </p>
            </div>

            {/* Filters: Search & Type */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search note, UTR, ref..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  onClick={() => setTxTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    txTypeFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTxTypeFilter('expense')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    txTypeFilter === 'expense'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sent
                </button>
                <button
                  onClick={() => setTxTypeFilter('income')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    txTypeFilter === 'income'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Received
                </button>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {transactions.map((tx) => {
              const isExpense = tx.type === 'expense';
              const cat = typeof tx.categoryId === 'object' && tx.categoryId !== null ? tx.categoryId : null;

              return (
                <div
                  key={tx._id}
                  onClick={() => setSelectedTx(tx)}
                  className="py-3.5 px-2 -mx-2 rounded-xl flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isExpense
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {tx.notes || tx.description || tx.merchant}
                        </span>
                        {tx.source === 'email' && (
                          <span
                            title="Synced from Email"
                            className="inline-flex items-center text-[10px] text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 px-1.5 py-0.5 rounded"
                          >
                            <Mail className="w-2.5 h-2.5 mr-1" />
                            Email Sync
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(tx.transactionDate, 'dd MMM yyyy, h:mm a')}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {cat?.name || 'Uncategorized'}
                        </span>
                        {tx.externalTransactionId && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              Ref: {tx.externalTransactionId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div
                      className={`text-sm sm:text-base font-black ${
                        isExpense ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatINR(tx.amount)}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                      {tx.paymentMethod}
                    </span>
                  </div>
                </div>
              );
            })}

            {transactions.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <Search className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  No matching transactions found
                </p>
                <p className="text-xs text-slate-400">Try adjusting your search keyword or filters.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Transaction Drawer Modal */}
        <TransactionDrawer
          isOpen={!!selectedTx}
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onDelete={() => {
            setSelectedTx(null);
            loadPersonDetails(id);
          }}
          onEdit={(tx) => {
            setSelectedTx(null);
            setEditingTx(tx);
          }}
        />

        {/* Edit Transaction Modal */}
        {editingTx && (
          <TransactionModal
            isOpen={true}
            transaction={editingTx}
            onClose={() => setEditingTx(null)}
            onSuccess={() => {
              setEditingTx(null);
              loadPersonDetails(id);
            }}
          />
        )}

        {/* Common Person Modals */}
        {renderPersonModals()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PEOPLE DIRECTORY MAIN PAGE (/people)
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              People & Payees
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              <Sparkles className="w-3 h-3 text-brand-600 dark:text-brand-400" />
              Smart Matching
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Payees and contacts automatically extracted from your parsed emails and UPI transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleOpenCreateModal}
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Person
          </Button>
        </div>
      </div>

      {/* Aggregate KPI Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-slate-400">People Detected</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {people.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Identified contacts</span>
        </Card>

        <Card className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-slate-400">Total Transacted</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatINR(totalVolume)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Sent & received combined</span>
        </Card>

        <Card className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-slate-400">Money Sent</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatINR(totalSentAll)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Total payments outgoing</span>
        </Card>

        <Card className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-slate-400">Money Received</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatINR(totalReceivedAll)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Total incoming credits</span>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by person name, VPA (e.g. yapl), or email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterType === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            All People ({people.length})
          </button>
          <button
            onClick={() => setFilterType('has_vpa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterType === 'has_vpa'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            Has VPA
          </button>
          <button
            onClick={() => setFilterType('sent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterType === 'sent'
                ? 'bg-rose-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            Sent Only
          </button>
          <button
            onClick={() => setFilterType('received')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterType === 'received'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            Received
          </button>
        </div>
      </div>

      {/* People Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPeople.map((person) => {
            const hasReceived = (person.totalReceived || 0) > 0;

            return (
              <div
                key={person._id}
                onClick={() => navigate(`/people/${person._id}`)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 rounded-2xl p-5 shadow-xs hover:shadow-premium transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Card Header: Avatar, Name, VPA */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                          person.name
                        )} flex items-center justify-center text-white font-extrabold text-base shadow-xs flex-shrink-0`}
                      >
                        {getInitials(person.name)}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-600 transition-colors">
                          {person.name}
                        </CardTitle>
                        {person.vpa ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <button
                              onClick={(e) => copyToClipboard(person.vpa!, e)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                              title="Copy VPA"
                            >
                              <span>{person.vpa}</span>
                              {copiedVpa === person.vpa ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 truncate mt-1">
                            {person.email || 'No VPA recorded'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenEditModal(person, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit person"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePerson(person._id, person.name, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete person"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 2x2 Metric Grid (Matches User Specifications) */}
                  <div className="grid grid-cols-2 gap-2.5 mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                    <div>
                      <span className="block text-slate-400 font-medium text-[11px]">Transactions</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {person.transactionCount || 0}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-400 font-medium text-[11px]">Total Sent</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {formatINR(person.totalSent || 0)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-400 font-medium text-[11px]">Last Transaction</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {person.lastTransactionDate
                          ? formatDate(person.lastTransactionDate, 'dd MMM yyyy')
                          : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-400 font-medium text-[11px]">
                        {hasReceived ? 'Total Received' : 'Total Amount'}
                      </span>
                      <span
                        className={`font-bold ${
                          hasReceived
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {hasReceived
                          ? formatINR(person.totalReceived || 0)
                          : formatINR(person.totalAmount || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Recent Transactions List (Requirement: Show recent transactions) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Recent Activity
                    </span>

                    {person.recentTransactions && person.recentTransactions.length > 0 ? (
                      <div className="space-y-1.5">
                        {person.recentTransactions.slice(0, 3).map((tx) => (
                          <div
                            key={tx._id}
                            className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  tx.type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                              />
                              <span className="text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                                {tx.notes || tx.merchant}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDate(tx.transactionDate, 'dd MMM')}
                              </span>
                            </div>
                            <span
                              className={`font-semibold text-xs ${
                                tx.type === 'expense' ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-600'
                              }`}
                            >
                              {tx.type === 'expense' ? '-' : '+'}
                              {formatINR(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-1">No recorded transactions</p>
                    )}
                  </div>
                </div>

                {/* Footer link */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:text-brand-700">
                  <span>View All Transactions</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}

          {filteredPeople.length === 0 && (
            <div className="col-span-full py-16 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {searchQuery ? 'No People Match Your Search' : 'No People Detected Yet'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Try checking for typos or searching with a different name or VPA.'
                    : 'People appear automatically when an email transaction contains a payee name or VPA (e.g. towards VPA 8489906290@yapl (ABIRAMI P)).'}
                </p>
              </div>
              <Button onClick={handleOpenCreateModal} size="sm">
                Add Person Manually
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Common Person Modals */}
      {renderPersonModals()}
    </div>
  );
};
