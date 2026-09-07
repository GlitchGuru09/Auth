import userModel from '../models/user.model.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from "../config/config.js"
import SessionModel from '../models/session.model.js';

//refresh token
export async function refreshToken(req, res) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token not found." });
    }

    try {
        const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

        const accessToken = jwt.sign({
            id: decoded.id
        }, config.JWT_SECRET, { expiresIn: "15m" });

        const newRefreshToken = jwt.sign({
            id: decoded.id
        }, config.JWT_SECRET, { expiresIn: "7d" });

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

    res.status(201).json({
        message: 'User created successfully.',
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