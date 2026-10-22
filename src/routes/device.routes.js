const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const warrantyService = require('../services/warrantyCheck.service');
const { invalid } = require('../services/errors');
const {
  validateCreateDevice,
  validateUpdateDevice,
  assertValid
} = require('../validators/ticket.validator');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    if (!req.query.serial_no) {
      throw invalid('Thiếu serial/IMEI cần tra cứu.', {
        serial_no: 'Nhập serial/IMEI của thiết bị.'
      });
    }
    const result = await warrantyService.lookupBySerial(
      req.query.serial_no,
      req.query.received_at || new Date()
    );
    res.json({ data: result });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const devices = await warrantyService.listDevices({
      customer_id: req.query.customer_id,
      q: req.query.q
    });
    res.json({ data: devices, total: devices.length });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const device = await warrantyService.getDevice(req.params.id);
    const result = await warrantyService.checkWarrantyForDevice(req.params.id);
    res.json({ data: { ...result, device: result.device || device } });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    assertValid(validateCreateDevice(req.body));
    const result = await warrantyService.createDevice(req.body);
    res.status(201).json({ data: result });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    assertValid(validateUpdateDevice(req.body));
    const result = await warrantyService.updateDevice(req.params.id, req.body);
    res.json({ data: result });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await warrantyService.deleteDevice(req.params.id);
    res.json({ data: result });
  })
);

module.exports = router;
