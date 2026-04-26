const productModel = require('../models/productModel');
const Product = require('../models/productModel');
const { cloudinary } = require('../config/cloudinary');
const { isAborted } = require('zod/v3');

const uploadBufferToCloudinary = async (file) => {
    try {
        const b64 = Buffer.from(file.buffer).toString('base64');
        
        const dataURI = "data:" + file.mimetype + ";base64," + b64;
        
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'Dressrosa/Products', 
            resource_type: 'auto'
        });
        
        return result.secure_url;
    } catch (error) {
        console.error("🔥 Cloudinary Base64 Error:", error);
        throw new Error("Cloudinary upload failed. Please verify your API keys in the .env file.");
    }
};

exports.getAllProductsAdmin = async (queryData = {}) => {
    const { search, status, stock, category, page = 1, limit = 5 } = queryData;
    let filter = {};

    if (search) {
        filter.name = new RegExp(search, 'i');
    }

    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    if (category) {
        filter.category = category;
    }

    let products = await Product.find(filter)
        .populate('category', 'name isActive offerPercentage')
        .sort({ createdAt: -1 });

    if (stock) {
        products = products.filter(product => {
            const activeStock = product.variants
                .filter(v => v.isActive)
                .reduce((acc, v) => acc + v.stock, 0);

            if (stock === 'in_stock') return activeStock > 0;
            if (stock === 'out_of_stock') return activeStock === 0;
            return true;
        });
    }

    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / limit);

    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);

    const paginatedProducts = products.slice(startIndex, endIndex);

    return {
        products: paginatedProducts,
        totalPages,
        currentPage: Number(page),
        totalProducts
    };
};

exports.createProduct = async (productData, files) => {
    console.log("=> 2. Reached Service. Checking duplicates...");
    const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${productData.name}`, 'i')}
    });

    if (existingProduct) {
        throw new Error("A product with this name already exists");
    }
    console.log("=> 3. Starting Cloudinary Buffer Upload...");

    let imageUrls = [];
    if (files) {
        if (files.image1) imageUrls[0] = await uploadBufferToCloudinary(files.image1[0]);
        if (files.image2) imageUrls[1] = await uploadBufferToCloudinary(files.image2[0]);
        if (files.image3) imageUrls[2] = await uploadBufferToCloudinary(files.image3[0]);
        if (files.image4) imageUrls[3] = await uploadBufferToCloudinary(files.image4[0]);

    }
    imageUrls = imageUrls.filter(url => url != null);

    if (imageUrls.length < 4) {
        throw new Error("Exactly 4 product images are required.");
    }

    let parsedVariants = [];
    if (productData.variants) {
        try {
            parsedVariants = JSON.parse(productData.variants);
        } catch (e) {
            throw new Error("Invalid variant data format. Must be valid JSON.");
        }
    }

    const Category = require('../models/categoryModel');
    const categoryDoc = await Category.findById(productData.category);
    const catOffer = categoryDoc ? (categoryDoc.offerPercentage || 0) : 0;
    const prodOffer = Number(productData.offerPercentage) || 0;

    const effectiveDiscount = Math.max(catOffer, prodOffer);

    const regularPrice = Number(productData.regularPrice);
    const salePrice = Math.round(regularPrice - (regularPrice * effectiveDiscount / 100));

    const newProduct = new Product({
        name: productData.name,
        description: productData.description,
        category: productData.category,
        regularPrice: regularPrice,
        offerPercentage: prodOffer,
        salePrice: salePrice,
        variants: parsedVariants,
        images: imageUrls
    });

    return await newProduct.save();
};

exports.updateProduct = async (productId, productData, files) => {
    const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${productData.name}$`, 'i') },
        _id: { $ne: productId }
    });

    if (existingProduct) {
        throw new Error("Another product with this name already exists");
    }

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    let updatedImages = [...product.images];
    
    if (files) {
        if (files.image1) updatedImages[0] = await uploadBufferToCloudinary(files.image1[0]);
        if (files.image2) updatedImages[1] = await uploadBufferToCloudinary(files.image2[0]);
        if (files.image3) updatedImages[2] = await uploadBufferToCloudinary(files.image3[0]);
        if (files.image4) updatedImages[3] = await uploadBufferToCloudinary(files.image4[0]);
    }

    product.images = updatedImages.filter(url => url != null);

    if (product.images.length < 4) {
        throw new Error("Exactly 4 product images are required.");
    }

    let parsedVariants = [];
    if (productData.variants) {
        try {
            parsedVariants = JSON.parse(productData.variants);
        } catch (e) {
            throw new Error("Invalid variant data format.");
        }
    }

    const updatedVariants = parsedVariants.map(v => {
        const variantDoc = {
            size: v.size,
            color: v.color,
            stock: v.stock,
            isActive: v.isActive
        };

        if (v.id && v.id.length === 24) {
            variantDoc._id = v.id;
        }
        return variantDoc;
    })

    const Category = require('../models/categoryModel');
    const categoryDoc = await Category.findById(productData.category);
    const catOffer = categoryDoc ? (categoryDoc.offerPercentage || 0) : 0;
    const prodOffer = Number(productData.offerPercentage) || 0;

    const effectiveDiscount = Math.max(catOffer, prodOffer);
    const regularPrice = Number(productData.regularPrice);
    const salePrice = Math.round(regularPrice - (regularPrice * effectiveDiscount / 100));

    product.name = productData.name;
    product.description = productData.description;
    product.category = productData.category;
    product.regularPrice = regularPrice;
    product.offerPercentage = prodOffer;
    product.salePrice = salePrice;
    product.variants = updatedVariants;

    return await product.save();
}

exports.toggleProductStatus = async (productId) => {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    product.isActive = !product.isActive;
    return await product.save();
};

exports.getStorefrontProducts = async (queryData = {}) => {
    const { search, category, minPrice, maxPrice, sort, page = 1, limit = 9 } = queryData;

    let filter = { isActive: true };

    const Category = require('../models/categoryModel');
    const activeCategories = await Category.find({ isActive: true }).select('_id name');
    const activeCategoryIds = activeCategories.map(cat => cat._id);

    if (category) {
        if (activeCategoryIds.some(id => id.toString() === category)) {
            filter.category = category;
        } else {
            filter.category = null;
        }
    } else {
        filter.category = { $in: activeCategoryIds };
    }

    if (search) {
        filter.name = new RegExp(search.trim(), 'i');
    }

    if (minPrice || maxPrice) {
        filter.salePrice = {};
        if (minPrice) filter.salePrice.$gte = Number(minPrice);
        if (maxPrice) filter.salePrice.$lte = Number(maxPrice);
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { salePrice: 1 };
    if (sort === 'price_desc') sortOption = { salePrice: -1 };
    if (sort === 'az') sortOption = { name: 1 };
    if (sort === 'za') sortOption = { name: -1 }; 

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(filter)
        .populate('category', 'name offerPercentage')
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

    return {
        products,
        totalPages,
        currentPage: Number(page),
        totalProducts,
        activeCategories
    };
};