const express = require('express');
const router = express.Router();
const shopController = require('./shopController');
const wishlistController = require('../wishlist/wishlistController');
const cartController = require('../cart/cartController');
const { noCache, isUser } = require('../../middlewares/auth');

router.get('/shop', noCache, shopController.getShopPage);
router.get('/api/quick-view/:id', shopController.getQuickViewProduct);
router.get('/product/:id', shopController.getProductDetails);
router.get('/wishlist', wishlistController.getWishlistPage);
router.get('/cart', cartController.getCartPage);

router.post('/wishlist/toggle', wishlistController.toggleWishlist);
router.post('/cart/update-quantity', cartController.updateQuantity);
router.post('/cart/update-size', cartController.updateSize);
router.post('/cart/remove', cartController.removeFromCart);
router.post('/cart/add', cartController.addToCart);

module.exports = router;