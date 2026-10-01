import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { sendError } from '../utils/apiResponse.js';

/**
 * Accepts any Zod schema, including `.refine()`-wrapped ones used for
 * cross-field rules (e.g. saved amount may not exceed the target).
 */
export function validate(schema: ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.').replace(/^(body|query|params)\./, ''),
          message: err.message,
        }));
        sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors);
        return;
      }
      next(error);
    }
  };
}
