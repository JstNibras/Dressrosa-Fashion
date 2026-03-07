const express = require('express');
const router = express.Router();
const adminController = require('./controller');
const { isAdmin, noCache, adminLogout } = require('../../middlewares/auth');

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

module.exports = router;