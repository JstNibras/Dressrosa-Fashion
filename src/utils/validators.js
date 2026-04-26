const { z } = require('zod');

const signupSchema = z.object({
    firstName: z.string()
        .trim()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name too long")
        .regex(/^[a-zA-Z]+$/, "First name should only contain letters"),

    lastName: z.string()
        .trim()
        .min(1, "Last name is required")
        .regex(/^[a-zA-Z]+$/, "Last name should only contain letters"),

    email: z.string()
        .trim()
        .email("Invalid email address")
        .toLowerCase(),

    phone: z.string()
        .trim()
        .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),

    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[\W_]/, "Password must contain at least one special character"),
    
    confirmPassword: z.string(),
    referralCode: z.string().trim().optional()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Password don't match",
    path: ["confirmPassword"],
});

const loginSchema = z.object({
    email: z.string()
        .trim()
        .min(1, "Email cannot be empty")
        .email("Invalid email format"),

    password: z.string()
        .min(1, "Password is required")
});

const adminLoginSchema = z.object({
    username: z.string()
        .trim()
        .min(1, "Email cannot be empty")
        .email("Invalid email format"),

    password: z.string()
        .min(1, "Email cannot be empty")
        .min(5, "Password must be at least 5 characters long")
});

const forgotPasswordSchema = z.object({
    email: z.string()
        .trim()
        .min(1, "Email is required")
        .email("Invalid email format")
});

const newPasswordSchema = z.object({
    password: z.string()
        .min(1, "Enter password")
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain one uppercase letter")
        .regex(/[a-z]/, "Must contain one lowercase letter")
        .regex(/[0-9]/, "Must contain one number")
        .regex(/[\W_]/, "Must contain one special character"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

const profileSchema = z.object({
    firstName: z.string()
        .trim()
        .min(1, "First name must be at least 2 characters")
        .regex(/^[a-zA-Z]+$/, "First name should only contain letters"),

    lastName: z.string()
        .trim()
        .min(1, "Last name is required")
        .regex(/^[a-zA-Z]+$/, "Last name should only contain letters"),

    phone: z.string()
        .trim()
        .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
});

const addressSchema = z.object({
    firstName: z.string()
        .trim()
        .min(2, "First name must be at least 2 characters")
        .regex(/^[a-zA-Z]+$/, "First name should only contain letters"),
    
    lastName: z.string()
        .trim()
        .min(1, "Last name is required")
        .regex(/^[a-zA-Z]+$/, "Last name should only contain letters"),

    mobile: z.string()
        .trim()
        .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),

    pincode: z.string()
        .trim()
        .regex(/^[0-9]{6}$/, "Invalid Pincode format"),

    houseNo: z.string()
        .trim()
        .min(3, "Please enter House No. or Building Name"),
    
    city: z.string()
        .trim()
        .min(2, "City is required"),

    district: z.string()
        .trim()
        .min(2, "District is required"),

    state: z.string()
        .trim()
        .min(2, "State is required"),

    type: z.enum(['HOME' , 'WORK' , 'OTHER'], {
        errorMap: () => ({ message: "Please select a valid address type" })
    }),
});

const changePasswordSchema = z.object({
    currentPassword: z.string()
        .min(1, "Current password is required"),

    newPassword: z.string()
        .min(8, "New password must be at least 8 characters")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and a number"),

    confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

const otpSchema = z.object({
    otp1: z.string().length(1).regex(/^[0-9]$/, "Must be a digit"),
    otp2: z.string().length(1).regex(/^[0-9]$/, "Must be a digit"),
    otp3: z.string().length(1).regex(/^[0-9]$/, "Must be a digit"),
    otp4: z.string().length(1).regex(/^[0-9]$/, "Must be a digit")
}).transform((data) => ({
    fullOtp: data.otp1 + data.otp2 + data.otp3 + data.otp4
}));

const couponSchema = z.object({
    code: z.string()
        .trim()
        .min(4, "Coupon code must be at least 4 characters")
        .max(15, "Coupon code too long")
        .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]+$/, "Coupon code must contain both letters and numbers"),

    discountType: z.enum(['flat', 'percentage'], {
        errorMap: () => ({ message: "Please select a valid discount type" })
    }),

    discountValue: z.number({ invalid_type_error: "Must be a number" })
        .positive("Discount value must be positive"),

    minPurchaseAmount: z.number({ invalid_type_error: "Must be a number" })
        .min(0, "Min purchase amount cannot be negative"),

    maxDiscountAmount: z.number({ invalid_type_error: "Must be a number" })
        .min(0, "Max discount amount cannot be negative")
        .optional(),

    expiryDate: z.string().refine(val => {
        const date = new Date(val);
        date.setHours(23, 59, 59, 999);
        return date > new Date();
    }, {
        message: "Expiry date cannot be in the past"
    }),

    totalUsageLimit: z.number({ invalid_type_error: "Must be a number" })
        .min(0, "Usage limit cannot be negative")
        .default(0)
}).refine(data => {
    if (data.discountType === 'percentage') {
        return data.discountValue <= 90;
    }
    return true;
}, {
    message: "Percentage discount cannot exceed 90%",
    path: ["discountValue"]
}).refine(data => {
    if (data.discountType === 'flat') {
        return data.discountValue < data.minPurchaseAmount;
    }
    return true;
}, {
    message: "Flat discount cannot exceed minimum purchase amount",
    path: ["discountValue"]
}).refine(data => {
    if (data.discountType === 'percentage') {
        return data.maxDiscountAmount > 0;
    }
    return true;
}, {
    message: "Max discount amount is required for percentage coupons",
    path: ["maxDiscountAmount"]
});

module.exports = { signupSchema, 
                    loginSchema, 
                    forgotPasswordSchema, 
                    newPasswordSchema,
                    profileSchema,
                    addressSchema,
                    changePasswordSchema,
                    otpSchema,
                    adminLoginSchema,
                    couponSchema };