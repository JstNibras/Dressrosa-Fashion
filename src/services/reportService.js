const Order = require('../models/orderModel');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getDateRange = (filter, startDate, endDate) => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date();

    switch (filter) {
        case 'today':
            start = new Date(now.setHours(0, 0, 0, 0));
            end = new Date(now.setHours(23, 59, 59, 999));
            break;
        case 'this_week':
            const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
            start = new Date(firstDay.setHours(0, 0, 0, 0));
            break;
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            break;
        case 'custom':
            if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
            }
            break;
        default: 
            start = new Date(0);
    }   
    return { start, end };
};

exports.getReportData = async (filter, startDate, endDate, page = null, limit = 10) => {
    const { start, end } = getDateRange(filter, startDate, endDate);

    const dateMatch = { createdAt: { $gte: start, $lte: end } };

    const kpiAgg = await Order.aggregate([
        { $match: { ...dateMatch, orderStatus: { $nin: ['Cancelled', 'Returned'] } } },
        { $group: {
            _id: null,
            totalSales: { $sum: "$pricing.total" },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: "$pricing.discount" }
        }},
        { $project: {
            _id: 0,
            totalSales: { $round: ["$totalSales", 2] },
            totalOrders: 1,
            totalDiscount: { $round: ["$totalDiscount", 2] }
        }}
    ]);

    const kpi = kpiAgg.length > 0 ? kpiAgg[0] : { totalSales: 0, totalOrders: 0, totalDiscount: 0 };

    const totalRecordsAgg = await Order.aggregate([
        { $match: dateMatch },
        { $unwind: "$items" },
        { $count: "total" }
    ]);

    const totalRecords = totalRecordsAgg.length > 0 ? totalRecordsAgg[0].total : 0;

    const pipeline = [
        { $match: dateMatch },
        { $unwind: "$items" },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDetails' } },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $project: {
            orderId: 1,
            date: "$createdAt",
            customerName: { $concat: ["$userDetails.firstName", " ", "$userDetails.lastName"] },
            email: "$userDetails.email",
            productName: "$items.name",
            quantity: "$items.quantity",
            price: "$items.price",
            total: { 
                $round: [
                    { 
                        $subtract: [
                            "$items.itemTotal", 
                            { 
                                $multiply: [
                                    "$items.itemTotal", 
                                    { 
                                        $divide: [
                                            { $ifNull: ["$pricing.discount", 0] }, 
                                            { $cond: [{ $eq: ["$pricing.subtotal", 0] }, 1, "$pricing.subtotal"] }
                                        ] 
                                    }
                                ] 
                            }
                        ] 
                    },
                    2
                ]
            },
            paymentMethod: 1,
            status: "$items.itemStatus"
        }}
    ];

    if (page !== null) {
        const skip = (page - 1) * limit;
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });
    }

    const reportData = await Order.aggregate(pipeline);

    return { 
        kpi, 
        reportData, 
        dateRange: { start, end },
        totalRecords,
        totalPages: page !== null ? Math.ceil(totalRecords / limit) : 1,
        currentPage: page !== null ? page : 1
    };
};

exports.generateExcel = async (reportData, summaryData, res) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Summary Section
    worksheet.addRow(['SALES SUMMARY']).font = { bold: true, size: 14 };
    worksheet.addRow(['Total Orders', summaryData.totalOrders]);
    worksheet.addRow(['Total Revenue', summaryData.totalSales]);
    worksheet.addRow(['Total Discount', summaryData.totalDiscount]);
    worksheet.addRow([]); // Gap

    // Define table columns starting from row 6
    worksheet.getRow(6).values = ['Order ID', 'Date', 'Customer', 'Email', 'Product', 'Qty', 'Price', 'Total', 'Payment', 'Status'];
    worksheet.columns = [
        { key: 'orderId', width: 20 },
        { key: 'date', width: 15 },
        { key: 'customerName', width: 25 },
        { key: 'email', width: 30 },
        { key: 'productName', width: 35 },
        { key: 'quantity', width: 10 },
        { key: 'price', width: 15 },
        { key: 'total', width: 15 },
        { key: 'paymentMethod', width: 15 },
        { key: 'status', width: 15 }
    ];

    worksheet.getRow(6).font = { bold: true };
    worksheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00827F' } };
    worksheet.getRow(6).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    reportData.forEach(item => {
        worksheet.addRow({
            ...item,
            total: item.total ? Number(item.total.toFixed(2)) : 0,
            date: new Date(item.date).toLocaleDateString('en-IN')
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Dressrosa_Sales_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
}

exports.generatePDF = async (reportData, summaryData, res) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Dressrosa_Sales_Report.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#00827f').text('DRESSROSA FASHION', { align: 'center' });
    doc.fontSize(14).fillColor('#333').text('Sales Report', { align: 'center' });
    doc.moveDown(1);

    // Summary Box
    const summaryY = doc.y;
    doc.rect(30, summaryY, 250, 70).fillAndStroke('#f9f9f9', '#00827f');
    doc.fillColor('#00827f').fontSize(12).font('Helvetica-Bold').text('Overall Summary', 40, summaryY + 10);
    doc.fillColor('#333').fontSize(10).font('Helvetica');
    doc.text(`Total Orders: ${summaryData.totalOrders}`, 40, summaryY + 25);
    doc.text(`Total Revenue: Rs.${summaryData.totalSales.toFixed(2)}`, 40, summaryY + 40);
    doc.text(`Total Discount: Rs.${summaryData.totalDiscount.toFixed(2)}`, 40, summaryY + 55);
    
    doc.moveDown(4);

    const tableTop = doc.y + 10;
    const colWidths = [100, 70, 120, 180, 40, 60, 60, 80];
    const columns = ['Order ID', 'Date', 'Customer', 'Product', 'Qty', 'Price', 'Total', 'Status'];
    let currentY = tableTop;

    doc.fontSize(10).font('Helvetica-Bold');
    let currentX = 30;
    columns.forEach((col, i) => {
        doc.text(col, currentX, currentY, { width: colWidths[i], align: 'left' });
        currentX += colWidths[i];
    });
    
    currentY += 20;
    doc.moveTo(30, currentY).lineTo(810, currentY).stroke('#ccc');
    currentY += 10;

    doc.font('Helvetica').fontSize(9);
    reportData.forEach(item => {
        if (currentY > 500) { 
            doc.addPage({ layout: 'landscape' });
            currentY = 30;
        }

        currentX = 30;
        const rowData = [
            item.orderId,
            new Date(item.date).toLocaleDateString('en-IN'),
            (item.customerName || 'N/A').substring(0, 20),
            (item.productName || 'N/A').substring(0, 30),
            item.quantity.toString(),
            `Rs.${item.price}`,
            `Rs.${item.total.toFixed(2)}`,
            item.status
        ];

        rowData.forEach((text, i) => {
            doc.text(text, currentX, currentY, { width: colWidths[i], align: 'left' });
            currentX += colWidths[i];
        });

        currentY += 20;
        doc.moveTo(30, currentY).lineTo(810, currentY).stroke('#f0f0f0');
        currentY += 10;
    });

    doc.end();
};
