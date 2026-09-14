import {
  createExperimentBodySchema,
  experimentSchema,
  experimentTimelineResponseSchema,
} from "@hotel-chaos/shared";
import { Router } from "express";
import { listAuditEvents } from "../db/auditEventsRepository.js";
import { startExperiment } from "../experiments/orchestrator.js";
import { composeTimeline } from "../experiments/timeline.js";
import {
  create,
  get,
  getInFlight,
  hasCreatedOrInFlight,
} from "../experiments/store.js";
import { zodValidationDetails } from "../errors.js";

export const experimentsRouter = Router();

experimentsRouter.post("/experiments", (req, res) => {
  const parsed = createExperimentBodySchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request body",
      details: zodValidationDetails(parsed.error),
    });
    return;
  }

  if (hasCreatedOrInFlight()) {
    res.status(409).json({
      code: "EXPERIMENT_IN_PROGRESS",
      message: "An experiment is already created or in progress",
    });
    return;
  }

  const scenario = parsed.data.scenario ?? "database-outage";
  const experiment = create(scenario);
  res.status(201).json(experimentSchema.parse(experiment));
});

// Register /experiments/current before /experiments/:id/* so "current" is not treated as an id.
experimentsRouter.get("/experiments/current", (_req, res) => {
  const experiment = getInFlight();
  if (!experiment) {
    res.status(404).json({ message: "Experiment not found" });
    return;
  }
  res.status(200).json(experimentSchema.parse(experiment));
});

experimentsRouter.post("/experiments/:id/start", (req, res, next) => {
  try {
    const experiment = startExperiment(req.params.id);
    res.status(202).json(experimentSchema.parse(experiment));
  } catch (error) {
    if (!(error instanceof Error)) {
      next(error);
      return;
    }

    if (error.message === "Experiment not found") {
      res.status(404).json({ message: "Experiment not found" });
      return;
    }

    if (error.message === "Experiment is not startable") {
      res.status(409).json({
        code: "EXPERIMENT_NOT_STARTABLE",
        message: "Experiment cannot be started in its current state",
      });
      return;
    }

    if (
      error.message === "Another experiment is in progress" ||
      error.message === "Experiment start already in progress"
    ) {
      res.status(409).json({
        code: "EXPERIMENT_IN_PROGRESS",
        message: "An experiment is already in progress",
      });
      return;
    }

    next(error);
  }
});

// Register nested GET paths before GET /experiments/:id so id segments are not mistaken.
experimentsRouter.get("/experiments/:id/timeline", async (req, res, next) => {
  try {
    const timeline = await composeTimeline(req.params.id);
    if (!timeline) {
      res.status(404).json({ message: "Experiment not found" });
      return;
    }
    res
      .status(200)
      .json(experimentTimelineResponseSchema.parse(timeline));
  } catch (error) {
    next(error);
  }
});

experimentsRouter.get("/experiments/:id/events", async (req, res, next) => {
  const experiment = get(req.params.id);
  if (!experiment) {
    res.status(404).json({ message: "Experiment not found" });
    return;
  }

  try {
    const events = await listAuditEvents({ experimentId: req.params.id });
    res.status(200).json({ events });
  } catch (error) {
    next(error);
  }
});

experimentsRouter.get("/experiments/:id", (req, res) => {
  const experiment = get(req.params.id);
  if (!experiment) {
    res.status(404).json({ message: "Experiment not found" });
    return;
  }
  res.status(200).json(experimentSchema.parse(experiment));
});
