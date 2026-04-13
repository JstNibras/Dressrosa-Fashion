const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, required: true, unique: true },

    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        image: String,
        price: Number,
        size: String,
        quantity: Number,
        itemTotal: Number,
        itemStatus: { 
            type: String, 
            enum: ['Placed', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned', 'Return Rejected'], 
            default: 'Placed' 
        },
        cancellationReason: { type: String, default: null},
        returnReason: { type: String, default: null },
        adminRejectReason: { type: String, default: null }
    }],

    shippingAddress: {
        name: String,
        street: String,
        city: String,
        district: String,
        state: String,
        pincode: String,
        phone: String
    },

    pricing: {
        subtotal: Number,
        shipping: Number,
        discount: { type: Number, default: 0},
        total: Number
    },

    paymentMethod: { type: String, enum: ['COD', 'RAZORPAY', 'WALLET', 'MOCK_ONLINE'], required: true },
    paymentStatus: { type: String, enum: ['Pending', 'Completed', 'Failed', 'Refunded'], default: 'Pending' },
    orderStatus: { type: String, enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'], default: 'Processing' }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);