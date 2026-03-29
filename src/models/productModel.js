const mongoose = require('mongoose');
const slugify = require('slugify');

const variantSchema = new mongoose.Schema({
    size: {
        type: String,
        required: false,
        trim: true
    },
    color: {
        type: String,
        required: false,
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    isActive: { 
        type: Boolean, default: true 
    }
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    regularPrice: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        min: 0,
        default: function() { return this.regularPrice; }
    },
    variants: [variantSchema],
    images: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

productSchema.pre('validate', function() {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, { lower: true, strict: true, trim: true });
    }
});

module.exports = mongoose.model('Product', productSchema);