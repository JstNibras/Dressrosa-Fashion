const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { isAdmin, noCache } = require('../../middlewares/auth');

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const safeUpload = (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error("🔥 Category Multer Error:", err.message);
            return res.status(400).json({ success: false, message: "File upload interrupted." });
        }
        next();
    });
};

router.get('/admin/categories', isAdmin, noCache, categoryController.getCategories);
router.post('/admin/categories/add', isAdmin, noCache, safeUpload, categoryController.postAddCategory);
router.post('/admin/categories/edit/:id', isAdmin, noCache, safeUpload, categoryController.postEditCategory);
router.patch('/admin/categories/toggle/:id', isAdmin, noCache, categoryController.toggleCategoryStatus);

module.exports = router;