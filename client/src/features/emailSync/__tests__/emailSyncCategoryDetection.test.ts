import { describe, it, expect } from 'vitest';
import {
  predictCategoryAndType,
  getCategoryType,
} from '../../../utils/statementParser.js';
import {
  SELF_TRANSFER_CATEGORY,
  isTransferCategoryName,
} from '../../../constants/categories.js';

describe('Email-Sync Auto Detect Category Selection (Matching Import Transactions)', () => {
  const knownPeople = ['Abirami P', 'Boobal'];

  it('auto-detects food delivery merchants (Swiggy, Zomato) into Food & Dining as expense', () => {
    const swiggyResult = predictCategoryAndType('Swiggy You paid ₹489.00 using Google Pay', 'expense', undefined, knownPeople);
    expect(swiggyResult.category).toBe('Food & Dining');
    expect(swiggyResult.type).toBe('expense');

    const zomatoResult = predictCategoryAndType('Alert: A/C debited towards Zomato Order', 'expense', undefined, knownPeople);
    expect(zomatoResult.category).toBe('Food & Dining');
    expect(zomatoResult.type).toBe('expense');
  });

  it('auto-detects individual person names into Friends & Family and sets appropriate type', () => {
    // Credit / Received from individual
    const receivedResult = predictCategoryAndType('UPI Credit from Abirami P', 'income', undefined, knownPeople);
    expect(receivedResult.category).toBe('Friends & Family');
    expect(receivedResult.type).toBe('income');

    // Debit / Sent to individual
    const sentResult = predictCategoryAndType('Paid to Boobal via UPI', 'expense', undefined, knownPeople);
    expect(sentResult.category).toBe('Friends & Family');
    expect(sentResult.type).toBe('expense');
  });

  it('auto-detects corporate credit / salary into Salary as income', () => {
    const salaryResult = predictCategoryAndType('Salary credit from Elito Innovations Pvt Ltd', 'income', undefined, knownPeople);
    expect(salaryResult.category).toBe('Salary');
    expect(salaryResult.type).toBe('income');
  });

  it('auto-detects self-transfers into Self Transfer with transfer type', () => {
    const transferResult = predictCategoryAndType('Transfer to own account self transfer', 'expense', undefined, knownPeople);
    expect(transferResult.category).toBe(SELF_TRANSFER_CATEGORY);
    expect(isTransferCategoryName(transferResult.category)).toBe(true);
  });

  it('properly maps category selection to transaction type', () => {
    // Selecting Salary maps to income
    expect(getCategoryType('Salary')).toBe('income');

    // Selecting Food & Dining maps to expense
    expect(getCategoryType('Food & Dining')).toBe('expense');

    // Selecting Self Transfer maps to transfer
    expect(isTransferCategoryName('Self Transfer')).toBe(true);
  });

  it('switches category compatibly when transaction type is toggled', () => {
    // Toggling from expense to income for a person text
    const incomePredicted = predictCategoryAndType('Abirami P', 'income', undefined, knownPeople);
    expect(incomePredicted.category).toBe('Friends & Family');
    expect(incomePredicted.type).toBe('income');

    // Toggling to transfer
    expect(isTransferCategoryName(SELF_TRANSFER_CATEGORY)).toBe(true);

    // Toggling from income to expense for commercial merchant
    const expensePredicted = predictCategoryAndType('Swiggy', 'expense', undefined, knownPeople);
    expect(expensePredicted.category).toBe('Food & Dining');
    expect(expensePredicted.type).toBe('expense');
  });

  it('correctly auto-detects "Althaf Briyani" as Food & Dining and NEVER as Friends & Family', () => {
    // Exact user test case: "Althaf Briyani"
    const althafResult = predictCategoryAndType('Althaf Briyani', 'expense', undefined, knownPeople);
    expect(althafResult.category).toBe('Food & Dining');
    expect(althafResult.type).toBe('expense');

    // Variations of briyani/biryani spelling in Indian transactions
    const amburResult = predictCategoryAndType('Ambur Star Briyani', 'expense', undefined, knownPeople);
    expect(amburResult.category).toBe('Food & Dining');

    const dindigulResult = predictCategoryAndType('Dindigul Thalappakatti Biriyani', 'expense', undefined, knownPeople);
    expect(dindigulResult.category).toBe('Food & Dining');

    const upiPayeeResult = predictCategoryAndType('UPI/Althaf Briyani/426899120943', 'expense', undefined, knownPeople);
    expect(upiPayeeResult.category).toBe('Food & Dining');
  });
});
