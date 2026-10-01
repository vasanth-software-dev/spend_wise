import { Router } from 'express';
import { calendarController } from '../controllers/CalendarController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  calendarDayQuerySchema,
  calendarMonthQuerySchema,
  calendarUpcomingQuerySchema,
} from '../validators/calendarValidators.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/month',
  validate(calendarMonthQuerySchema),
  (req, res, next) => calendarController.getMonth(req, res, next)
);
router.get(
  '/day',
  validate(calendarDayQuerySchema),
  (req, res, next) => calendarController.getDay(req, res, next)
);
router.get(
  '/upcoming',
  validate(calendarUpcomingQuerySchema),
  (req, res, next) => calendarController.getUpcoming(req, res, next)
);

export default router;
