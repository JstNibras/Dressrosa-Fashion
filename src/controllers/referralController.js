const User = require('../models/userModel');

exports.getReferralPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const user = await User.findById(userId);

        if (!user) return res.redirect('/login');

        res.render('user/referral', { user });
    } catch (error) {
        console.error("Referral Page Error:", error);
        res.redirect('/profile?error=ServerError');
    }
};