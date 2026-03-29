const mongoose = require('mongoose');
const slugify = require('slugify');
const { tr } = require('zod/locales');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    image: {
        type: String,
        default: null 
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

categorySchema.pre('validate', function() {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
            trim: true
        });
    }
});

module.exports = mongoose.model('Category', categorySchema);