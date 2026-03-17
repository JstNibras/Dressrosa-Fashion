const express = require('express');
const router = express.Router();
const productController = require('./controller');
const multer = require('multer');
const { isAdmin, noCache } = require('../../middlewares/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const imageUploadFields = upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
])

router.get('/admin/products',isAdmin, noCache, productController.getProducts);

router.post('/admin/products/add', isAdmin, noCache, imageUploadFields, productController.postAddProduct);
router.post('/admin/products/edit/:id',isAdmin, noCache, imageUploadFields, productController.postEditProduct);

router.patch('/admin/products/toggle/:id', productController.patchToggleProduct);

module.exports = router;