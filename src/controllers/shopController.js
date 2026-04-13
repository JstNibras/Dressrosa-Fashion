const productService = require('../services/productService');

exports.getShopPage = async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, sort, page } = req.query;

        const shopData = await productService.getStorefrontProducts({
            search, category, minPrice, maxPrice, sort, page
        });

        res.render('user/shop', {
            products: shopData.products,
            categories: shopData.activeCategories,
            totalPages: shopData.totalPages,
            currentPage: shopData.currentPage,
            totalProducts: shopData.totalProducts,
            query: req.query
        });
    } catch (error) {
        console.error("Shop Page Error:", error);
        res.status(500).send("Server Error Loading Shop");
    }
};

exports.getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;

        const Product = require('../models/productModel');
        const product = await Product.findById(productId).populate('category');

        if (!product || !product.isActive || !product.category || !product.category.isActive) {
            return res.redirect('/shop');
        }

        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id},
            isActive: true
        }).limit(4);

        const totalStock = product.variants
            .filter(v => v.isActive)
            .reduce((sum, v) => sum + v.stock, 0);

        res.render('user/product', {
            product,
            relatedProducts,
            totalStock
        });
    } catch (error) {
        console.error("Product Details Error:", error);
        res.redirect('/shop'); 
    }
};

exports.getQuickViewProduct = async (req, res) => {
    try {

        const Product = require('../models/productModel');
        const product = await Product.findById(req.params.id).select('name images salePrice regularPrice variants offerPercentage').populate('category', 'offerPercentage');

        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        res.status(200).json({ success: true, product });

    } catch (error) {
        console.error("Quick View Error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}