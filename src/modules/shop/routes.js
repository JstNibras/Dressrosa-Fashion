const express = require('express');
const router = express.Router();
const shopController = require('./shopController');
const { noCache, isUser } = require('../../middlewares/auth');

router.get('/shop', noCache, shopController.getShopPage);

module.exports = router;