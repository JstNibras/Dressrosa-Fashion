const Order = require('../models/orderModel');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

exports.getDashboardData = async (filter = 'all_time') => {
    try {
        let groupId = {};
        let expectedLabels = [];
        let labelFormatter = (id) => id;

        const now = new Date();
        let startDate = new Date(0);
        let endDate = new Date();

        if (filter === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            groupId = { $hour: "$createdAt" };
            for(let i=0; i<24; i++) expectedLabels.push(i);
            labelFormatter = (id) => {
                const ampm = id >= 12 ? 'PM' : 'AM';
                const h = id % 12 || 12;
                return `${h} ${ampm}`;
            };
        } else if (filter === 'this_week') {
            const currentDayOrig = now.getDay();
            const diff = now.getDate() - currentDayOrig;
            startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
            groupId = { $dayOfWeek: "$createdAt" }; // 1: Sun, 7: Sat
            for(let i=1; i<=7; i++) expectedLabels.push(i);
            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            labelFormatter = (id) => days[(id - 1) % 7];
        } else if (filter === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            groupId = { $dayOfMonth: "$createdAt" };
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) expectedLabels.push(i);
            labelFormatter = (id) => id.toString();
        } else {
            if (filter === 'this_year') {
                startDate = new Date(now.getFullYear(), 0, 1);
            }
            groupId = { $month: "$createdAt" };
            for(let i=1; i<=12; i++) expectedLabels.push(i);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            labelFormatter = (id) => months[id - 1];
        }

        const validOrderMatch = {
            orderStatus: { $nin: ['Cancelled', 'Returned'] },
            createdAt: { $gte: startDate, $lte: endDate }
        };

        const totalCustomers = await User.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            isBlocked: false
        });

        const totalsAgg = await Order.aggregate([
            { $match: validOrderMatch },
            { $group: {
                _id: null,
                totalRevenue: { $sum: "$pricing.total"},
                totalOrders: { $sum: 1 }
            }}
        ]);

        const totalRevenue = totalsAgg.length > 0 ? totalsAgg[0].totalRevenue : 0;
        const totalOrders = totalsAgg.length > 0 ? totalsAgg[0].totalOrders : 0;

        const topProducts = await Order.aggregate([
            { $match: validOrderMatch },
            { $unwind: "$items" },
            { $match: { "items.itemStatus": { $nin: ['Cancelled', 'Returned'] } } },
            { $group: {
                _id: "$items.productId",
                name: { $first: "$items.name" },
                image: { $first: "$items.image" },
                totalSold: { $sum: "$items.quantity" }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 3 } 
        ]);

        const topCategories = await Order.aggregate([
            { $match: validOrderMatch },
            { $unwind: "$items" },
            { $match: { "items.itemStatus": { $nin: ['Cancelled', 'Returned'] } } },
            { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDetails'} },
            { $unwind: "$productDetails" },
            { $lookup: { from: 'categories', localField: 'productDetails.category', foreignField: '_id', as: 'categoryDetails'} },
            { $unwind: "$categoryDetails" },
            { $group: { 
                _id: "$categoryDetails.name", 
                count: { $sum: "$items.quantity" } 
            }},
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        const categoryLabels = topCategories.map(c => c._id);
        const categoryData = topCategories.map(c => c.count);

        const timeSeriesData = await Order.aggregate([
            { $match: validOrderMatch },
            { $group: {
                _id: groupId,
                revenue: { $sum: "$pricing.total" },
                orders: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);

        const dataMap = {};
        timeSeriesData.forEach(d => { dataMap[d._id] = d; });

        const revenueChartLabels = [];
        const revenueChartData = [];
        const orderChartData = [];

        expectedLabels.forEach(labelId => {
            revenueChartLabels.push(labelFormatter(labelId));
            if (dataMap[labelId]) {
                revenueChartData.push(dataMap[labelId].revenue);
                orderChartData.push(dataMap[labelId].orders);
            } else {
                revenueChartData.push(0);
                orderChartData.push(0);
            }
        });

        return {
            totalRevenue,
            totalOrders,
            totalCustomers,
            topProducts,
            chartData: {
                revenue: { labels: revenueChartLabels, data: revenueChartData },
                orders: { labels: revenueChartLabels, data: orderChartData },
                categories: { labels: categoryLabels, data: categoryData }
            }
        };

    } catch (error) {
        console.error("Dashboard Service Error:", error);
        throw error;
    }
}