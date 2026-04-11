const Address = require('../models/addressModel');
const cartService = require('../services/cartService');
const checkoutService = require('../services/checkoutService');
const Coupon = require('../models/couponModel');
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

        const walletService = require('../services/walletService');
        const wallet = await walletService.getWallet(userId);

        res.render('user/checkout' , {
            cartItems: cartData.items,
            cartTotal: cartData.cartTotal,
            addresses: addresses,
            defaultAddress: defaultAddress,
            walletBalance: wallet.balance
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

        if (paymentMethod === 'COD' || paymentMethod === 'WALLET') {
            const appliedCoupon = req.session.appliedCoupon || null;
            const order = await checkoutService.placeOrder(userId, addressId, paymentMethod, appliedCoupon);

            if (paymentMethod === 'WALLET') {
                const walletService = require('../services/walletService');
                await walletService.debitWallet(userId, order.pricing.total, `Payment for Order #${order.orderId}`);

                order.paymentStatus = 'Completed';
                order.orderStatus = 'Processing';
                await order.save();
            }

            req.session.appliedCoupon = null;
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

        let finalAmount = cartData.cartTotal;
        if (req.session.appliedCoupon) finalAmount -= req.session.appliedCoupon.discountAmount;

        const options = {
            amount: Math.round(finalAmount * 100),
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
            const appliedCoupon = req.session.appliedCoupon || null;

            const order = await checkoutService.placeOrder(userId, addressId, 'RAZORPAY', appliedCoupon);

            order.paymentStatus = 'Completed';
            order.orderStatus = 'Processing';
            await order.save();

            req.session.appliedCoupon = null;

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

exports.applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user.id || req.session.user._id;

        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        if (!coupon) return res.status(400).json({ success: false, message: "Invalid or Inactive coupon code." });

        if (new Date() > coupon.expiryDate) return res.status(400).json({ success: false, message: "This coupon has expired." });

        const hasUsed = coupon.usedBy.some(id => id.toString() === userId.toString());
        if (hasUsed) {
            return res.status(400).json({ success: false, message: "You have already used this coupon." });
        }

        const cartData = await cartService.getCartData(userId);
        const subtotal = cartData.cartTotal;

        if (subtotal < coupon.minPurchaseAmount) return res.status(400).json({ success: false, message: `Minimum purchase of ${coupon.minPurchaseAmount} required.`});

        let discountAmount = 0;
        if (coupon.discountType === 'flat') {
            discountAmount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
        }

        if (discountAmount > subtotal) discountAmount = subtotal;

        req.session.appliedCoupon = { code: coupon.code, discountAmount: discountAmount };
        
        res.status(200).json({ success: true, discountAmount, finalTotal: subtotal - discountAmount });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error applying coupon." });
    }
};

exports.removeCoupon = async (req, res) => {
    req.session.appliedCoupon = null;
    res.status(200).json({ success: true, message: "Coupon removed" });
};

exports.getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const now = new Date();

        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: now },
            usedBy: { $ne: userId }
        }).sort({ minPurchaseAmount: 1 });

        res.status(200).json({ success: true, coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching coupons" });
    }
}