import { Types } from 'mongoose';
import { PersonModel } from '../models/Person.js';
import { TransactionModel } from '../models/Transaction.js';
import { IPerson, ITransaction } from '../types/index.js';

export function normalizePersonName(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .toLowerCase();
}

const BUSINESS_KEYWORDS = [
  'pvt', 'ltd', 'limited', 'inc', 'corp', 'corporation', 'enterprise', 'enterprises',
  'store', 'shop', 'mart', 'bazaar', 'agency', 'foods', 'food', 'snacks', 'pharmacy',
  'fuel', 'hospital', 'hotel', 'bakery', 'restaurant', 'cafe', 'coffee', 'tea', 'sweets', 'supermarket',
  'cinema', 'cinemas', 'theatre', 'broadband', 'telecom', 'electricity', 'board',
  'technologies', 'solutions', 'bank', 'insurance', 'petrol', 'pump', 'bunk', 'hpcl', 'bpcl', 'iocl', 'airtel',
  'jio', 'vodafone', 'swiggy', 'zomato', 'amazon', 'flipkart', 'uber', 'ola',
  'blinkit', 'zepto', 'netflix', 'spotify', 'cult.fit', 'pvr', 'tneb', 'bsnl',
  'irctc', 'makemytrip', 'myntra', 'nykaa', 'paytm', 'phonepe', 'google pay', 'starbucks',
  'fastag', 'bhim', 'tatasky', 'dth', 'recharge', 'utility', 'utilities', 'bill'
];

const GENERIC_LABELS = [
  'bank transaction', 'upi payee', 'upi transaction', 'salary credit',
  'interest credit', 'atm withdrawal', 'pos purchase', 'self transfer',
  'unknown merchant', 'payment to', 'debit transaction', 'credit transaction'
];

export function isIdentifiablePerson(merchant: string, vpa?: string, email?: string): boolean {
  if (!merchant || !merchant.trim()) return false;
  const cleanMerchant = merchant.trim();
  const lowerMerchant = cleanMerchant.toLowerCase();

  // If generic non-payee label, not a person
  if (GENERIC_LABELS.some((g) => lowerMerchant === g || lowerMerchant.startsWith(g))) {
    return false;
  }

  // If contains commercial/business indicators, not a person
  const hasBusinessKeyword = BUSINESS_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(lowerMerchant);
  });
  if (hasBusinessKeyword) {
    return false;
  }

  // 1. Check if VPA is a personal VPA:
  // e.g. 10-digit phone VPA: 8489906290@yapl, 9876543210@paytm
  // or personal handles: name@oksbi, name@okaxis, etc.
  if (vpa) {
    const cleanVpa = vpa.trim().toLowerCase();
    const isPhoneVpa = /^\d{10}@[a-zA-Z0-9.-]+/i.test(cleanVpa);
    const isPersonalHandle = /^[a-z0-9._-]+@(okaxis|oksbi|okicici|okhdfcbank|yapl|apl|paytm|upi|ibl|axisbank|barodampay|icici|federal)$/i.test(cleanVpa);
    if (isPhoneVpa || isPersonalHandle) {
      return true;
    }
  }

  // 2. Check if merchant is formatted like a person's name with an initial:
  // e.g., "ABIRAMI P", "Abirami P", "KUMAR S", "PRIYA R", "SATHISH K", "P ABIRAMI", "M. BOOBAL"
  const isPersonInitialName =
    /^[A-Za-z]{2,20}(\s+[A-Za-z]{2,20})*\s+[A-Za-z](\.?)$/i.test(cleanMerchant) ||
    /^[A-Za-z](\.?)\s+[A-Za-z]{2,20}/i.test(cleanMerchant);
  if (isPersonInitialName) {
    return true;
  }

  // 3. Single name or 1 to 4 words, all alphabetic characters (e.g., "BOOBAL", "ABIRAMI", "Rahul Verma", "Priya Sharma")
  const words = cleanMerchant.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 4) {
    const allAlphaWords = words.every((w) => /^[A-Za-z.-]+$/.test(w));
    if (allAlphaWords && cleanMerchant.length >= 2 && cleanMerchant.length <= 40) {
      return true;
    }
  }

  return false;
}

