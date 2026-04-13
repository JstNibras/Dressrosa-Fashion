const Coupon = require('../models/couponModel');

exports.getCouponPage = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.render('admin/coupons', { coupons });
    } catch (error) {
        console.error("Fetch Coupon Error:", error);
        res.status(500).send("Server Error");
    }
};

exports.createCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minPurchaseAmount, expiryDate, maxDiscountAmount } = req.body;

        if (!code || !discountType || !discountValue || !minPurchaseAmount || !expiryDate) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const upperCode = code.toUpperCase().trim();
        const codeRegex = /^[A-Z0-9]{4,15}$/;
        if (!codeRegex.test(upperCode)) {
            return res.status(400).json({ success: false, message: "Coupon code must be 4-15 characters long and contain only letters and numbers." });
        }

        const existingCoupon = await Coupon.findOne({ code: upperCode });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "This coupon code already exists."});
        }

        if (discountType === 'percentage' && discountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
        }

        if (discountType === 'flat' && Number(discountValue) >= Number(minPurchaseAmount)) {
            return res.status(400).json({ success: false, message: "Flat discount value cannot be greater than or equal to the minimum purchase amount." });
        }

        let maxLimit = 0;
        if (discountType === 'percentage') {
            maxLimit = Number(maxDiscountAmount) || 0;
            if (maxLimit <= 0) {
                return res.status(400).json({ success: false, message: "Max discount amount is required for percentage coupons." });
            }
        }

        if (new Date(expiryDate) < new Date()) {
            return res.status(400).json({ success: false, message: "Expiry date cannot be in the past." });
        }

        const newCoupon = new Coupon({
            code: upperCode,
            discountType,
            discountValue: Number(discountValue),
            minPurchaseAmount: Number(minPurchaseAmount),
            maxDiscountAmount: maxLimit,
            expiryDate: new Date(expiryDate)
        });

        await newCoupon.save();

        res.status(200).json({ success: true, message: "Coupon created successfully!" });

    } catch (error) {
        console.error("Create Coupon Error:", error);
        res.status(500).json({ success: false, message: "Server error while creating coupon." });
    }
};

exports.toggleCouponStatus = async (req, res) => {
    try {
        const { couponId } = req.body;
        const coupon = await Coupon.findById(couponId);

        if (!coupon) return res.status(404).json({ success: false, mesage: "Coupon not found."});

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.status(200).json({ success: true, message: `Coupon ${coupon.isActive ? 'Activated' : 'Deactivated'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server eror toggling status." });
    }
}

exports.editCoupon = async (req, res) => {
    try {
        const { couponId, code, discountType, discountValue, minPurchaseAmount, expiryDate, maxDiscountAmount } = req.body;

        if (!code || !discountType || !discountValue || !minPurchaseAmount || !expiryDate) {
            return res.status(400).json({ success: false, message: "all fields are required. "})
        }

        const upperCode = code.toUpperCase().trim();
        const codeRegex = /^[A-Z0-9]{4,15}$/;
        if (!codeRegex.test(upperCode)) {
            return res.status(400).json({ success: false, message: "Coupon code must be 4-15 characters long and contain only letters and numbers." });
        }

        const existingCoupon = await Coupon.findOne({ code: upperCode, _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "This coupon code is already in use." });
        }

        if (discountType === 'percentage' && discountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
        }

        if (discountType === 'flat' && Number(discountValue) >= Number(minPurchaseAmount)) {
            return res.status(400).json({ success: false, message: "Flat discount value cannot be greater than or equal to the minimum purchase amount." });
        }

        let maxLimit = 0;
        if (discountType === 'percentage') {
            maxLimit = Number(maxDiscountAmount) || 0;
            if (maxLimit <= 0) {
                return res.status(400).json({ success: false, message: "Max discount amount is required for percentage coupons." });
            }
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });

        coupon.code = upperCode;
        coupon.discountType = discountType;
        coupon.discountValue = Number(discountValue);
        coupon.minPurchaseAmount = Number(minPurchaseAmount);
        coupon.maxDiscountAmount = maxLimit;
        coupon.expiryDate = new Date(expiryDate);

        await coupon.save();

        res.status(200).json({ success: true, message: "Coupon updated successfully!" });
    } catch (error) {
        console.error("Edit Coupon Error:", error);
        res.status(500).json({ success: false, message: "Server error while updating coupon." });
    }
}