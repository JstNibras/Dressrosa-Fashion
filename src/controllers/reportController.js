const reportService = require('../services/reportService');

exports.getReportPage = async (req, res) => {
    try {
        const filter = req.query.filter || 'all_time';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const status = req.query.status || '';

        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const data = await reportService.getReportData(filter, startDate, endDate, page, limit, status);
        
        res.render('admin/report', {
            kpi: data.kpi,
            reportData: data.reportData,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            query: { filter, startDate, endDate, status }
        });
    } catch (error) {
        console.error("Report Page Error:", error);
        res.status(500).send("Internal Server Error loading reports.");
    }
};

exports.downloadReport = async (req, res) => {
    try {
        const format = req.params.format;
        const filter = req.query.filter || 'all_time';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const status = req.query.status || '';

        const data = await reportService.getReportData(filter, startDate, endDate, null, 10, status);

        if (format === 'excel') {
            await reportService.generateExcel(data.reportData, data.kpi, res);
        } else if (format === 'pdf') {
            await reportService.generatePDF(data.reportData, data.kpi, res);
        } else {
            res.status(400).send("Invalid format request");
        }
    } catch (error) {
        console.error("Report Download Error:", error);
        res.status(500).send("Failed to generate report");
    }
}