export class PersonService {
  /**
   * Find an existing person using priority:
   * 1. VPA
   * 2. Email address, if available
   * 3. Normalized person/payee name
   *
   * If not found, creates a new Person.
   */
  async findOrCreate(
    userId: string,
    input: { name: string; vpa?: string; email?: string },
    options?: { isManual?: boolean }
  ): Promise<IPerson | null> {
    const name = input.name?.trim();
    if (!name) return null;

    const vpa = input.vpa?.trim().toLowerCase() || undefined;
    const email = input.email?.trim().toLowerCase() || undefined;
    const userObjectId = new Types.ObjectId(userId);
    const normalized = normalizePersonName(name);

    // Matching priority:
    // 1. VPA
    let person = vpa ? await PersonModel.findOne({ userId: userObjectId, vpa }).lean() : null;

    // 2. Email address, if available
    if (!person && email) {
      person = await PersonModel.findOne({ userId: userObjectId, email }).lean();
    }

    // 3. Normalized person/payee name
    if (!person) {
      person = await PersonModel.findOne({ userId: userObjectId, normalizedName: normalized }).lean();
    }

    // If existing person found
    if (person) {
      if (person.isDeleted) {
        if (!options?.isManual) {
          // If auto-linking from email sync, do NOT restore a deleted person
          return null;
        }
        // If manually creating/re-adding, reactivate the person
        const restoreUpdates: any = { isDeleted: false, name, normalizedName: normalized };
        if (vpa) restoreUpdates.vpa = vpa;
        if (email) restoreUpdates.email = email;
        await PersonModel.updateOne({ _id: person._id }, { $set: restoreUpdates });
        return { ...person, ...restoreUpdates };
      }

      // Existing active person: update any missing VPA or email
      const updates: Partial<IPerson> = {};
      if (vpa && !person.vpa) updates.vpa = vpa;
      if (email && !person.email) updates.email = email;
      if (Object.keys(updates).length > 0) {
        await PersonModel.updateOne({ _id: person._id }, { $set: updates });
        person = { ...person, ...updates };
      }
      return person;
    }

    // Create new Person
    try {
      const docData: Record<string, unknown> = {
        userId: userObjectId,
        name,
        normalizedName: normalized,
        isDeleted: false,
      };
      if (vpa) docData.vpa = vpa;
      if (email) docData.email = email;

      const created = await PersonModel.create(docData);
      return created.toObject();
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      // Concurrent creation conflict fallback:
      return PersonModel.findOne({
        userId: userObjectId,
        ...(vpa ? { vpa } : email ? { email } : { normalizedName: normalized }),
      }).lean();
    }
  }

  /**
   * Identifies if incoming transaction data refers to a person.
   * If it does, finds or creates the person; if not, returns null.
   */
  async identifyAndLinkPerson(
    userId: string,
    data: { merchant: string; vpa?: string; email?: string }
  ): Promise<IPerson | null> {
    const userObjectId = new Types.ObjectId(userId);
    const vpa = data.vpa?.trim().toLowerCase() || undefined;
    const email = data.email?.trim().toLowerCase() || undefined;
    const name = data.merchant?.trim();

    if (!name) return null;

    // Check if person already exists in user's people directory
    let existingPerson = vpa ? await PersonModel.findOne({ userId: userObjectId, vpa }).lean() : null;
    if (!existingPerson && email) existingPerson = await PersonModel.findOne({ userId: userObjectId, email }).lean();
    if (!existingPerson) existingPerson = await PersonModel.findOne({ userId: userObjectId, normalizedName: normalizePersonName(name) }).lean();

    if (existingPerson) {
      if (existingPerson.isDeleted) {
        // If this person was deleted by user, do not link or recreate
        return null;
      }
      return this.findOrCreate(userId, { name, vpa, email }, { isManual: false });
    }

    // If not existing, test if transaction data identifies a person
    if (isIdentifiablePerson(name, vpa, email)) {
      return this.findOrCreate(userId, { name, vpa, email }, { isManual: false });
    }

    // Unknown person / merchant -> return null
    return null;
  }

