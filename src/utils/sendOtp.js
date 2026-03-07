const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: `Dressrosa Fashion <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your Dressrosa Account",
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center;">
                <h2 style="color: #ff0050;">Dressrosa Fashion</h2>
                <p>Your verification code is:</p>
                <h1 style="letter-spacing: 5px;">${otp}</h1>
                <p>This code expires in 2 minutes.</p>
            </div>
        `
    };
    return transport.sendMail(mailOptions);
};

module.exports = sendOtpEmail;
