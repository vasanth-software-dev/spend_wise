import { EmailMessage, ParsedTransaction, TransactionEmailParser } from '../../types/index.js';
import { GPayParser } from './GPayParser.js';
import { PhonePeParser } from './PhonePeParser.js';
import { PaytmParser } from './PaytmParser.js';
import { BankParser } from './BankParser.js';
import { GenericUPIParser } from './GenericUPIParser.js';

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

  parse(email: EmailMessage): ParsedTransaction | null {
    let bestResult: ParsedTransaction | null = null;

    for (const parser of this.parsers) {
      if (parser.canParse(email)) {
        try {
          const result = parser.parse(email);
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
