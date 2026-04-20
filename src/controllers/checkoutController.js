const Address = require('../models/addressModel');
const cartService = require('../services/cartService');
const checkoutService = require('../services/checkoutService');
const Coupon = require('../models/couponModel');
const couponService = require('../services/couponService');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;

        if (req.query.from === 'cart') {
            delete req.session.buyNowItem;
            delete req.session.appliedCoupon;
        }

        let cartItems = [];
        let cartTotal = 0;

        let regularTotal = 0;
        let productDiscount = 0;

        if (req.session.buyNowItem) {
            const Product = require('../models/productModel');
            const { productId, size, quantity } = req.session.buyNowItem;
            
            const product = await Product.findById(productId).populate('category');
            
            if (!product || product.isActive === false || product.isListed === false || 
                !product.category || product.category.isActive === false || product.category.isListed === false) {
                delete req.session.buyNowItem;
                return res.redirect('/shop?error=This product is no longer available');
            }

            const variant = product.variants.find(v => String(v.size).trim() === String(size).trim() && v.isActive !== false);
            
            if (!variant || variant.stock < quantity) {
                delete req.session.buyNowItem;
                return res.redirect(`/product/${productId}?error=Requested stock unavailable`);
            }

            const itemTotal = quantity * product.salePrice;
            cartTotal = itemTotal;
            regularTotal = quantity * (product.regularPrice || product.salePrice);
            productDiscount = regularTotal - itemTotal;

            cartItems = [{
                _id: 'BUY_NOW_TEMP_ID',
                productId: product._id,
                name: product.name,
                categoryName: product.category.name,
                image: product.images[0] || '/images/default-product.png',
                size: size,
                price: product.salePrice,
                regularPrice: product.regularPrice,
                quantity: quantity,
                itemTotal: itemTotal
            }];

        } else {
            const Cart = require('../models/cartModel');
            const cartDoc = await Cart.findOne({ user: userId }).populate({
                path: 'items.product',
                populate: { path: 'category' }
            });

            if (cartDoc) {
                const invalidItem = cartDoc.items.find(item => 
                    !item.product || 
                    item.product.isActive === false || item.product.isListed === false ||
                    !item.product.category || 
                    item.product.category.isActive === false || item.product.category.isListed === false
                );

                if (invalidItem) {
                    return res.redirect('/cart?error=Some items in your cart are no longer available. Please review.');
                }

                const cartDataForStock = await cartService.getCartData(userId);
                const outOfStockItem = cartDataForStock.items.find(item => item.hasStockIssue || item.isOutOfStock);
                if (outOfStockItem) {
                    return res.redirect(`/cart?error=Insufficient stock for ${outOfStockItem.name}.`);
                }
            }

            const cartData = await cartService.getCartData(userId);

            if (!cartData || cartData.items.length === 0 || !cartData.isCheckoutValid) {
                return res.redirect('/cart');
            }

            cartItems = cartData.items;
            cartTotal = cartData.cartTotal;
            regularTotal = cartData.regularTotal;
            productDiscount = cartData.productDiscount;
        }

        if (req.session.appliedCoupon) {
            const result = await couponService.validateCoupon(req.session.appliedCoupon.code, userId, cartTotal);
            if (!result.success) {
                req.session.appliedCoupon = null;
            } else {
                const discount = couponService.calculateDiscount(result.coupon, cartTotal);
                req.session.appliedCoupon.discountAmount = discount;
            }
        }

        const addresses = await Address.find({ user: userId });
        const defaultAddress = addresses.find(a => a.isDefault) || addresses[0] || null;

        const walletService = require('../services/walletService');
        const wallet = await walletService.getWallet(userId);

        res.render('user/checkout' , {
            cartItems: cartItems,
            cartTotal: cartTotal,
            regularTotal: regularTotal,
            productDiscount: productDiscount,
            addresses: addresses,
            defaultAddress: defaultAddress,
            walletBalance: wallet.balance,
            isBuyNow: !!req.session.buyNowItem,
            appliedCoupon: req.session.appliedCoupon || null
        });

    } catch (error) {
        console.error("Checkout Page Error:", error);
        res.redirect('/cart?error=ServerError');
    }
};

