exports.isUser = async (req, res, next) => {
    if (req.session.user) {
        const User = require('../models/userModel');
        const user = await User.findById(req.session.user.id);
        
        if (user && !user.isBlocked) {
            next();
        } else {
            req.session.destroy();
            res.redirect('/login?error=Account Blocked');
        }
    } else {
        res.redirect('/login');
    }
};

exports.isAdmin = (req, res, next) => {
    if (req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

exports.adminLogout = (req, res) => {
    req.session.destroy((err) => {
        if(err) return res.redirect('/admin/users');
        res.clearCookie('connect.sid');
        res.redirect('/admin/login')
    })
}

exports.noCache = (req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
};

exports.canAccessOTP = (req, res, next) => {
    if (req.session.otp && req.session.otpType && req.session.otpExpiry) {
        if (Date.now() < req.session.otpExpiry) {
            return next(); 
        }
    }
    
    console.log("Unauthorized OTP page access blocked.");
    res.redirect('/'); 
};