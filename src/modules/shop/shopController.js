const productService = require('../product/productService');

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