exports.buyNow = async (req, res) => {
    try {
        const { productId, size, quantity } = req.body;

        if (!productId || !size || !quantity) {
            return res.status(400).json({ success: false, message: "Missing product details" });
        }

        const Product = require('../models/productModel');
        const product = await Product.findById(productId).populate('category');

        if (!product || product.isActive === false || product.isListed === false) {
            return res.status(400).json({ success: false, message: "This product is no longer available." });
        }

        if (!product.category || product.category.isActive === false || product.category.isListed === false) {
            return res.status(400).json({ success: false, message: "The category for this product is currently unavailable." });
        }

        const variant = product.variants.find(v => String(v.size).trim() === String(size).trim() && v.isActive !== false);
        if (!variant) {
            return res.status(400).json({ success: false, message: "Selected size is no longer available." });
        }

        if (variant.stock < parseInt(quantity)) {
            return res.status(400).json({ success: false, message: "Requested quantity exceeds available stock." });
        }

        req.session.buyNowItem = { productId, size, quantity: parseInt(quantity) };

        res.status(200).json({ success: true, redirectUrl: '/checkout' });
    } catch (error) {
        console.error("Buy Now Error:", error);
        res.status(500).json({ success: false, message: "Server error processing Buy Now" });
    }
}

exports.placeOrder = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Missing address or payment method"});
        }

        if (paymentMethod === 'COD' || paymentMethod === 'WALLET') {
            const appliedCoupon = req.session.appliedCoupon || null;
            const buyNowItem = req.session.buyNowItem || null; 

            const order = await checkoutService.placeOrder(userId, addressId, paymentMethod, appliedCoupon, buyNowItem);

            if (paymentMethod === 'WALLET') {
                const walletService = require('../services/walletService');
                await walletService.debitWallet(userId, order.pricing.total, `Payment for Order #${order.orderId}`);

                order.paymentStatus = 'Completed';
                order.orderStatus = 'Processing';
                await order.save();
            }

            req.session.appliedCoupon = null;
            req.session.buyNowItem = null; 
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
        let finalAmount = 0;

        if (req.session.buyNowItem) {
            const Product = require('../models/productModel');
            const { productId, size, quantity } = req.session.buyNowItem;
            const product = await Product.findById(productId).populate('category');

            if (!product || product.isActive === false || product.isListed === false) {
                return res.status(400).json({ success: false, message: "This product is no longer available." });
            }
            if (!product.category || product.category.isActive === false || product.category.isListed === false) {
                return res.status(400).json({ success: false, message: "The product category is currently unavailable." });
            }

            const variant = product.variants.find(v => String(v.size).trim() === String(size).trim());
            if (!variant || variant.stock < quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}.` });
            }

            finalAmount = product.salePrice * quantity;
        } else {
            const cartData = await cartService.getCartData(userId);
            if (!cartData || !cartData.isCheckoutValid) {
                const unavailableItem = cartData.items.find(item => item.isUnavailable || item.hasStockIssue);
                const msg = unavailableItem ? `Item '${unavailableItem.name}' is unavailable or has insufficient stock.` : "Invalid cart items.";
                return res.status(400).json({ success: false, message: msg });
            }
            finalAmount = cartData.cartTotal;
        }

        if (req.session.appliedCoupon) {
            const result = await couponService.validateCoupon(req.session.appliedCoupon.code, userId, finalAmount);
            if (result.success) {
                const discount = couponService.calculateDiscount(result.coupon, finalAmount);
                finalAmount -= discount;
            } else {
                return res.status(400).json({ success: false, message: `Coupon Error: ${result.message}` });
            }
        }

        if (finalAmount < 1) {
            return res.status(400).json({ success: false, message: "Order amount must be at least ₹1 for Razorpay. Please use another payment method for free orders." });
        }

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
            const buyNowItem = req.session.buyNowItem || null; 

            const order = await checkoutService.placeOrder(userId, addressId, 'RAZORPAY', appliedCoupon, buyNowItem);

            order.paymentStatus = 'Completed';
            order.orderStatus = 'Processing';
            await order.save();

            req.session.appliedCoupon = null;
            req.session.buyNowItem = null; 

            return res.status(200).json({ success: true, orderId: order.orderId });
        } else {
            return res.status(400).json({ success: false, message: "Signature mismatch" });
        }
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ success: false, message: error.message || "Order creation failed during payment verification." });
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

        let subtotal = 0;
        if (req.session.buyNowItem) {
            const Product = require('../models/productModel');
            const product = await Product.findById(req.session.buyNowItem.productId);
            subtotal = product.salePrice * req.session.buyNowItem.quantity;
        } else {
            const cartData = await cartService.getCartData(userId);
            subtotal = cartData.cartTotal;
        }

        const result = await couponService.validateCoupon(code, userId, subtotal);
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message });
        }

        const discountAmount = couponService.calculateDiscount(result.coupon, subtotal);
        req.session.appliedCoupon = { 
            code: result.coupon.code, 
            discountAmount: discountAmount,
            minPurchaseAmount: result.coupon.minPurchaseAmount
        };
        
        res.status(200).json({ success: true, discountAmount, finalTotal: subtotal - discountAmount });
    } catch (error) {
        console.error("Apply Coupon Error:", error);
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