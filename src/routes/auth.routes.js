import { Router } from 'express';
import * as authController from "../controllers/auth.controller.js"


const authRouter = Router();

/* GET /api/auth/refresh-token */
authRouter.get("/refresh-token", authController.refreshToken)

/* POST /api/auth/register */
authRouter.post("/register", authController.register)

/* GET /api/auth/get-me */
authRouter.get("/get-me", authController.getMe)


export default authRouter;