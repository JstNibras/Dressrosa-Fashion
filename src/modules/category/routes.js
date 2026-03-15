const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { upload } = require('../../config/cloudinary');
const { isAdmin, noCache } = require('../../middlewares/auth');

router.get('/admin/categories', isAdmin, noCache, categoryController.getCategories);
router.post('/admin/categories/add', isAdmin, noCache, upload.single('image'), categoryController.postAddCategory);
router.post('/admin/categories/edit/:id', isAdmin, noCache, upload.single('image'), categoryController.postEditCategory);
router.patch('/admin/categories/toggle/:id', isAdmin, noCache, categoryController.toggleCategoryStatus);

module.exports = router;