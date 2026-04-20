const orderService = require('../services/orderService');
const Order = require('../models/orderModel');
const PDFDocument = require('pdfkit');
const path = require('path');

exports.getOrdersPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';

        const result = await orderService.getUserOrders(userId, search, page, 5);

        res.render('user/orders', {
            orders: result.orders,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            searchQuery: search
        });
    } catch (error) {
        console.error("Fetch Orders Error:", error);
        res.redirect('/profile?error=Failed to load orders');
    }
};

exports.cancelItem = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { orderId, itemId, reason } = req.body;

        await orderService.cancelOrderItem(orderId, itemId, userId, reason);
        res.status(200).json({ success: true, message: "Item successfully cancelled. Stock restored." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.returnItem = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { orderId, itemId, reason } = req.body;

        await orderService.returnOrderItem(orderId, itemId, userId, reason);
        res.status(200).json({ success: true, message: "Return request submitted successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.downloadInvoice = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { orderId, itemId } = req.params;

        const order = await Order.findOne({ orderId: orderId, user: userId });
        if (!order) return res.status(404).send("Order not found");

        const item = order.items.id(itemId);
        if (!item) return res.status(404).send("Item not found");

        if (item.itemStatus !== 'Delivered' && item.itemStatus !== 'Returned') {
            return res.status(403).send("Invoice is only available after the item has been delivered.");
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}-${item.name.substring(0,10)}.pdf`);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        doc.registerFont('Roboto', path.join(__dirname, '../../public/fonts/Roboto-Regular.ttf'));
        doc.registerFont('Roboto-Bold', path.join(__dirname, '../../public/fonts/Roboto-Bold.ttf'));

        doc.pipe(res); 

        doc.rect(0, 0, doc.page.width, 110).fill('#00827f');
        
        doc.fillColor('white')
           .fontSize(28)
           .font('Roboto-Bold')
           .text('DRESSROSA', 50, 40)
           .fontSize(10)
           .font('Roboto')
           .text('PREMIUM FASHION APPAREL', 50, 75);

        doc.fontSize(24)
           .font('Roboto-Bold')
           .text('INVOICE', 0, 40, { align: 'right', margins: { right: 50 } })
           .fontSize(10)
           .font('Roboto')
           .text(`Order ID: ${order.orderId}`, 0, 75, { align: 'right', margins: { right: 50 } });

        doc.fillColor('#333333');
        let currentY = 140;

        doc.fontSize(10).font('Roboto-Bold').fillColor('#00827f').text('BILLED TO:', 50, currentY);
        doc.moveDown(0.5);
        doc.font('Roboto-Bold').fillColor('#111111').text(order.shippingAddress.name);
        doc.font('Roboto').fillColor('#555555')
           .text(order.shippingAddress.street)
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.district}`)
           .text(`${order.shippingAddress.state} - ${order.shippingAddress.pincode}`)
           .text(`Phone: ${order.shippingAddress.phone}`);

        doc.rect(380, currentY, 180, 70).fillAndStroke('#f9f9f9', '#eeeeee');
        doc.fillColor('#333333').font('Roboto-Bold').text('Invoice Details', 390, currentY + 10);
        doc.font('Roboto').fontSize(9)
           .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 390, currentY + 30)
           .text(`Payment: ${order.paymentMethod}`, 390, currentY + 45)
           .text(`Status: ${order.paymentStatus}`, 390, currentY + 60);

        currentY += 110;

        doc.rect(50, currentY, doc.page.width - 100, 25).fill('#e0f2f1');
        doc.fillColor('#00827f').font('Roboto-Bold').fontSize(10);
        doc.text('ITEM DESCRIPTION', 60, currentY + 8);
        doc.text('SIZE', 300, currentY + 8);
        doc.text('QTY', 360, currentY + 8, { width: 40, align: 'center' });
        doc.text('PRICE', 420, currentY + 8, { width: 60, align: 'right' });
        doc.text('TOTAL', 490, currentY + 8, { width: 60, align: 'right' });

        currentY += 40;

        const isReturned = item.itemStatus === 'Returned';
        const itemColor = isReturned ? '#d32f2f' : '#111111'; 
        
        doc.fillColor(itemColor).font('Roboto-Bold').fontSize(11).text(item.name, 60, currentY);
        if (isReturned) {
            doc.font('Roboto').fontSize(9).fillColor('#d32f2f').text('** ITEM RETURNED & REFUNDED **', 60, currentY + 15);
        }

        doc.fillColor(itemColor).font('Roboto').fontSize(10);
        doc.text(item.size, 300, currentY);
        doc.text(item.quantity.toString(), 360, currentY, { width: 40, align: 'center' });
        doc.text(`₹${item.price}`, 420, currentY, { width: 60, align: 'right' });
        doc.text(`₹${item.itemTotal}`, 490, currentY, { width: 60, align: 'right' });

        currentY += 40;

        doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).strokeColor('#eeeeee').stroke();
        currentY += 20;

        doc.rect(380, currentY, 180, isReturned ? 70 : 50).fill('#f9f9f9');
        
        if (isReturned) {
            doc.fillColor('#555555').font('Roboto').fontSize(10)
               .text('Original Amount:', 380, currentY + 15, { width: 90, align: 'right' });
            doc.text(`₹${item.itemTotal}`, 480, currentY + 15, { width: 70, align: 'right' });
            
            doc.fillColor('#d32f2f').font('Roboto')
               .text('Refunded:', 380, currentY + 35, { width: 90, align: 'right' });
            doc.text(`- ₹${item.itemTotal}`, 480, currentY + 35, { width: 70, align: 'right' });

            doc.fillColor('#00827f').font('Roboto-Bold').fontSize(12)
               .text('Net Paid:', 380, currentY + 55, { width: 90, align: 'right' });
            doc.text(`₹0`, 480, currentY + 55, { width: 70, align: 'right' });
        } else {
            doc.fillColor('#555555').font('Roboto').fontSize(10)
               .text('Subtotal:', 380, currentY + 15, { width: 90, align: 'right' });
            doc.text(`₹${item.itemTotal}`, 480, currentY + 15, { width: 70, align: 'right' });

            doc.fillColor('#00827f').font('Roboto-Bold').fontSize(12)
               .text('Total Paid:', 380, currentY + 35, { width: 90, align: 'right' });
            doc.text(`₹${item.itemTotal}`, 480, currentY + 35, { width: 70, align: 'right' });
        }

        doc.fontSize(10).fillColor('#888888').font('Roboto')
           .text('Thank you for shopping with Dressrosa Fashion!', 50, doc.page.height - 80, { align: 'center' })
           .text('For support, contact support@dressrosa.com', 50, doc.page.height - 65, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error("Invoice Error:", error);
        res.status(500).send("Failed to generate invoice");
    }
};

exports.getOrderDetailsPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { orderId, itemId } = req.params;

        const order = await Order.findOne({ orderId: orderId, user: userId });
        if (!order) return res.redirect('/profile/orders?error=OrderNotFound');

        const item = order.items.id(itemId);
        if (!item) return res.redirect('/profile/orders?error=ItemNotDound');

        res.render('user/order-details', { order, item });
    } catch (error) {
        console.error("Order Details Error:", error);
        res.redirect('/profile/orders?error=ServerError');
    }
};