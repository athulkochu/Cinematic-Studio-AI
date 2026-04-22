import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import charactersRouter from "./characters";
import scenesRouter from "./scenes";
import schedulesRouter from "./schedules";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(charactersRouter);
router.use(scenesRouter);
router.use(schedulesRouter);
router.use(dashboardRouter);

export default router;
