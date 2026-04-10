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
        const { code, discountType, discountValue, minPurchaseAmount, expiryDate } = req.body;

        if (!code || !discountType || !discountValue || !minPurchaseAmount || !expiryDate) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const upperCode = code.toUpperCase().trim();

        const existingCoupon = await Coupon.findOne({ code: upperCode });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "This coupon code already exists."});
        }

        if (discountType === 'percentage' && discountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
        }

        if (new Date(expiryDate) < new Date()) {
            return res.status(400).json({ success: false, message: "Expiry date cannot be in the past." });
        }

        const newCoupon = new Coupon({
            code: upperCode,
            discountType,
            discountValue: Number(discountValue),
            minPurchaseAmount: Number(minPurchaseAmount),
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
        const { couponId, code, discountType, discountValue, minPurchaseAmount, expiryDate } = req.body;

        if (!code || !discountType || !discountValue || !minPurchaseAmount || !expiryDate) {
            return res.status(400).json({ success: false, message: "all fields are required. "})
        }

        const upperCode = code.toUpperCase().trim();

        const existingCoupon = await Coupon.findOne({ code: upperCode, _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "This coupon code is already in use." });
        }

        if (discountType === 'percentage' && discountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });

        coupon.code = upperCode;
        coupon.discountType = discountType;
        coupon.discountValue = Number(discountValue);
        coupon.minPurchaseAmount = Number(minPurchaseAmount);
        coupon.expiryDate = new Date(expiryDate);

        await coupon.save();

        res.status(200).json({ success: true, message: "Coupon updated successfully!" });
    } catch (error) {
        console.error("Edit Coupon Error:", error);
        res.status(500).json({ success: false, message: "Server error while updating coupon." });
    }
}