import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import subscriptionsRouter from "./subscriptions";
import tracksRouter from "./tracks";
import merchRouter from "./merch";
import postsRouter from "./posts";
import artistRouter from "./artist";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(subscriptionsRouter);
router.use(tracksRouter);
router.use(merchRouter);
router.use(postsRouter);
router.use(artistRouter);
router.use(adminRouter);

export default router;
