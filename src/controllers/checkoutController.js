const Address = require('../models/addressModel');
const cartService = require('../services/cartService');
const checkoutService = require('../services/checkoutService');

exports.getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;

        const cartData = await cartService.getCartData(userId);

        if (!cartData || cartData.items.length === 0 || !cartData.isCheckoutValid) {
            console.log("Checkout blocked : Invalid cart or stock issues. ");
            return res.redirect('/cart');
        }

        const addresses = await Address.find({ user: userId });
        const defaultAddress = addresses.find(a => a.isDefault) || addresses[0] || null;

        res.render('user/checkout' , {
            cartItems: cartData.items,
            cartTotal: cartData.cartTotal,
            addresses: addresses,
            defaultAddress: defaultAddress,
        });

    } catch (error) {
        console.error("Checkout Page Error :", error);
        res.redirect('/cart?error=ServerError')
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Missing address or payment method"});
        }

        const order = await checkoutService.placeOrder(userId, addressId, paymentMethod);

        res.status(200).json({ success: true, orderId: order.orderId });
    
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getOrderSuccess = async (req, res) => {
    res.render('user/order-success', { orderId: req.query.orderId });
}