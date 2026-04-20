const Coupon = require('../models/couponModel');
const { couponSchema } = require('../utils/validators');

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
        const { code, discountType, discountValue, minPurchaseAmount, expiryDate, maxDiscountAmount, totalUsageLimit } = req.body;

        const validationData = {
            code: code.toUpperCase().trim(),
            discountType,
            discountValue: Number(discountValue),
            minPurchaseAmount: Number(minPurchaseAmount),
            maxDiscountAmount: Number(maxDiscountAmount) || 0,
            expiryDate,
            totalUsageLimit: Number(totalUsageLimit) || 0
        };

        const validation = couponSchema.safeParse(validationData);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return res.status(400).json({ success: false, errors });
        }

        const upperCode = validation.data.code;
        const existingCoupon = await Coupon.findOne({ code: upperCode });
        if (existingCoupon) {
            return res.status(400).json({ success: false, errors: { code: ["This coupon code already exists."] } });
        }

        const newCoupon = new Coupon({
            ...validation.data
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
        const { couponId, code, discountType, discountValue, minPurchaseAmount, expiryDate, maxDiscountAmount, totalUsageLimit } = req.body;

        const validationData = {
            code: code.toUpperCase().trim(),
            discountType,
            discountValue: Number(discountValue),
            minPurchaseAmount: Number(minPurchaseAmount),
            maxDiscountAmount: Number(maxDiscountAmount) || 0,
            expiryDate,
            totalUsageLimit: Number(totalUsageLimit) || 0
        };

        const validation = couponSchema.safeParse(validationData);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return res.status(400).json({ success: false, errors });
        }

        const upperCode = validation.data.code;
        const existingCoupon = await Coupon.findOne({ code: upperCode, _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.status(400).json({ success: false, errors: { code: ["This coupon code is already in use."] } });
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });

        Object.assign(coupon, validation.data);
        await coupon.save();

        res.status(200).json({ success: true, message: "Coupon updated successfully!" });
    } catch (error) {
        console.error("Edit Coupon Error:", error);
        res.status(500).json({ success: false, message: "Server error while updating coupon." });
    }
}