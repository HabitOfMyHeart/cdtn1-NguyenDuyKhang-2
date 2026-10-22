const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const customerService = require('../services/customer.service');
const {
  validateCreateCustomer,
  validateUpdateCustomer,
  assertValid
} = require('../validators/ticket.validator');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const customers = await customerService.listCustomers({
      q: req.query.q,
      phone: req.query.phone
    });
    res.json({ data: customers, total: customers.length });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await customerService.getCustomer(req.params.id);
    res.json({ data: customer });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    assertValid(validateCreateCustomer(req.body));
    const customer = await customerService.createCustomer(req.body);
    res.status(201).json({ data: customer });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    assertValid(validateUpdateCustomer(req.body));
    const customer = await customerService.updateCustomer(req.params.id, req.body);
    res.json({ data: customer });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await customerService.deleteCustomer(req.params.id);
    res.json({ data: result });
  })
);

module.exports = router;
