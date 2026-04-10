const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const wishlistController = require('../controllers/wishlistController');
const cartController = require('../controllers/cartController');
const checkoutController = require('../controllers/checkoutController');
const { noCache, isUser } = require('../middlewares/auth');
const orderController = require('../controllers/orderController');

router.get('/shop', noCache, shopController.getShopPage);
router.get('/api/quick-view/:id', shopController.getQuickViewProduct);
router.get('/product/:id', shopController.getProductDetails);
router.get('/wishlist', wishlistController.getWishlistPage);
router.get('/cart', noCache, cartController.getCartPage);
router.get('/checkout', noCache, isUser, checkoutController.getCheckoutPage);
router.get('/order-success', isUser, noCache, checkoutController.getOrderSuccessPage);
router.get('/order-failed', isUser, noCache, checkoutController.getOrderFailedPage);
router.get('/profile/orders', isUser, orderController.getOrdersPage);
router.get('/profile/orders/:orderId/:itemId', isUser, orderController.getOrderDetailsPage);
router.get('/orders/invoice/:orderId/:itemId', isUser, orderController.downloadInvoice);

router.post('/wishlist/toggle', wishlistController.toggleWishlist);
router.post('/cart/update-quantity', cartController.updateQuantity);
router.post('/cart/update-size', cartController.updateSize);
router.post('/cart/remove', cartController.removeFromCart);
router.post('/cart/add', cartController.addToCart);
router.post('/checkout/place-order', isUser, noCache, checkoutController.placeOrder);
router.post('/checkout/create-razorpay-order', isUser, noCache, checkoutController.createRazorpayOrder);
router.post('/place-order', checkoutController.placeOrder);
router.post('/verify-payment', checkoutController.verifyPayment);
router.post('/orders/cancel-item', isUser, orderController.cancelItem);
router.post('/orders/return-item', isUser, orderController.returnItem);

module.exports = router;