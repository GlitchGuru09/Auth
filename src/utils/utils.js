function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getOtpHtml(otp) {
    return `
        <html>
            <body>
                <h1>Your OTP Code</h1>
                <p>Your OTP code is: <strong>${otp}</strong></p>
                <p>Please use this code to verify your email address.</p>
            </body>
        </html>
    `;
}

export { generateOtp, getOtpHtml };