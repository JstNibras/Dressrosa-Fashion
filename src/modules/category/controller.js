const Category = require('./categoryModel');

exports.getCategories = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const statusFilter = req.query.status || 'all';

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        let query = {};

        if (searchQuery.trim() !== '') {
            query.name = { $regex: new RegExp(searchQuery.trim(), 'i')};
        }

        if (statusFilter === 'active') {
            query.isActive = true;
        } else if (statusFilter === 'inactive') {
            query.isActive = false;
        }

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        res.render('admin/categories', {
            categories,
            searchQuery,
            statusFilter,
            currentPage: page,
            totalPages: totalPages,
            title: 'Category Management',
            activePage: 'categories'
        });
    } catch (error) {
        console.error("Fetch Categories Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.postAddCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Category already exists!"});
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = req.file.url || req.file.path;
        }

        const newCategory = new Category({
            name,
            description,
            image: imageUrl
        });

        await newCategory.save();
        res.status(200).json({ success: true, message: "Category created successfully!"});
    } catch (error) {
        console.error("Add Category Error:", error);
        res.status(500).json({ success: false, message: "Failed to create category." });
    }
}

exports.postEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, description } = req.body;

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: categoryId }
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Another category with this name already exists!" });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        let newImageUrl = category.image;

        if (req.file) {
            newImageUrl = req.file.url || req.file.path;

            if (category.image && !category.image.includes('default-category')) {
                try {
                    const urlParts = category.image.split('/');
                    const publicId = urlParts.slice(-2).join('/').split('.')[0];
                    await cloudinary.uploader.destroy(publicId);
                } catch (cleanupErr) {
                    console.error("Cloudinar old image cleanuo failed:", cleanupErr);
                }
            }
        }

        category.name = name;
        category.description = description;
        category.image = newImageUrl
        
        await category.save();

        res.status(200).json({ success: true, message: "Category updated successfully!" });
    } catch (error) {
        console.error("Edit Category Error:", error);
        res.status(500).json({ success: false, message: "Failed to update category." });
    }
};

exports.toggleCategoryStatus = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);

        if (!category) return res.status(404).json({ success: false, message: "Category not found" });

        category.isActive = !category.isActive;
        await category.save();

        res.status(200).json({
            success: true,
            message: `Category ${category.isActive ? 'Activated' : 'Deactivated'}!`,
            isActive: category.isActive
        });
    } catch (error) {
        console.error("Toggle Status Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};