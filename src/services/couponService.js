const Coupon = require('../models/couponModel');

exports.validateCoupon = async (code, userId, subtotal) => {
    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        
        if (!coupon) {
            return { success: false, message: "Invalid or inactive coupon code." };
        }

        if (new Date() > coupon.expiryDate) {
            return { success: false, message: "This coupon has expired." };
        }

        if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
            return { success: false, message: "This coupon has reached its maximum usage limit." };
        }

        const hasUsed = coupon.usedBy.some(id => id.toString() === userId.toString());
        if (hasUsed) {
            return { success: false, message: "You have already used this coupon." };
        }

        if (subtotal < coupon.minPurchaseAmount) {
            return { success: false, message: `Minimum purchase of ₹${coupon.minPurchaseAmount} required for this coupon.` };
        }

        return { success: true, coupon };
    } catch (error) {
        console.error("Coupon Validation Error:", error);
        return { success: false, message: "Error validating coupon." };
    }
};

exports.calculateDiscount = (coupon, subtotal) => {
    let discountAmount = 0;

    if (coupon.discountType === 'flat') {
        discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
        discountAmount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount > 0 && discountAmount > coupon.maxDiscountAmount) {
            discountAmount = coupon.maxDiscountAmount;
        }
    }

    if (discountAmount > subtotal) {
        discountAmount = subtotal;
    }

    return Math.round(discountAmount * 100) / 100; 
};
