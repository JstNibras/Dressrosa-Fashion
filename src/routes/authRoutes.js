const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { noCache } = require('../middlewares/auth');
const { isUser } = require('../middlewares/auth');
const { canAccessOTP } = require('../middlewares/auth');
const passport = require('passport');
const { upload } = require('../config/cloudinary');
const userController = require('../controllers/authController');


const shopController = require('../controllers/shopController');

router.get('/', noCache, shopController.getHomePage);

router.get('/login', noCache, (req, res) => {
    if (req.session.user) {
        return res.redirect('/'); 
    }
    res.render('user/login', { error: null });
});

router.get('/verify-otp', canAccessOTP, (req, res) => {
    let timeLeft = 120;
    if (req.session.otpExpiry) {
        timeLeft = Math.max(0, Math.floor((req.session.otpExpiry - Date.now()) / 1000));
    }
    res.render('user/verify-otp', { error: null, timeLeft });
});

router.get('/signup', noCache, (req, res) => {
    res.render('user/signup', { errors: {}, oldData: {} });
});

router.get('/forgot-password', (req, res) => {
    res.render('user/forgot-password', { errors: {}, oldData: {} });
});

router.get('/new-password', (req, res) => {
    console.log("Session Status:", req.session);
    if (req.session.isOtpVerified) {
        res.render('user/new-password', { errors: {}, oldData: {} });
    } else {
        console.log("Access Denied: Redirecting to forgot-password");
        res.redirect('/forgot-password')
    }
});

router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        req.session.user = {
            id: req.user._id || req.user.id,
            name: req.user.firstName || req.user.name,
            email: req.user.email
        };
        req.session.save((err) => {
            if (err) {
                console.error("Session Save Error:", err);
                return res.redirect('/login');
            }
            console.log("Session saved. User logged in:", req.user.email);
            res.redirect('/');
        });
    }
);


router.post('/signup', authController.signup);
router.post('/login', authController.login);

router.post('/verify-otp', authController.verifyOtp);
router.post('/forgot-password', authController.forgotPasswordRequest);
router.post('/reset-password', authController.resetPassword);
router.post('/profile/update-image', upload.single('profileImage'), userController.updateProfileImage);
router.post('/profile/remove-image', userController.removeProfileImage);
router.post('/profile/change-email-request', isUser, authController.changeEmailRequest);
router.post('/resend-otp', authController.resendOtp);


router.post('/logout', authController.logout);



module.exports = router;