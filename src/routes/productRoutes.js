const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { isAdmin, noCache} = require('../middlewares/auth');

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const productUpload = upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]);

const safeProductUpload = (req, res, next) => {
    productUpload(req, res, (err) => {
        if (err) {
            console.error("🔥 Product Multer Error:", err.message);
            return res.status(400).json({ success: false, message: "Image upload failed." });
        }
        next();
    });
};

router.get('/admin/products',isAdmin, noCache, productController.getProducts);

router.post('/admin/products/add', isAdmin, noCache, safeProductUpload, productController.postAddProduct);
router.post('/admin/products/edit/:id',isAdmin, noCache, safeProductUpload, productController.postEditProduct);

router.patch('/admin/products/toggle/:id', productController.patchToggleProduct);

module.exports = router;