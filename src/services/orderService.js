const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const walletService = require('./walletService');
const { prependListener } = require('pdfkit');

exports.getUserOrders = async (userId, searchQuery = '', page = 1, limit = 5) => {
    try {
        let filter = { user: userId };

        if (searchQuery) {
            const safeSearch = String(searchQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            const searchRegex = new RegExp(safeSearch, 'i');
            
            filter.$or = [
                { orderId: searchRegex },
                { 'items.name': searchRegex }
            ];
        }

        const skip = (page - 1) * limit;
        const totalOrders = await Order.countDocuments(filter);

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return {
            orders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders
        };
    } catch (error) {
        console.error("\n🔥 DATABASE SEARCH ERROR:", error);
        throw new Error("Failed to fetch orders");
    }
};

exports.getOrderDetails = async (orderId, userId) => {
    const order = await Order.findOne({ orderId: orderId, user: userId });
    if (!order) throw new Error("Order not found");
    return order;
};

exports.cancelOrderItem = async (orderId, itemId, userId, reason) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findOne({ orderId: orderId, user: userId }).session(session);
        if (!order) throw new Error("Order not found");

        const item = order.items.id(itemId);
        if (!item) throw new Error("Item not found in order");
        
        if (['Shipped', 'Delivered', 'Cancelled', 'Returned'].includes(item.itemStatus)) {
            throw new Error(`Item cannot be cancelled because it is currently ${item.itemStatus}`);
        }

        item.itemStatus = 'Cancelled';
        item.cancellationReason = reason || 'User requested cancellation';

        order.markModified('items');

        const activeItems = order.items.filter(i => i.itemStatus !== 'Cancelled' && i.itemStatus !== 'Returned');

        if (activeItems.length === 0) {
            const hasReturned = order.items.some(i => i.itemStatus === 'Returned');
            order.orderStatus = hasReturned ? 'Returned' : 'Cancelled';
        } else {
            const allDelivered = activeItems.every(i => ['Delivered', 'Return Requested', 'Return Rejected'].includes(i.itemStatus));
            const anyShipped = activeItems.some(i => i.itemStatus === 'Shipped');

            if (allDelivered) order.orderStatus = 'Delivered';
            else if (anyShipped) order.orderStatus = 'Shipped';
            else order.orderStatus = 'Processing';
        }

        await Product.updateOne(
            { _id: item.productId, "variants.size": item.size },
            { $inc: { "variants.$.stock": item.quantity } },
            { session }
        );

        const method = order?.paymentMethod;
        const status = order?.paymentStatus;

        if (method === 'RAZORPAY' || method === 'WALLET') {
            if (status === 'Completed') {
                
                let refundAmount = item.itemTotal;

                if (order.pricing && order.pricing.discount > 0) {
                    const itemProportion = item.itemTotal / order.pricing.subtotal;
                    const itemDiscount = order.pricing.discount * itemProportion;

                    refundAmount = Math.round((item.itemTotal - itemDiscount) * 100) / 100;
                }

                await walletService.creditWallet(
                    userId,
                    refundAmount,
                    `Refund for Cancelled Item in Order #${order.orderId}`,
                    session
                );
            }
        }

        const allCancelled = order.items.every(i => i.itemStatus === 'Cancelled');
        if (allCancelled) order.orderStatus = 'Cancelled';

        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        return order;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Cancellation Transaction Aborted:", error);
        throw new Error(error.message || "Failed to process cancellation.");
    }
}

exports.returnOrderItem = async (orderId, itemId, userId, reason) => {
    if (!reason || reason.trim() === '') throw new Error("Return reason is mandatory");

    const order = await Order.findOne({ orderId: orderId, user: userId });
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item || item.itemStatus !== 'Delivered') throw new Error("Only delivered items can be returned");  

    item.itemStatus = 'Return Requested';
    item.returnReason = reason;

    await order.save();
    return order;
}

exports.getAllOrdersForAdmin = async (queryData = {}) => {
    try {
        const { search, status, sort, page = 1, limit = 10 } = queryData;
        let filter = {};

        if (search) {
            const safeSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(safeSearch, 'i');
            filter.$or = [
                { orderId: searchRegex },
                { 'shippingAddress.name': searchRegex }
            ];
        }

        if (status && status !== 'all') {
            filter.orderStatus = status;
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'date_asc') sortOption = { createdAt: 1 };
        if (sort === 'total_desc') sortOption = { 'pricing.total': -1};
        if (sort === 'total_asc') sortOption = { 'pricing.total': 1 };

        const skip = (Number(page) - 1) * Number(limit);
        const totalOrders = await Order.countDocuments(filter);

        const orders = await Order.find(filter)
            .populate('user', 'firstName lastName email mobile')
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        return {
            orders,
            currentPage: Number(page),
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders
        };
    } catch (error) {
        console.error("Admin Order Fetch Error:", error);
        throw new Error("Failed to fetch admin orders.");
    }
};

