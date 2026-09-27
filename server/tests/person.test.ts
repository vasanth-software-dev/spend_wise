import { describe, it, expect } from 'vitest';
import { normalizePersonName, isIdentifiablePerson } from '../src/services/PersonService.js';

describe('Person Identity & Matching Logic', () => {
  describe('normalizePersonName', () => {
    it('normalizes casing and multiple spaces', () => {
      expect(normalizePersonName('ABIRAMI P')).toBe('abirami p');
      expect(normalizePersonName('Abirami P')).toBe('abirami p');
      expect(normalizePersonName('ABIRAMI  P')).toBe('abirami p');
      expect(normalizePersonName('  ABIRAMI   P  ')).toBe('abirami p');
    });

    it('normalizes trailing dots from initials', () => {
      expect(normalizePersonName('ABIRAMI P.')).toBe('abirami p');
      expect(normalizePersonName('KUMAR S.')).toBe('kumar s');
      expect(normalizePersonName('Priya Sharma.')).toBe('priya sharma');
    });

    it('handles empty or blank inputs gracefully', () => {
      expect(normalizePersonName('')).toBe('');
      expect(normalizePersonName('   ')).toBe('');
    });
  });

  describe('isIdentifiablePerson', () => {
    it('identifies person with name and VPA', () => {
      expect(isIdentifiablePerson('ABIRAMI P', '8489906290@yapl')).toBe(true);
      expect(isIdentifiablePerson('Abirami P', '8489906290@yapl')).toBe(true);
      expect(isIdentifiablePerson('Priya Sharma', 'priya.sharma@oksbi')).toBe(true);
    });

    it('identifies person name with an initial', () => {
      expect(isIdentifiablePerson('ABIRAMI P')).toBe(true);
      expect(isIdentifiablePerson('KUMAR S')).toBe(true);
      expect(isIdentifiablePerson('PRIYA R')).toBe(true);
    });

    it('identifies standard personal full names', () => {
      expect(isIdentifiablePerson('Rahul Verma')).toBe(true);
      expect(isIdentifiablePerson('Ananya Iyer')).toBe(true);
      expect(isIdentifiablePerson('Sathish Kumar')).toBe(true);
    });

    it('rejects commercial companies and merchant businesses', () => {
      expect(isIdentifiablePerson('Swiggy')).toBe(false);
      expect(isIdentifiablePerson('Amazon India')).toBe(false);
      expect(isIdentifiablePerson('Uber India')).toBe(false);
      expect(isIdentifiablePerson('Netflix')).toBe(false);
      expect(isIdentifiablePerson('Flipkart Internet Pvt Ltd')).toBe(false);
      expect(isIdentifiablePerson('TNEB Electricity Bill')).toBe(false);
      expect(isIdentifiablePerson('Apollo Pharmacy')).toBe(false);
      expect(isIdentifiablePerson('Starbucks Coffee')).toBe(false);
      expect(isIdentifiablePerson('HPCL Petrol Pump')).toBe(false);
    });

    it('rejects generic transaction labels', () => {
      expect(isIdentifiablePerson('UPI Payee')).toBe(false);
      expect(isIdentifiablePerson('Bank Transaction')).toBe(false);
      expect(isIdentifiablePerson('Salary Credit')).toBe(false);
      expect(isIdentifiablePerson('Self Transfer')).toBe(false);
    });
  });

  describe('Matching Priority Specifications', () => {
    it('adheres to matching priority hierarchy: 1. VPA, 2. Email, 3. Normalized Name', () => {
      // Mock directory of existing people
      const existingPeople = [
        {
          _id: 'person-1',
          name: 'Abirami P',
          normalizedName: normalizePersonName('Abirami P'),
          vpa: '8489906290@yapl',
          email: 'abirami@example.com',
        },
        {
          _id: 'person-2',
          name: 'Rahul Verma',
          normalizedName: normalizePersonName('Rahul Verma'),
          vpa: 'rahul98@okaxis',
          email: 'rahul.verma@example.com',
        },
      ];

      // Helper simulating PersonService.findOrCreate matching priority
      function matchPerson(input: { name: string; vpa?: string; email?: string }) {
        const inputNorm = normalizePersonName(input.name);
        const inputVpa = input.vpa?.toLowerCase().trim();
        const inputEmail = input.email?.toLowerCase().trim();

        // 1. VPA priority
        if (inputVpa) {
          const byVpa = existingPeople.find((p) => p.vpa === inputVpa);
          if (byVpa) return { matchedBy: 'vpa', person: byVpa };
        }

        // 2. Email priority
        if (inputEmail) {
          const byEmail = existingPeople.find((p) => p.email === inputEmail);
          if (byEmail) return { matchedBy: 'email', person: byEmail };
        }

        // 3. Normalized Name priority
        const byName = existingPeople.find((p) => p.normalizedName === inputNorm);
        if (byName) return { matchedBy: 'name', person: byName };

        return null;
      }

      // Test 1: Match by VPA even if name variant is capitalized or spaced differently
      const match1 = matchPerson({ name: 'ABIRAMI  P', vpa: '8489906290@yapl' });
      expect(match1).not.toBeNull();
      expect(match1?.matchedBy).toBe('vpa');
      expect(match1?.person._id).toBe('person-1');

      // Test 2: Match by email if VPA is not provided
      const match2 = matchPerson({ name: 'Different Name', email: 'abirami@example.com' });
      expect(match2).not.toBeNull();
      expect(match2?.matchedBy).toBe('email');
      expect(match2?.person._id).toBe('person-1');

      // Test 3: Match by normalized name if neither VPA nor email is provided
      const match3 = matchPerson({ name: 'RAHUL   VERMA' });
      expect(match3).not.toBeNull();
      expect(match3?.matchedBy).toBe('name');
      expect(match3?.person._id).toBe('person-2');

      // Test 4: Unknown person returns null
      const match4 = matchPerson({ name: 'Unknown Stranger' });
      expect(match4).toBeNull();
    });
  });
});
