const adminDashboardService = require('../services/adminDashboardService');

exports.getDashboard = async (req, res) => {
    try {
        const filter = req.query.filter || 'all_time';
        const dashboardData = await adminDashboardService.getDashboardData(filter);

        res.render('admin/dashboard', {
            data: dashboardData,
            currentFilter: filter
        });
    } catch (error) {
        console.error("Dashboard Controller Error:", error);
        res.status(500).send("Failed to load dashboard data");
    }
};