  /**
   * Scan existing confirmed email transactions without personId and link where identifiable.
   */
  async linkExistingTransactions(userId: string): Promise<number> {
    const userObjectId = new Types.ObjectId(userId);
    const unlinked = await TransactionModel.find({
      userId: userObjectId,
      source: 'email',
      personId: null,
      'metadata.ignoreAutoPersonLink': { $ne: true },
    }).lean();

    let linkedCount = 0;
    for (const tx of unlinked) {
      const vpa = tx.vpa || (typeof tx.metadata?.vpa === 'string' ? tx.metadata.vpa : undefined);
      const person = await this.identifyAndLinkPerson(userId, {
        merchant: tx.merchant,
        vpa,
      });

      if (person) {
        await TransactionModel.updateOne(
          { _id: tx._id },
          {
            $set: {
              personId: new Types.ObjectId(person._id),
              vpa: tx.vpa || person.vpa || null,
            },
          }
        );
        linkedCount++;
      }
    }

    return linkedCount;
  }

  /**
   * List all detected people with aggregate stats and recent transactions.
   * Accepts optional options: { favoriteOnly?: boolean; isFavorite?: boolean }
   */
  async list(
    userId: string,
    options?: { favoriteOnly?: boolean; isFavorite?: boolean }
  ) {
    const userObjectId = new Types.ObjectId(userId);

    // Auto-link any newly synced transactions
    try {
      await this.linkExistingTransactions(userId);
    } catch (_) {}

    const peopleWithStats = await PersonModel.aggregate([
      {
        $match: {
          userId: userObjectId,
          isDeleted: { $ne: true },
          ...(options?.favoriteOnly ? { isFavorite: true } : {}),
        },
      },
      {
        $lookup: {
          from: 'transactions',
          localField: '_id',
          foreignField: 'personId',
          as: 'transactions',
        },
      },
      {
        $project: {
          name: 1,
          normalizedName: 1,
          vpa: 1,
          email: 1,
          isFavorite: 1,
          createdAt: 1,
          updatedAt: 1,
          transactionCount: { $size: '$transactions' },
          totalSent: {
            $sum: {
              $map: {
                input: '$transactions',
                as: 'tx',
                in: { $cond: [{ $eq: ['$$tx.type', 'expense'] }, '$$tx.amount', 0] },
              },
            },
          },
          totalReceived: {
            $sum: {
              $map: {
                input: '$transactions',
                as: 'tx',
                in: { $cond: [{ $eq: ['$$tx.type', 'income'] }, '$$tx.amount', 0] },
              },
            },
          },
          totalAmount: { $sum: '$transactions.amount' },
          lastTransactionDate: { $max: '$transactions.transactionDate' },
          recentTransactions: {
            $slice: [
              {
                $map: {
                  input: {
                    $sortArray: {
                      input: '$transactions',
                      sortBy: { transactionDate: -1 },
                    },
                  },
                  as: 'tx',
                  in: {
                    _id: '$$tx._id',
                    amount: '$$tx.amount',
                    type: '$$tx.type',
                    merchant: '$$tx.merchant',
                    transactionDate: '$$tx.transactionDate',
                    paymentMethod: '$$tx.paymentMethod',
                    notes: '$$tx.notes',
                  },
                },
              },
              3,
            ],
          },
        },
      },
       { $sort: { isFavorite: -1, lastTransactionDate: -1, name: 1 } },
    ]);

    return peopleWithStats;
  }

