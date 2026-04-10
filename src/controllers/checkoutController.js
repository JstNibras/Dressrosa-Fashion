const Address = require('../models/addressModel');
const cartService = require('../services/cartService');
const checkoutService = require('../services/checkoutService');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;

        const Cart = require('../models/cartModel'); // Adjust path if necessary
        const cartDoc = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            populate: { path: 'category' }
        });

        if (cartDoc) {
            const hasGhostItems = cartDoc.items.some(item => 
                !item.product || 
                item.product.isActive === false || item.product.isListed === false ||
                !item.product.category || 
                item.product.category.isActive === false || item.product.category.isListed === false
            );

            if (hasGhostItems) {
                console.log("Checkout blocked: Ghost items (deleted category) found in cart.");
                return res.redirect('/cart?error=Some items in your cart belong to an unavailable category.');
            }
        }

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

        if (paymentMethod === 'COD') {
            const order = await checkoutService.placeOrder(userId, addressId, paymentMethod);
            return res.status(200).json({ success: true, orderId: order.orderId });
        }

        return res.status(400).json({ success: false, message: "Invalid route for online payments" });
    
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;

        const cartData = await cartService.getCartData(userId);
        if (!cartData || !cartData.isCheckoutValid) {
            return res.status(400).json({ success: false, message: "Invalid cart items" });
        }

        const options = {
            amount: Math.round(cartData.cartTotal * 100),
            currency: "INR",
            receipt: 'TEMP-' + Date.now()
        };

        const rzpOrder = await razorpayInstance.orders.create(options);

        return res.status(200).json({
            success: true,
            razorpayOrder: rzpOrder,
            key: process.env.RAZORPAY_KEY_ID,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not initialize payment gateway" });
    }
}

exports.verifyPayment = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId } = req.body;

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === razorpay_signature) {
            const order = await checkoutService.placeOrder(userId, addressId, 'RAZORPAY');

            order.paymentStatus = 'Completed';
            order.orderStatus = 'Processing';
            await order.save();

            return res.status(200).json({ success: true, orderId: order.orderId });
        } else {
            return res.status(400).json({ success: false, message: "Signature mismatch" });
        }
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ success: false });
    }
};

exports.getOrderSuccessPage = async (req, res) => {
    res.render('user/order-success', { orderId: req.query.orderId });
}

exports.getOrderFailedPage = async (req, res) => {
    res.render('user/order-failed', { orderId: req.query.orderId });
}

