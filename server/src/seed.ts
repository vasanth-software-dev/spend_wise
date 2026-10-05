import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { UserModel } from './models/User.js';
import { CategoryModel } from './models/Category.js';
import { TransactionModel } from './models/Transaction.js';
import { BudgetModel } from './models/Budget.js';
import { RecurringTransactionModel } from './models/RecurringTransaction.js';
import { GoalModel, GoalContributionModel } from './models/Goal.js';
import { EmailAccountModel } from './models/EmailAccount.js';
import { DetectedTransactionModel } from './models/DetectedTransaction.js';
import { NotificationModel } from './models/Notification.js';
import { PersonModel } from './models/Person.js';
import { AccountModel } from './models/Account.js';
import { hashPassword } from './utils/hash.js';
import { categoryRepository, DEFAULT_SYSTEM_CATEGORIES } from './repositories/CategoryRepository.js';
import { normalizePersonName } from './services/PersonService.js';

async function seed() {
  console.log('🌱 Starting SpendWise Enterprise Data Seeder...');
  await connectDatabase();

  // Clear existing collections
  console.log('🧹 Cleaning old data...');
  await Promise.all([
    UserModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    TransactionModel.deleteMany({}),
    BudgetModel.deleteMany({}),
    RecurringTransactionModel.deleteMany({}),
    EmailAccountModel.deleteMany({}),
    DetectedTransactionModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    PersonModel.deleteMany({}),
    GoalModel.deleteMany({}),
    GoalContributionModel.deleteMany({}),
    AccountModel.deleteMany({}),
  ]);

  try {
    await PersonModel.syncIndexes();
  } catch (_) {}

  // Ensure Default Categories
  console.log('📁 Populating default categories...');
  await categoryRepository.ensureDefaultCategories();
  const categories = await CategoryModel.find({ userId: null });
  const catMap = new Map<string, Types.ObjectId>();
  categories.forEach((c) => catMap.set(c.name, c._id as Types.ObjectId));

  // Seed 10 Realistic Users
  console.log('👤 Seeding 10 users...');
  const defaultPasswordHash = await hashPassword('SpendWise@123');

  const usersData = [
    { name: 'Vasanth Kumar', email: 'vasanth@spendwise.dev' },
    { name: 'Priya Sharma', email: 'priya@spendwise.dev' },
    { name: 'Rahul Verma', email: 'rahul@spendwise.dev' },
    { name: 'Ananya Iyer', email: 'ananya@spendwise.dev' },
    { name: 'Rohan Gupta', email: 'rohan@spendwise.dev' },
    { name: 'Sneha Patel', email: 'sneha@spendwise.dev' },
    { name: 'Vikram Malhotra', email: 'vikram@spendwise.dev' },
    { name: 'Divya Nair', email: 'divya@spendwise.dev' },
    { name: 'Aditya Rao', email: 'aditya@spendwise.dev' },
    { name: 'Meera Deshmukh', email: 'meera@spendwise.dev' },
  ];

  const createdUsers = [];
  for (const u of usersData) {
    const user = await UserModel.create({
      name: u.name,
      email: u.email,
      passwordHash: defaultPasswordHash,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      isEmailVerified: true,
    });
    createdUsers.push(user);
  }

  const primaryUser = createdUsers[0];
  console.log(`✨ Primary Demo User: ${primaryUser.email} (Password: SpendWise@123)`);

  // Seed Email Accounts for Primary User (Requirement 3: Multiple email accounts per user)
  console.log('📧 Setting up Email Accounts...');
  const primaryGmail = await EmailAccountModel.create({
    userId: primaryUser._id,
    provider: 'gmail',
    email: 'vasanth.personal@gmail.com',
    status: 'active',
    lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
    detectedCount: 14,
    syncFrequencyMinutes: 30,
  });

  const workGmail = await EmailAccountModel.create({
    userId: primaryUser._id,
    provider: 'mock',
    email: 'vasanth.work@company.com',
    status: 'active',
    lastSyncAt: new Date(Date.now() - 45 * 60 * 1000),
    detectedCount: 6,
    syncFrequencyMinutes: 60,
  });

  const secondaryGmail = await EmailAccountModel.create({
    userId: primaryUser._id,
    provider: 'mock',
    email: 'vasanth.finance@gmail.com',
    status: 'paused',
    lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    detectedCount: 4,
    syncFrequencyMinutes: 120,
  });

  // Seed Financial Accounts for Primary User (Section 22 & 47)
  console.log('🏦 Setting up Financial Accounts & Net Worth...');
  await AccountModel.create([
    {
      userId: primaryUser._id,
      name: 'HDFC Salary Account',
      type: 'bank',
      balance: 42850,
      currency: 'INR',
      institutionName: 'HDFC Bank',
      accountNumberMasked: '•••• 7079',
      color: '#0ea5e9',
      isDefault: true,
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'SBI Credit Card',
      type: 'credit_card',
      balance: -8420,
      currency: 'INR',
      institutionName: 'SBI Cards',
      accountNumberMasked: '•••• 5678',
      color: '#f43f5e',
      isDefault: false,
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'Cash in Hand',
      type: 'cash',
      balance: 2500,
      currency: 'INR',
      color: '#10b981',
      isDefault: false,
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'Paytm Wallet',
      type: 'wallet',
      balance: 1800,
      currency: 'INR',
      institutionName: 'Paytm Payments Bank',
      color: '#f59e0b',
      isDefault: false,
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'Zerodha Kite Portfolio',
      type: 'investment',
      balance: 85000,
      currency: 'INR',
      institutionName: 'Zerodha Broking',
      color: '#8b5cf6',
      isDefault: false,
      isActive: true,
    },
  ]);

  // Seed Budgets for Primary User
  console.log('🎯 Seeding Budgets...');
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await BudgetModel.create([
    {
      userId: primaryUser._id,
      name: 'Food & Dining Budget',
      amount: 12000,
      categoryId: catMap.get('Food & Dining'),
      period: 'monthly',
      startDate: startOfMonth,
      endDate: endOfMonth,
      notificationThreshold: 80,
    },
    {
      userId: primaryUser._id,
      name: 'Monthly Groceries',
      amount: 8000,
      categoryId: catMap.get('Groceries'),
      period: 'monthly',
      startDate: startOfMonth,
      endDate: endOfMonth,
      notificationThreshold: 85,
    },
    {
      userId: primaryUser._id,
      name: 'Shopping & Leisure',
      amount: 15000,
      categoryId: catMap.get('Shopping'),
      period: 'monthly',
      startDate: startOfMonth,
      endDate: endOfMonth,
      notificationThreshold: 80,
    },
    {
      userId: primaryUser._id,
      name: 'Fuel & Commute',
      amount: 5000,
      categoryId: catMap.get('Fuel'),
      period: 'monthly',
      startDate: startOfMonth,
      endDate: endOfMonth,
      notificationThreshold: 75,
    },
  ]);

  // Seed Recurring Transactions (Requirement 29)
  console.log('🔄 Seeding Recurring Transactions...');
  await RecurringTransactionModel.create([
    {
      userId: primaryUser._id,
      name: 'Apartment Rent',
      amount: 22000,
      type: 'expense',
      categoryId: catMap.get('Rent'),
      merchant: 'Landlord Sharma',
      paymentMethod: 'bank',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'Netflix Premium 4K',
      amount: 649,
      type: 'expense',
      categoryId: catMap.get('Subscriptions'),
      merchant: 'Netflix',
      paymentMethod: 'upi',
      frequency: 'monthly',
      startDate: new Date('2026-01-15'),
      nextDueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow!
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'Nifty 50 Index Fund SIP',
      amount: 15000,
      type: 'expense',
      categoryId: catMap.get('Investments'),
      merchant: 'Zerodha Coin',
      paymentMethod: 'upi',
      frequency: 'monthly',
      startDate: new Date('2026-01-10'),
      nextDueDate: new Date(now.getFullYear(), now.getMonth(), 10),
      isActive: true,
    },
    {
      userId: primaryUser._id,
      name: 'Monthly Salary',
      amount: 125000,
      type: 'income',
      categoryId: catMap.get('Salary'),
      merchant: 'Tech Innovations Pvt Ltd',
      paymentMethod: 'bank',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      isActive: true,
    },
  ]);

  // Seed 100+ Transactions across multiple months
  console.log('💳 Seeding 120+ realistic transactions across 3 months...');
  const txTemplates = [
    { merchant: 'Swiggy', cat: 'Food & Dining', min: 250, max: 850, method: 'upi', notes: 'Dinner order' },
    { merchant: 'Zomato', cat: 'Food & Dining', min: 300, max: 950, method: 'upi', notes: 'Lunch with colleagues' },
    { merchant: 'Starbucks Coffee', cat: 'Food & Dining', min: 350, max: 750, method: 'card', notes: 'Cold brew & pastry' },
    { merchant: 'Blinkit', cat: 'Groceries', min: 250, max: 1200, method: 'upi', notes: 'Daily essentials' },
    { merchant: 'Zepto', cat: 'Groceries', min: 180, max: 800, method: 'upi', notes: 'Quick snacks & fruits' },
    { merchant: 'BigBasket', cat: 'Groceries', min: 1200, max: 3500, method: 'upi', notes: 'Weekly grocery basket' },
    { merchant: 'Amazon India', cat: 'Shopping', min: 599, max: 4999, method: 'upi', notes: 'Electronics & household' },
    { merchant: 'Flipkart', cat: 'Shopping', min: 499, max: 2999, method: 'upi', notes: 'Clothing purchase' },
    { merchant: 'Uber India', cat: 'Transport', min: 120, max: 480, method: 'upi', notes: 'Office cab ride' },
    { merchant: 'Ola Cabs', cat: 'Transport', min: 110, max: 420, method: 'upi', notes: 'Auto ride' },
    { merchant: 'HPCL Petrol Pump', cat: 'Fuel', min: 500, max: 2200, method: 'card', notes: 'Fuel top-up' },
    { merchant: 'Indian Oil Bunk', cat: 'Fuel', min: 600, max: 2000, method: 'upi', notes: 'Petrol full tank' },
    { merchant: 'TNEB Electricity Bill', cat: 'Bills & Utilities', min: 1400, max: 2800, method: 'upi', notes: 'Monthly power bill' },
    { merchant: 'Airtel Broadband', cat: 'Bills & Utilities', min: 999, max: 1199, method: 'upi', notes: 'Fiber internet bill' },
    { merchant: 'Jio Mobile Recharge', cat: 'Bills & Utilities', min: 349, max: 749, method: 'upi', notes: 'Prepaid recharge' },
    { merchant: 'PVR Cinemas', cat: 'Entertainment', min: 600, max: 1800, method: 'card', notes: 'Movie tickets & popcorn' },
    { merchant: 'Apollo Pharmacy', cat: 'Health & Medical', min: 250, max: 1600, method: 'upi', notes: 'Vitamins and medicine' },
    { merchant: 'Cult.fit Gym', cat: 'Health & Medical', min: 1500, max: 2500, method: 'upi', notes: 'Cultpass monthly' },
  ];

  const transactionsToInsert = [];

  // Seed People for Primary User
  console.log('👥 Seeding People & Payees...');
  const abiramiPerson = await PersonModel.create({
    userId: primaryUser._id,
    name: 'ABIRAMI P',
    normalizedName: normalizePersonName('ABIRAMI P'),
    vpa: '8489906290@yapl',
  });

  const priyaPerson = await PersonModel.create({
    userId: primaryUser._id,
    name: 'Priya Sharma',
    normalizedName: normalizePersonName('Priya Sharma'),
    vpa: 'priya.sharma@oksbi',
    email: 'priya@spendwise.dev',
  });

  const landlordPerson = await PersonModel.create({
    userId: primaryUser._id,
    name: 'Landlord Sharma',
    normalizedName: normalizePersonName('Landlord Sharma'),
  });

  const rahulPerson = await PersonModel.create({
    userId: primaryUser._id,
    name: 'Rahul Verma',
    normalizedName: normalizePersonName('Rahul Verma'),
    vpa: 'rahul98@okaxis',
    email: 'rahul@spendwise.dev',
  });

  // Seed exact 12 transactions for ABIRAMI P totaling ₹8,450 (Matches user example)
  const abiramiAmounts = [1, 500, 1200, 450, 1800, 750, 350, 950, 600, 850, 500, 499];
  const abiramiDates = [
    new Date('2026-09-26T14:30:00.000Z'), // Exactly 26 Sep 2026
    new Date('2026-09-24T18:15:00.000Z'),
    new Date('2026-09-20T12:00:00.000Z'),
    new Date('2026-09-17T09:45:00.000Z'),
    new Date('2026-09-12T16:20:00.000Z'),
    new Date('2026-09-08T11:10:00.000Z'),
    new Date('2026-09-02T15:30:00.000Z'),
    new Date('2026-08-28T20:00:00.000Z'),
    new Date('2026-08-21T13:40:00.000Z'),
    new Date('2026-08-15T10:25:00.000Z'),
    new Date('2026-08-08T17:50:00.000Z'),
    new Date('2026-08-01T14:00:00.000Z'),
  ];
  const friendsCat = catMap.get('Friends & Family') || catMap.get('Other') || null;

  for (let i = 0; i < abiramiAmounts.length; i++) {
    const isExampleEmail = i === 0;
    transactionsToInsert.push({
      userId: primaryUser._id,
      type: 'expense',
      amount: abiramiAmounts[i],
      currency: 'INR',
      categoryId: friendsCat,
      merchant: 'ABIRAMI P',
      description: isExampleEmail
        ? 'Rs.1.00 is debited from your account ending 7079 towards VPA 8489906290@yapl (ABIRAMI P)'
        : 'Payment to ABIRAMI P',
      paymentMethod: 'upi',
      source: 'email',
      sourceAccountId: primaryGmail._id,
      personId: abiramiPerson._id,
      vpa: '8489906290@yapl',
      externalTransactionId: isExampleEmail ? '130279331928' : `UPI/${426899130000 + i}`,
      transactionDate: abiramiDates[i],
      notes: isExampleEmail
        ? 'towards VPA 8489906290@yapl (ABIRAMI P)'
        : 'UPI Transfer',
      status: 'confirmed',
      metadata: {
        vpa: '8489906290@yapl',
        personName: 'ABIRAMI P',
      },
    });
  }

  // Transactions with Priya Sharma (Sent + Received)
  transactionsToInsert.push(
    {
      userId: primaryUser._id,
      type: 'expense',
      amount: 1200,
      currency: 'INR',
      categoryId: friendsCat,
      merchant: 'Priya Sharma',
      description: 'Dinner split transfer to Priya Sharma',
      paymentMethod: 'upi',
      source: 'email',
      sourceAccountId: primaryGmail._id,
      personId: priyaPerson._id,
      vpa: 'priya.sharma@oksbi',
      externalTransactionId: 'UPI/426899140001',
      transactionDate: new Date('2026-09-22T21:00:00.000Z'),
      notes: 'Weekend dinner split',
      status: 'confirmed',
    },
    {
      userId: primaryUser._id,
      type: 'income',
      amount: 1500,
      currency: 'INR',
      categoryId: friendsCat,
      merchant: 'Priya Sharma',
      description: 'Trip reimbursement received from Priya Sharma',
      paymentMethod: 'upi',
      source: 'email',
      sourceAccountId: primaryGmail._id,
      personId: priyaPerson._id,
      vpa: 'priya.sharma@oksbi',
      externalTransactionId: 'UPI/426899140002',
      transactionDate: new Date('2026-09-18T16:30:00.000Z'),
      notes: 'Cab & movie reimbursement',
      status: 'confirmed',
    }
  );

  // Monthly Salaries for past 3 months
  for (let m = 2; m >= 0; m--) {
    const salaryDate = new Date(now.getFullYear(), now.getMonth() - m, 1, 9, 30);
    transactionsToInsert.push({
      userId: primaryUser._id,
      type: 'income',
      amount: 125000,
      currency: 'INR',
      categoryId: catMap.get('Salary'),
      merchant: 'Tech Innovations Pvt Ltd',
      description: 'Monthly Salary Credit',
      paymentMethod: 'bank',
      source: 'manual',
      transactionDate: salaryDate,
      notes: 'Monthly salary credited directly to bank',
      status: 'confirmed',
    });

    // Apartment rent for past 3 months (linked to Landlord Sharma)
    const rentDate = new Date(now.getFullYear(), now.getMonth() - m, 2, 11, 0);
    transactionsToInsert.push({
      userId: primaryUser._id,
      type: 'expense',
      amount: 22000,
      currency: 'INR',
      categoryId: catMap.get('Rent'),
      merchant: 'Landlord Sharma',
      description: 'House rent for month',
      paymentMethod: 'bank',
      source: 'manual',
      personId: landlordPerson._id,
      transactionDate: rentDate,
      notes: 'Flat 402 Rent',
      status: 'confirmed',
    });
  }

  // Generate 110 diverse expenses across the last 75 days
  let refCounter = 426810000000;
  for (let i = 0; i < 115; i++) {
    const tpl = txTemplates[Math.floor(Math.random() * txTemplates.length)];
    const daysAgo = Math.floor(Math.random() * 75);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 86400000);
    const amount = Math.floor(Math.random() * (tpl.max - tpl.min) + tpl.min);
    refCounter++;

    const isEmailSource = Math.random() > 0.45;

    transactionsToInsert.push({
      userId: primaryUser._id,
      type: 'expense',
      amount,
      currency: 'INR',
      categoryId: catMap.get(tpl.cat),
      merchant: tpl.merchant,
      description: `Payment to ${tpl.merchant}`,
      paymentMethod: tpl.method,
      source: isEmailSource ? 'email' : 'manual',
      sourceAccountId: isEmailSource ? primaryGmail._id : null,
      externalTransactionId: tpl.method === 'upi' ? `UPI/${refCounter}` : undefined,
      transactionDate: date,
      notes: tpl.notes,
      status: 'confirmed',
    });
  }

  await TransactionModel.insertMany(transactionsToInsert);
  console.log(`✅ Inserted ${transactionsToInsert.length} transactions.`);

  // Seed Detected Transactions for Review Center (Requirement 14, 18, 27)
  console.log('📥 Seeding Detected Transactions for Review Center...');
  await DetectedTransactionModel.create([
    {
      userId: primaryUser._id,
      emailAccountId: primaryGmail._id,
      emailMessageId: 'gmail_msg_982138129',
      amount: 1299,
      currency: 'INR',
      merchant: 'Amazon India',
      transactionDate: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hrs ago
      transactionType: 'expense',
      upiReference: '426899120847',
      sender: 'payments-noreply@google.com',
      subject: 'You paid ₹1,299 to Amazon India using Google Pay',
      confidenceScore: 96,
      status: 'detected',
      rawMetadata: { item: 'Wireless Keyboard & Mouse' },
    },
    {
      userId: primaryUser._id,
      emailAccountId: primaryGmail._id,
      emailMessageId: 'gmail_msg_982138130',
      amount: 450,
      currency: 'INR',
      merchant: 'Swiggy',
      transactionDate: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hrs ago
      transactionType: 'expense',
      upiReference: '426899120848',
      sender: 'noreply@phonepe.com',
      subject: 'Transaction Successful! Paid ₹450 to Swiggy',
      confidenceScore: 94,
      status: 'detected',
      rawMetadata: { item: 'Biryani bowl' },
    },
    {
      userId: primaryUser._id,
      emailAccountId: workGmail._id,
      emailMessageId: 'work_msg_10928301',
      amount: 230,
      currency: 'INR',
      merchant: 'Uber India',
      transactionDate: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      transactionType: 'expense',
      upiReference: '426899120849',
      sender: 'no-reply@paytm.com',
      subject: 'Paid ₹230 to Uber using Paytm UPI',
      confidenceScore: 88,
      status: 'detected',
      rawMetadata: { rideId: 'CRN982103' },
    },
    {
      userId: primaryUser._id,
      emailAccountId: primaryGmail._id,
      emailMessageId: 'gmail_msg_10928302',
      amount: 1850,
      currency: 'INR',
      merchant: 'Electricity Board',
      transactionDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      transactionType: 'expense',
      upiReference: '426899120850',
      sender: 'alerts@hdfcbank.net',
      subject: 'Alert: Your HDFC Bank A/C has been debited by INR 1,850.00',
      confidenceScore: 92,
      status: 'detected',
    },
  ]);

  // Seed Savings Goals with realistic contribution history.
  // Contributions are savings allocations only: they never create Transactions,
  // so expense reports and account balances stay untouched.
  console.log('🎯 Seeding Savings Goals...');
  const goalSeeds = [
    {
      name: 'New Laptop',
      description: 'Replacing my 2019 ThinkPad with a M3 MacBook Air.',
      targetAmount: 150000,
      targetDate: new Date(now.getFullYear() + 1, 2, 30),
      monthlyContribution: 12500,
      icon: 'Laptop',
      color: '#6366f1',
      categoryId: catMap.get('Shopping'),
      contributions: [
        { amount: 25000, monthsAgo: 2, note: 'Diwali bonus allocation' },
        { amount: 15000, monthsAgo: 3, note: 'Monthly transfer' },
        { amount: 15000, monthsAgo: 4, note: 'Monthly transfer' },
      ],
    },
    {
      name: 'Goa Trip',
      description: 'Family trip in December, booked early to lock fares.',
      targetAmount: 80000,
      targetDate: new Date(now.getFullYear(), 11, 10),
      monthlyContribution: 10000,
      icon: 'Plane',
      color: '#0ea5e9',
      categoryId: catMap.get('Travel'),
      contributions: [
        { amount: 20000, monthsAgo: 1, note: 'Post-bonus top-up' },
        { amount: 10000, monthsAgo: 2, note: 'Monthly transfer' },
      ],
    },
    {
      name: 'Emergency Fund',
      description: 'Six months of expenses parked in a high-yield RD.',
      targetAmount: 600000,
      targetDate: new Date(now.getFullYear() + 2, 5, 30),
      monthlyContribution: 20000,
      icon: 'ShieldCheck',
      color: '#10b981',
      categoryId: catMap.get('Investments'),
      contributions: [
        { amount: 50000, monthsAgo: 0, note: 'Freelance payment' },
        { amount: 20000, monthsAgo: 1, note: 'Monthly transfer' },
        { amount: 20000, monthsAgo: 2, note: 'Monthly transfer' },
      ],
    },
    {
      name: 'Wedding Ring',
      description: 'Completed goal kept for the record.',
      targetAmount: 90000,
      targetDate: new Date(now.getFullYear(), 0, 15),
      monthlyContribution: 15000,
      icon: 'Gift',
      color: '#f59e0b',
      categoryId: catMap.get('Shopping'),
      contributions: [
        { amount: 45000, monthsAgo: 4, note: 'Final purchase' },
        { amount: 45000, monthsAgo: 5, note: 'Final purchase' },
      ],
    },
  ];

  for (const seed of goalSeeds) {
    const saved = seed.contributions.reduce((sum, c) => sum + c.amount, 0);
    const created = await GoalModel.create({
      userId: primaryUser._id,
      name: seed.name,
      description: seed.description,
      targetAmount: seed.targetAmount,
      currentAmount: saved,
      targetDate: seed.targetDate,
      monthlyContribution: seed.monthlyContribution,
      categoryId: seed.categoryId ?? null,
      icon: seed.icon,
      color: seed.color,
      status: saved >= seed.targetAmount ? 'completed' : 'active',
    });

    await GoalContributionModel.create(
      seed.contributions.map((contribution) => ({
        goalId: created._id,
        amount: contribution.amount,
        contributionDate: new Date(
          now.getFullYear(),
          now.getMonth() - contribution.monthsAgo,
          Math.min(now.getDate(), 28)
        ),
        note: contribution.note,
      }))
    );
  }

  // Seed Notifications (Requirement 33)
  console.log('🔔 Seeding Notifications...');
  await NotificationModel.create([
    {
      userId: primaryUser._id,
      title: 'New Transactions Detected',
      message: '4 new UPI transactions detected from your linked Gmail accounts. Ready for your review.',
      type: 'detected_transaction',
      isRead: false,
    },
    {
      userId: primaryUser._id,
      title: 'Food & Dining Budget Alert',
      message: 'You have used 82% of your Food & Dining budget this month. ₹2,150 remaining.',
      type: 'budget_warning',
      isRead: false,
    },
    {
      userId: primaryUser._id,
      title: 'Upcoming Bill Payment',
      message: 'Netflix Premium (₹649) is due tomorrow.',
      type: 'system',
      isRead: false,
    },
  ]);

  console.log('🎉 SpendWise enterprise seeding complete!');
  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
