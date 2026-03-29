const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        size: {
            type: String,
            required: true
        },
        color: {
            type: String
        },
        quantity: {
            type: Number,
            required: true,
            default: 1,
            min: [1, 'Quantity cannot be less than 1'],
            max: [5, 'Maximum 5 units allowed per item']
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);