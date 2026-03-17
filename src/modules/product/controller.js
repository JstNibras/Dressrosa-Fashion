const productService = require('./productService');
const Category = require('../category/categoryModel');

exports.getProducts = async (req, res) => {
    try {
        const { search, status, stock, category, page } = req.query;

        const result = await productService.getAllProductsAdmin({ search, status, stock, category, page });

        const Category = require('../category/categoryModel');
        const categories = await Category.find({ isActive: true });

        res.render('admin/products', {
            products: result.products, 
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            categories,
            query: req.query
        });
    } catch (error) {
        console.error("Fetch Product Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.postAddProduct = async (req, res) => {
    console.log("=> 1. Reached Controller! Files parsed:", req.files ? Object.keys(req.files) : "None");

    try {
        await productService.createProduct(req.body, req.files);
        console.log("=> 4. Service Finished. Sending Response!");
        res.status(200).json({ success: true, message: "Product created successfully!" });
    } catch (error) {
        console.error("Add Product Error:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to create product." });
    }
}

exports.postEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        await productService.updateProduct(productId, req.body, req.files);
        res.status(200).json({ success: true, message: "Product updated successfully!" });
    } catch (error) {
        console.error("Edit Product Error:", error.message);
        res.status(400).json({ success: false, message: error.message || "Failed to update product." });
    }
};

exports.patchToggleProduct = async (req, res) => {
    try {
        const updatedProduct = await productService.toggleProductStatus(req.params.id);
        const action = updatedProduct.isActive ? "restored" : "deleted";
        res.status(200).json({ success: true, message: `Product safely ${action}.`, isActive: updatedProduct.isActive });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};