exports.updateOrderStatusAdmin = async (orderId, newStatus) => {
    try {
        const order = await Order.findOne({ orderId: orderId });
        if (!order) throw new Error("Order not found");
 
        order.orderStatus = newStatus;

        order.items.forEach(item => {
            if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                item.itemStatus = newStatus;
            }
        });

        await order.save();
        return order;
    } catch (error) {
        throw new Error("Failed to update order status.");
    }
};

exports.updateOrderItemStatusAdmin = async (orderId, itemId, newStatus) => {
    try {
        const order = await Order.findOne({ orderId: orderId });
        if (!order) throw new Error("Order not found");

        const item = order.items.id(itemId);
        if (!item) throw new Error("Item not found in order");

        if (item.itemStatus === 'Placed' && newStatus !== 'Shipped' && newStatus !== 'Cancelled') {
            throw new Error("A Placed item can only be marked as Shipped.");
        }
        if (item.itemStatus === 'Shipped' && newStatus !== 'Delivered' && newStatus !== 'Returned') {
            throw new Error("A Shipped item can only be marked as Delivered.");
        }
        if (['Delivered', 'Cancelled', 'Returned'].includes(item.itemStatus)) {
            throw new Error(`Item is already ${item.itemStatus} and cannot be modified further.`);
        }

        item.itemStatus = newStatus;

        order.markModified('items');

        const activeItems = order.items.filter(i => i.itemStatus !== 'Cancelled' && i.itemStatus !== 'Returned');

        if (activeItems.length === 0) {
            const hasReturned = order.items.some(i => i.itemStatus === 'Returned');
            order.orderStatus = hasReturned ? 'Returned' : 'Cancelled';
        } else {
            const allDelivered = activeItems.every(i => ['Delivered', 'Return Requested', 'Return Rejected'].includes(i.itemStatus));
            const anyShipped = activeItems.some(i => i.itemStatus === 'Shipped');

            if (allDelivered) {
                order.orderStatus = 'Delivered';
            } else if (anyShipped) {
                order.orderStatus = 'Shipped';
            } else {
                order.orderStatus = 'Processing';
            }
        }

        await order.save();
        return { order, item };
    } catch (error) {
        throw new Error(error.message || "Failed to update item status.");
    }
};

exports.processReturnRequestAdmin = async (orderId, itemId, action, rejectReason) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const order = await Order.findOne({ orderId: orderId }).session(session);
        if (!order) throw new Error("Order not found");

        const item = order.items.id(itemId);
        if (!item || item.itemStatus !== 'Return Requested') throw new Error("No pending return request for this item");

        if (action === 'approve') {
            item.itemStatus = 'Returned';

            const Product = require('../models/productModel');
            const prodId = item.product || item.productId;

            if (prodId) {
                await Product.updateOne(
                    { _id: prodId, "variants.size": item.size },
                    { $inc: { "variants.$.stock": item.quantity } },
                    { session }
                );
            }

            const walletService = require('./walletService');
            let refundAmount = item.itemTotal;

            if (order.pricing && order.pricing.discount > 0) {
                const itemProportion = item.itemTotal / order.pricing.subtotal;
                const itemDiscount = order.pricing.discount * itemProportion;
                refundAmount = Math.round((item.itemTotal - itemDiscount) * 100) / 100;
            }

            await walletService.creditWallet(
                order.user,
                refundAmount,
                `Refund for Returned Item in Order #${order.orderId}`,
                session
            );
            
        } else if (action === 'reject') {
            if (!rejectReason || rejectReason.trim() === '') throw new Error("Rejection reason is required.");
            item.itemStatus = 'Return Rejected';
            item.adminRejectReason = rejectReason;
        }

        order.markModified('items');

        const activeItems = order.items.filter(i => i.itemStatus !== 'Cancelled' && i.itemStatus !== 'Returned');

        if (activeItems.length === 0) {
            const hasReturned = order.items.some(i => i.itemStatus === 'Returned');
            order.orderStatus = hasReturned ? 'Returned' : 'Cancelled';
        } else {
            const allDelivered = activeItems.every(i => ['Delivered', 'Return Requested', 'Return Rejected'].includes(i.itemStatus));
            const anyShipped = activeItems.some(i => i.itemStatus === 'Shipped');

            if (allDelivered) {
                order.orderStatus = 'Delivered';
            } else if (anyShipped) {
                order.orderStatus = 'Shipped';
            } else {
                order.orderStatus = 'Processing';
            }
        }

        await order.save({ session });
        await session.commitTransaction();
        session.endSession();

        return item;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Return Process Database Error:", error);
        throw new Error(error.message || "Database failed to process the return.");
    }
}

