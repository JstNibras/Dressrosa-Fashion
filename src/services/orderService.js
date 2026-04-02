const Order = require('../models/orderModel');
const Product = require('../models/productModel');

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
    const order = await Order.findOne({ orderId: orderId, user: userId });
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found in order");
    if (item.itemStatus === 'Delivered' || item.itemStatus === 'Cancelled' || item.itemStatus === 'Returned') {
        throw new Error(`Item cannot be cancelled because it is currently ${item.itemStatus}`);
    }

    item.itemStatus = 'Cancelled';
    item.cancellationReason = reason || 'No reason provided';

    await Product.updateOne(
        { _id: item.productId, "variants.size": item.size },
        { $inc: { "variants.$.stock": item.quantity } }
    );

    const allCancelled = order.items.every(i => i.itemStatus === 'Cancelled');
    if (allCancelled) order.orderStatus = 'Cancelled';

    await order.save();
    return order;
}

exports.returnOrderItem = async (orderId, itemId, userId, reason) => {
    if (!reason || reason.trim() === '') throw new Error("Return reason is mandatory");

    const order = await Order.findOne({ orderId: orderId, user: userId });
    if (!order || order.orderStatus !== 'Delivered') throw new Error("Only delivered orders can be returned");

    const item = order.items.id(itemId);
    if (item.itemStatus !== 'Delivered') {
        throw new Error("You can only return an item after it has been Delivered.");
    }    

    item.itemStatus = 'Returned';
    item.returnReason = reason;

    const allReturned = order.item.every(i => i.itemStatus === 'Returned' || i.itemStatus === 'Cancelled');
    if (allReturned) order.orderStatus = 'Returned';

    await order.save();
    return order;
}