  /**
   * Get person details with transactions, totals, and category breakdown.
   */
  async details(
    userId: string,
    personId: string,
    options?: { search?: string; type?: string; categoryId?: string }
  ) {
    const person = await PersonModel.findOne({ _id: personId, userId, isDeleted: { $ne: true } }).lean();
    if (!person) return null;

    const baseMatch: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      personId: new Types.ObjectId(personId),
    };

    // All transactions for this person (for overall totals and categories)
    const allPersonTransactions = await TransactionModel.find(baseMatch)
      .populate('categoryId')
      .lean();

    const totalSent = allPersonTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalReceived = allPersonTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalAmount = allPersonTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Compute category breakdown
    const categoryMap = new Map<string, { id: string; name: string; icon?: string; color?: string; count: number; total: number }>();
    for (const tx of allPersonTransactions) {
      const cat = typeof tx.categoryId === 'object' && tx.categoryId !== null ? (tx.categoryId as any) : null;
      const catId = cat ? String(cat._id) : 'uncategorized';
      const catName = cat?.name || 'Uncategorized';
      const existing = categoryMap.get(catId) || {
        id: catId,
        name: catName,
        icon: cat?.icon,
        color: cat?.color,
        count: 0,
        total: 0,
      };
      existing.count += 1;
      existing.total += tx.amount;
      categoryMap.set(catId, existing);
    }
    const categories = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

    // Filtered transaction list for display
    const filterMatch: Record<string, unknown> = { ...baseMatch };
    if (options?.type && ['expense', 'income', 'transfer'].includes(options.type)) {
      filterMatch.type = options.type;
    }
    if (options?.categoryId) {
      filterMatch.categoryId = options.categoryId === 'uncategorized' ? null : new Types.ObjectId(options.categoryId);
    }
    if (options?.search?.trim()) {
      const searchRegex = { $regex: options.search.trim(), $options: 'i' };
      filterMatch.$or = [
        { merchant: searchRegex },
        { description: searchRegex },
        { notes: searchRegex },
        { externalTransactionId: searchRegex },
        { vpa: searchRegex },
      ];
    }

    const filteredTransactions = await TransactionModel.find(filterMatch)
      .sort({ transactionDate: -1 })
      .populate('categoryId')
      .lean();

