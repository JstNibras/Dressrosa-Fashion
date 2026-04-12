const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminOrderController = require('../controllers/adminOrderController'); 
const adminCouponController = require('../controllers/adminCouponController');
const adminDashboardController = require('../controllers/adminDashboardController');
const { isAdmin, noCache, adminLogout } = require('../middlewares/auth');

router.get('/admin/login', noCache, (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/users');
    }
    res.render('admin/login', { layout: 'layout/header-minimal' });
});

router.get('/admin/users', isAdmin, noCache, adminController.getUsers);
router.post('/admin/login', adminController.postAdminLogin);
router.post('/admin/users/toggle/:id', isAdmin, adminController.toggleUserStatus);
router.get('/admin/logout', adminLogout);

router.get('/admin/orders', isAdmin, adminOrderController.getAdminOrdersPage);
router.get('/admin/orders/:orderId', isAdmin, adminOrderController.getAdminOrderDetails);
router.patch('/admin/orders/:orderId/status', isAdmin, adminOrderController.patchOrderStatus);
router.patch('/admin/orders/:orderId/item/:itemId/status', isAdmin, adminOrderController.patchOrderItemStatus);
router.post('/admin/orders/:orderId/item/:itemId/return', isAdmin, adminOrderController.postProcessReturn);

router.get('/admin/coupons', isAdmin, adminCouponController.getCouponPage);
router.post('/admin/coupons/add', isAdmin, adminCouponController.createCoupon);
router.post('/admin/coupons/toggle', isAdmin, adminCouponController.toggleCouponStatus);
router.post('/admin/coupons/edit', isAdmin, adminCouponController.editCoupon);

router.get('/admin/dashboard', isAdmin, noCache, adminDashboardController.getDashboard);

module.exports = router;