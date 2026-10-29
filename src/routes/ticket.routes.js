const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const ticketService = require('../services/ticket.service');
const categoryService = require('../services/category.service');
const {
  validateCreateTicket,
  validateUpdateTicket,
  validatePreview,
  assertValid
} = require('../validators/ticket.validator');

const router = express.Router();
const catalogRouter = express.Router();

router.use(requireAuth);
catalogRouter.use(requireAuth);

router.post(
  '/preview',
  asyncHandler(async (req, res) => {
    assertValid(validatePreview(req.body));
    const preview = await ticketService.previewDueDate(req.body);
    res.json({ data: preview });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tickets = await ticketService.listTickets(
      {
        status: req.query.status,
        category_id: req.query.category_id,
        priority: req.query.priority,
        q: req.query.q,
        center_id: req.query.center_id
      },
      req.user
    );
    res.json({ data: tickets, total: tickets.length });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    assertValid(validateCreateTicket(req.body));
    const detail = await ticketService.createTicket(req.body, req.user);
    res.status(201).json({ data: detail });
  })
);

router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const history = await ticketService.getHistory(req.params.id, req.user);
    res.json({ data: history, total: history.length });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const detail = await ticketService.getTicket(req.params.id, req.user);
    res.json({ data: detail });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    assertValid(validateUpdateTicket(req.body));
    const detail = await ticketService.updateTicket(req.params.id, req.body, req.user);
    res.json({ data: detail });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await ticketService.deleteTicket(req.params.id, req.user);
    res.json({ data: result });
  })
);

catalogRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const catalogs = await categoryService.listCatalogs();
    res.json({ data: catalogs });
  })
);

catalogRouter.get(
  '/categories/:id/suggest',
  asyncHandler(async (req, res) => {
    const suggestion = await categoryService.suggestPriority(req.params.id);
    res.json({ data: suggestion });
  })
);

module.exports = { router, catalogRouter };
