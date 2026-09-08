import userModel from '../models/user.model.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from "../config/config.js"
import SessionModel from '../models/session.model.js';
import { sendEmail } from '../services/email.service.js';
import { getOtpHtml, generateOtp } from '../utils/utils.js';
import otpModel from '../models/otp.modal.js';


//Register 
export async function register(req, res) {

    const { username, email, password } = req.body;

    const isAlreadyregistered = await userModel.findOne({
        $or: [
            { username },
            { email }
        ]
    });

    if (isAlreadyregistered) {
        return res.status(409).json({ message: 'Username or email already exists.' });
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const user = await userModel.create({
        username,
        email,
        password: hashedPassword
    });

    const otp = generateOtp();
    const html = getOtpHtml(otp);

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    await otpModel.create({
        email,
        userId: user._id,
        otpHash
    });

    await sendEmail(email, 'Verify your email', `Your OTP is: ${otp}`, html);

    res.status(201).json({
        message: 'User created successfully.',
        user: {
            username: user.username,
            email: user.email,
            verified: user.verified
        }
    });

}

//login
export async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await userModel.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: "Invalid email or password." });
    }

    if(!user.verified){
        return res.status(403).json({ message: "Please verify your email before logging in." });
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const isValidPassword = hashedPassword === user.password;

    if (!isValidPassword) {
        return res.status(404).json({ message: "Invalid email or password." });
    }

    const refreshToken = jwt.sign({
        id: user._id
    }, config.JWT_SECRET, { expiresIn: "7d" })

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const session = await SessionModel.create({
        userId: user._id,
        refreshTokenHash,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });

    const accessToken = jwt.sign({
        id: user._id,
        sessionId: session._id
    }, config.JWT_SECRET, { expiresIn: "15m" })

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
        message: 'Logged in successfully.',
        user: {
            username: user.username,
            email: user.email,
        },
        accessToken
    });
}

//Get me
export async function getMe(req, res) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Token not found."
        })
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    const user = await userModel.findById(decoded.id);

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
        user: {
            username: user.username,
            email: user.email,
        }
    });
}

//refresh token
export async function refreshToken(req, res) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token not found." });
    }

    try {
        const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

        /*line 109 to 120 is a security measure to prevent token reuse attacks.
        hacker can copy the refresh token and use it to get a new access token.*/

        /*------*/
        const refreshTokenhash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const session = await SessionModel.findOne({
            refreshTokenhash,
            revoked: false
        });

        if (!session) {
            return res.status(401).json({ message: "Invalid refresh token." });
        }
        /*------*/

        const accessToken = jwt.sign({
            id: decoded.id
        }, config.JWT_SECRET, { expiresIn: "15m" });

        const newRefreshToken = jwt.sign({
            id: decoded.id
        }, config.JWT_SECRET, { expiresIn: "7d" });

        const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

        session.refreshTokenHash = newRefreshTokenHash;
        await session.save();

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(200).json({
            accessToken
        });

    } catch (error) {
        return res.status(401).json({ message: "Invalid refresh token." });
    }
}

//Logout
export async function logout(req, res) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token not found." });
    }

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const session = await SessionModel.findOne({
        refreshTokenHash,
        revoked: false
    });

    if (!session) {
        return res.status(400).json({
            message: "Invalid session."
        });
    }

    session.revoked = true;
    await session.save();

    res.clearCookie("refreshToken");

    res.status(200).json({
        message: "Logged out successfully."
    });
};

//logout All
export async function logoutAll(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token not found." });
    }

    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

    await SessionModel.updateMany({
        userId: decoded.id,
        revoked: false
    }, { revoked: true }
    )

    res.clearCookie("refreshToken");

    res.status(200).json({
        message: "Logged out from all devices successfully."
    });
}

//verify Email
export async function verifyEmail(req, res) {
    const { email, otp } = req.query;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required." });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const otpRecord = await otpModel.findOne({
        email,
        otpHash
    });

    if (!otpRecord) {
        return res.status(400).json({ message: "Invalid OTP." });
    }

    const user = await userModel.findByIdAndUpdate(otpRecord.userId, { verified: true });

    await otpModel.deleteMany({
        user: otpRecord.user
     });

    res.status(200).json({
        message: "Email verified successfully.",
        user: {
            username: user.username,
            email: user.email,
            verified: user.verified
        }
    });
}