    return {
      person,
      transactions: filteredTransactions,
      totalSent,
      totalReceived,
      totalAmount,
      netAmount: totalReceived - totalSent,
      transactionCount: allPersonTransactions.length,
      categories,
    };
  }

  /**
   * Update person name, VPA, email, or favorite status.
   */
  async update(
    userId: string,
    personId: string,
    input: { name?: string; vpa?: string | null; email?: string | null; isFavorite?: boolean }
  ): Promise<IPerson | null> {
    if (!personId) return null;

    let person = null;
    if (Types.ObjectId.isValid(personId)) {
      person = await PersonModel.findById(personId);
    }
    if (!person) {
      person = await PersonModel.findOne({ _id: personId });
    }
    if (!person) return null;

    if (person.userId && person.userId.toString() !== userId.toString()) {
      return null;
    }

    const setOps: any = {};
    const unsetOps: any = {};

    if (input.name !== undefined && input.name.trim()) {
      setOps.name = input.name.trim();
      setOps.normalizedName = normalizePersonName(input.name);

      // Check if another person already has this normalized name
      const existingName = await PersonModel.findOne({
        userId: person.userId,
        normalizedName: setOps.normalizedName,
        _id: { $ne: person._id },
      });
      if (existingName) {
        throw new Error(`Another person named "${existingName.name}" already exists in your directory`);
      }
    }

    if (input.vpa !== undefined) {
      const trimmedVpa = input.vpa ? input.vpa.trim().toLowerCase() : '';
      if (trimmedVpa) {
        setOps.vpa = trimmedVpa;
        // Check if another person already has this VPA
        const existingVpa = await PersonModel.findOne({
          userId: person.userId,
          vpa: trimmedVpa,
          _id: { $ne: person._id },
        });
        if (existingVpa) {
          throw new Error(`Another person (${existingVpa.name}) already has the VPA "${trimmedVpa}"`);
        }
      } else {
        unsetOps.vpa = 1;
      }
    }

     if (input.email !== undefined) {
       const trimmedEmail = input.email ? input.email.trim().toLowerCase() : '';
       if (trimmedEmail) {
         setOps.email = trimmedEmail;
       } else {
         unsetOps.email = 1;
       }
     }

     if (input.isFavorite !== undefined) {
       setOps.isFavorite = input.isFavorite;
     }

    const updateOps: any = {};
    if (Object.keys(setOps).length > 0) updateOps.$set = setOps;
    if (Object.keys(unsetOps).length > 0) updateOps.$unset = unsetOps;

    if (Object.keys(updateOps).length > 0) {
      await PersonModel.updateOne({ _id: person._id }, updateOps);
    }

    const updated = await PersonModel.findById(person._id).lean();

    if (updated && (setOps.name || setOps.vpa)) {
      const txUpdates: any = {};
      if (setOps.name) txUpdates['metadata.personName'] = setOps.name;
      if (setOps.vpa) txUpdates.vpa = setOps.vpa;
      await TransactionModel.updateMany(
        { personId: person._id },
        { $set: txUpdates }
      );
    }

    return updated;
  }

  /**
   * Delete person and unlink associated transactions.
   */
  async delete(userId: string, personId: string): Promise<boolean> {
    if (!personId) return false;

    // Look up person by id (supports both ObjectId and string representation)
    let person = null;
    if (Types.ObjectId.isValid(personId)) {
      person = await PersonModel.findById(personId);
    }
    if (!person) {
      person = await PersonModel.findOne({ _id: personId });
    }
    if (!person) {
      return false;
    }

    // Verify ownership
    if (person.userId && person.userId.toString() !== userId.toString()) {
      return false;
    }

    // Unlink transactions associated with this person and mark to prevent auto-relinking
    await TransactionModel.updateMany(
      { personId: person._id },
      { $set: { personId: null, 'metadata.ignoreAutoPersonLink': true } }
    );

    // Soft delete to prevent future email syncs from resurrecting this deleted person
    await PersonModel.updateOne({ _id: person._id }, { $set: { isDeleted: true } });
    return true;
  }

  /**
   * Manually assign or unassign a transaction to a person.
   */
  async assignTransaction(userId: string, transactionId: string, personId: string | null) {
    let person: IPerson | null = null;
    if (personId) {
      person = await PersonModel.findOne({ _id: personId, userId }).lean();
      if (!person) return null;
    }

    const updateFields: Record<string, unknown> = {
      personId: person ? new Types.ObjectId(person._id) : null,
    };
    if (person?.vpa) {
      updateFields.vpa = person.vpa;
    }

    return TransactionModel.findOneAndUpdate(
      { _id: transactionId, userId },
      { $set: updateFields },
      { new: true }
    )
       .populate('categoryId')
      .populate('personId')
      .lean();
  }

  /**
   * Toggle favorite status for a person.
   */
  async toggleFavorite(userId: string, personId: string): Promise<IPerson | null> {
    if (!personId) return null;

    let person = null;
    if (Types.ObjectId.isValid(personId)) {
      person = await PersonModel.findById(personId);
    }
    if (!person) {
      person = await PersonModel.findOne({ _id: personId });
    }
    if (!person) return null;

    if (person.userId && person.userId.toString() !== userId.toString()) {
      return null;
    }

    const updated = await PersonModel.findByIdAndUpdate(
      person._id,
      { $set: { isFavorite: !person.isFavorite } },
      { new: true }
    ).lean();

    return updated;
  }
}

export const personService = new PersonService();
