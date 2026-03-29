const { adminLoginSchema } = require('../utils/validators');
const User = require('../models/userModel')

exports.postAdminLogin = (req, res) => {
    const validation = adminLoginSchema.safeParse(req.body);

    if (!validation.success) {
        const errors = validation.error.flatten().fieldErrors;
        return res.render('admin/login', {
            errors: errors,
            oldData: req.body,
            layout: 'layout/header-minimal'
        });
    }

    const { username, password } = validation.data;

    if (username === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.admin = {
            role: 'super-admin',
            email: process.env.ADMIN_EMAIL
        };

        req.session.save((err) => {
            if (err) return res.status(500).send("Session Save Error");
            res.redirect('/admin/users'); 
        });
    } else {
        res.render('admin/login', { error: "Invalid Admin Credentials", layout: 'layout/header-minimal' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 7;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search || "";
        const statusFilter = req.query.status || "all";

        const filter = {
            $or: [
                { firstName: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        if (statusFilter === "blocked") {
            filter.isBlocked = true;
        } else if (statusFilter === "active") {
            filter.isBlocked = false;
        }

        const totalUsers = await User.countDocuments(filter);
        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.render('admin/users', {
            users,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            searchQuery,
            statusFilter
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal Server Error")
    }
};

exports.toggleUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if(!user) return res.status(404).send("User not found");

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.redirect('/admin/users');
    } catch (error) {
        console.error("Error toggling user status:", error);
        res.status(500).send("Internal Server Error");
    }
}
