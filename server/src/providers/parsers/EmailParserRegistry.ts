import { EmailMessage, ParsedTransaction, TransactionEmailParser } from '../../types/index.js';
import { GPayParser } from './GPayParser.js';
import { PhonePeParser } from './PhonePeParser.js';
import { PaytmParser } from './PaytmParser.js';
import { BankParser } from './BankParser.js';
import { GenericUPIParser } from './GenericUPIParser.js';

export function isUnwantedEmail(email: EmailMessage): boolean {
  const sender = (email.sender || '').toLowerCase();
  const subject = (email.subject || '').toLowerCase();

  // 1. Non-financial / marketing senders (Job boards, ticket portals, promo mailers)
  const nonFinancialSenders = [
    'indeed.com',
    'naukri.com',
    'linkedin.com',
    'internshala.com',
    'glassdoor.com',
    'foundit.in',
    'shine.com',
    'ticketadmin@irctc.co.in',
    'irctc.co.in',
    'abhibus.com',
    'redbus.in',
    'makemytrip.com',
    'goibibo.com',
    'yatra.com',
    'easemytrip.com',
    'mailers.',
    'rmp.flipkart.com',
    'promotions@',
    'newsletter@',
    'marketing@',
    'offers@',
  ];

  if (nonFinancialSenders.some((domain) => sender.includes(domain))) {
    return true;
  }

  // 2. Unwanted marketing / promotional / sales pitch subjects
  const unwantedSubjectPatterns = [
    /\b(?:birthday gift|gift is waiting|gift card|gift voucher|anniversary gift)\b/i,
    /\b(?:intern|internship|job alert|hiring|interview|work from home|career)\b/i,
    /\b(?:booking confirmation|ticket for|e-ticket|pnr status|itinerary|boarding pass)\b/i,
    /\b(?:credit card is ready|apply for credit card|pre-approved|pre approved|instant loan|loan offer|lifetime free card)\b/i,
    /\b(?:up to ₹.*credit|up to ₹.*off|flat ₹.*off|% off|only for you|deal of the day)\b/i,
    /\b(?:credit limit increase|credit score|cibil score)\b/i,
  ];

  if (unwantedSubjectPatterns.some((pattern) => pattern.test(subject))) {
    return true;
  }

  return false;
}

export class EmailParserRegistry {
  private parsers: TransactionEmailParser[] = [];

  constructor() {
    // Specific parsers first, generic fallback last
    this.register(new GPayParser());
    this.register(new PhonePeParser());
    this.register(new PaytmParser());
    this.register(new BankParser());
    this.register(new GenericUPIParser());
  }

  register(parser: TransactionEmailParser): void {
    this.parsers.push(parser);
  }

  parse(email: EmailMessage): Promise<ParsedTransaction | null> {
    // Drop promotional, marketing, job alerts, and travel booking confirmations
    if (isUnwantedEmail(email)) {
      return null;
    }

    let bestResult: ParsedTransaction | null = null;

    for (const parser of this.parsers) {
      if (parser.canParse(email)) {
        try {
          const result = await parser.parse(email);
          if (result) {
            // Keep the result with the highest confidence score
            if (!bestResult || result.confidenceScore > bestResult.confidenceScore) {
              bestResult = result;
              if (bestResult.confidenceScore >= 95) {
                // High confidence match found, no need to check further
                break;
              }
            }
          }
        } catch (err) {
          console.warn(`Error running parser ${parser.name}:`, err);
        }
      }
    }

    return bestResult;
  }
}

export const emailParserRegistry = new EmailParserRegistry();
