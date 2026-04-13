const orderService = require('../services/orderService');

exports.getAdminOrdersPage = async (req, res) => {
    try {
        const { search, status, sort, page } = req.query;

        const result = await orderService.getAllOrdersForAdmin({
            search, status, sort, page 
        });

        res.render('admin/orders', {
            orders: result.orders,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalOrders: result.totalOrders,
            query: req.query
        });
    } catch (error) {
        console.error("Admin Orders Controller Error:", error);
        res.status(500).send("Internal Server Error loading orders.");
    }
};

exports.patchOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { newStatus } = req.body;

        const updatedOrder = await orderService.updateOrderStatusAdmin(orderId, newStatus);

        res.status(200).json({
            success: true,
            message: `Order ${orderId} successfully marked as ${newStatus}`,
            orderStatus: updatedOrder.orderStatus
        });
    } catch (error) {
        console.error("Status Update Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getAdminOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const Order = require('../models/orderModel');

        const order = await Order.findOne({ orderId: orderId }).populate('user');
        if (!order) return res.redirect('/admin/orders?error=OrderNotFound');

        res.render('admin/order-details', { order });
    } catch (error) {
        console.error("Admin Order Details Error:", error);
        res.redirect('/admin/orders?error=ServerError');
    }
}

exports.patchOrderItemStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { newStatus } = req.body;

        await orderService.updateOrderItemStatusAdmin(orderId, itemId, newStatus);

        res.status(200).json({ 
            success: true, 
            message: `Item status successfully updated to ${newStatus}`
        });
    } catch (error) {
        console.error("Item Status Update Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.postProcessReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { action, rejectReason } = req.body;

        await orderService.processReturnRequestAdmin(orderId, itemId, action, rejectReason);

        res.status(200).json({
            success: true,
            message: `Return request successfully ${action}d.`
        });
    } catch (error) {
        console.error("Return Process Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};