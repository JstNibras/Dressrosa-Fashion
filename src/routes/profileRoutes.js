const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const walletController = require('../controllers/walletController');
const { noCache, isUser } = require('../middlewares/auth');

// Profile 
router.get('/profile', isUser, noCache, profileController.getProfile);
router.get('/profile/edit', isUser, noCache, profileController.getEditProfile);
router.post('/profile/edit', isUser, noCache, profileController.postEditProfile);
router.get('/profile/change-password', isUser, noCache, profileController.getChangePassword);
router.post('/profile/change-password', isUser, noCache, profileController.postChangePassword);

// Address 
router.get('/profile/addresses', isUser, noCache, profileController.getAddresses);
router.get('/profile/address/add', isUser, noCache, profileController.getAddAddress);
router.post('/profile/address/add', isUser, noCache, profileController.postAddAddress);
router.get('/profile/address/edit/:id', isUser, noCache, profileController.getEditAddress);
router.post('/profile/address/edit/:id', isUser, noCache, profileController.postEditAddress);
router.post('/profile/address/delete/:id', isUser, noCache, profileController.postDeleteAddress);
router.post('/profile/address/default/:id', isUser, profileController.setDefaultAddress);

// Wallet
router.get('/wallet', isUser, noCache, walletController.getWalletPage);

module.exports = router;
