import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { AuthUser, NegativeTestCode } from './src/types/domain.ts';
import { CAPSTONE_DOCUMENTS } from './server/seedData.ts';
import { studioStore, verifyAuthToken } from './server/store.ts';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser | null;
    }
  }
}

const VALID_NT_CODES: NegativeTestCode[] = ['NT-1', 'NT-2', 'NT-3', 'NT-4', 'NT-5'];

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/runs' });

  app.use(express.json({ limit: '6mb' }));

  // Verify Authorization Bearer token when supplied
  app.use((req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      req.authUser = verifyAuthToken(authHeader.slice(7).trim());
    } else {
      req.authUser = null;
    }
    next();
  });

  // WebSocket broadcast for live pipeline run logs & status updates
  const broadcast = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  };
  studioStore.setBroadcaster(broadcast);

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'connected',
        runningRuns: studioStore.listRuns().filter((r) => r.status === 'running').map((r) => r.id),
      })
    );
  });

  // --- Health & Dashboard Overview ---
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'CLOUD-39-Reproducible-Pipeline-Studio', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/overview', (_req, res) => {
    const pipelines = studioStore.listPipelines();
    const schedules = studioStore.listSchedules();
    const runs = studioStore.listRuns();
    const notebooks = studioStore.listNotebooks();
    const { kpis, acceptanceConditions } = studioStore.getKpiSummary();
    const reproductions = studioStore.listReproductions();
    const faultTests = studioStore.listFaultTests();

    res.json({
      counts: {
        notebooks: notebooks.length,
        activePipelines: pipelines.length,
        enabledSchedules: schedules.filter((s) => s.enabled).length,
        totalRuns: runs.length,
        reproductions: reproductions.length,
        faultTestsPassed: faultTests.filter((f) => f.outcome === 'pass').length,
      },
      kpis,
      acceptanceConditions,
      upcomingSchedules: schedules.filter((s) => s.enabled).slice(0, 4),
      recentRuns: runs.slice(0, 6),
    });
  });

  // --- Auth ---
  app.post('/api/v1/auth/register', (req, res) => {
    const { name, email, password, affiliation } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const result = studioStore.registerUser(name, email, password, typeof affiliation === 'string' ? affiliation : '');
    if ('error' in result) return res.status(409).json(result);
    res.status(201).json(result);
  });

  app.post('/api/v1/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = studioStore.loginUser(email, password);
    if ('error' in result) return res.status(401).json(result);
    res.json(result);
  });

  app.get('/api/v1/auth/me', (req, res) => {
    if (!req.authUser) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ user: req.authUser });
  });

  // --- /api/v1/notebooks ---
  app.get('/api/v1/notebooks', (_req, res) => {
    res.json({ notebooks: studioStore.listNotebooks() });
  });

  app.post('/api/v1/notebooks', (req, res) => {
    const { name, description, rawContent } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Notebook file name is required.' });
    }
    if (typeof rawContent !== 'string' || rawContent.trim().length < 4) {
      return res.status(400).json({ error: 'Notebook content (.ipynb JSON or Python cells) is required.' });
    }
    const notebook = studioStore.uploadNotebook({
      name,
      description: typeof description === 'string' ? description : undefined,
      rawContent,
      owner: req.authUser?.name || 'Team C-162',
    });
    res.status(201).json({ notebook });
  });

  app.delete('/api/v1/notebooks/:id', (req, res) => {
    const ok = studioStore.deleteNotebook(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Notebook not found.' });
    res.json({ deleted: true });
  });

  // --- /api/v1/pipelines ---
  app.get('/api/v1/pipelines', (_req, res) => {
    res.json({ pipelines: studioStore.listPipelines() });
  });

  app.post('/api/v1/pipelines', (req, res) => {
    const { id, name, description, environmentSpec, steps, edges } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Pipeline name is required.' });
    }
    if (!Array.isArray(steps) || !Array.isArray(edges)) {
      return res.status(400).json({ error: 'Steps and edges arrays are required.' });
    }
    const pipeline = studioStore.createOrUpdatePipeline({
      id: typeof id === 'string' ? id : undefined,
      name,
      description: typeof description === 'string' ? description : '',
      environmentSpec: environmentSpec || {
        baseImage: 'ghcr.io/cloud39/notebook-runner:py312-pinned',
        pythonVersion: '3.12.7',
        cpuRequest: '4 vCPU',
        memoryRequest: '8 GiB',
      },
      steps,
      edges,
    });
    res.status(201).json({ pipeline });
  });

  // --- /api/v1/schedules ---
  app.get('/api/v1/schedules', (_req, res) => {
    res.json({ schedules: studioStore.listSchedules() });
  });

  app.post('/api/v1/schedules', (req, res) => {
    const { pipelineId, triggerType, cronExpression, intervalMinutes, timezone, parameterOverrides } = req.body || {};
    const schedule = studioStore.createSchedule({
      pipelineId: String(pipelineId || ''),
      triggerType: triggerType === 'interval' ? 'interval' : 'cron',
      cronExpression: typeof cronExpression === 'string' ? cronExpression : '0 6 * * *',
      intervalMinutes: typeof intervalMinutes === 'number' ? intervalMinutes : undefined,
      timezone: typeof timezone === 'string' ? timezone : 'UTC',
      parameterOverrides: parameterOverrides && typeof parameterOverrides === 'object' ? parameterOverrides : {},
    });
    if (!schedule) return res.status(404).json({ error: 'Target pipeline not found.' });
    res.status(201).json({ schedule });
  });

  app.patch('/api/v1/schedules/:id', (req, res) => {
    const updated = studioStore.updateSchedule(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Schedule not found.' });
    res.json({ schedule: updated });
  });

  app.delete('/api/v1/schedules/:id', (req, res) => {
    const ok = studioStore.deleteSchedule(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Schedule not found.' });
    res.json({ deleted: true });
  });

  // --- /api/v1/runs ---
  app.get('/api/v1/runs', (_req, res) => {
    res.json({ runs: studioStore.listRuns() });
  });

  app.get('/api/v1/runs/:id', (req, res) => {
    const run = studioStore.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found.' });
    res.json({ run });
  });

  app.post('/api/v1/runs', (req, res) => {
    const { pipelineId, triggeredBy, scheduleId, parameterOverrides } = req.body || {};
    const run = studioStore.triggerRun({
      pipelineId: String(pipelineId || ''),
      triggeredBy: triggeredBy === 'scheduled' ? 'scheduled' : 'manual',
      scheduleId: typeof scheduleId === 'string' ? scheduleId : undefined,
      parameterOverrides: parameterOverrides && typeof parameterOverrides === 'object' ? parameterOverrides : undefined,
    });
    if (!run) return res.status(404).json({ error: 'Pipeline not found.' });
    res.status(201).json({ run });
  });

  app.post('/api/v1/runs/:id/cancel', (req, res) => {
    const run = studioStore.cancelRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found.' });
    res.json({ run });
  });

  // --- /api/v1/environment ---
  app.get('/api/v1/environment/:runId', (req, res) => {
    const run = studioStore.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found.' });
    res.json({ environment: run.environment, dependencyLock: run.dependencyLock });
  });

  // --- /api/v1/lineage ---
  app.get('/api/v1/lineage', (req, res) => {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : '';
    const runs = studioStore.listRuns();
    const target = (runId ? studioStore.getRun(runId) : runs[0]) || runs[0];
    if (!target) {
      return res.json({ runId: null, nodes: [], edges: [], artifacts: [] });
    }
    res.json({
      runId: target.id,
      pipelineName: target.pipelineName,
      nodes: target.lineageNodes,
      edges: target.lineageEdges,
      artifacts: target.artifacts,
    });
  });

  // --- /api/v1/reproduction ---
  app.get('/api/v1/reproduction', (_req, res) => {
    res.json({ reproductions: studioStore.listReproductions() });
  });

  app.post('/api/v1/reproduction', (req, res) => {
    const { sourceRunId } = req.body || {};
    if (typeof sourceRunId !== 'string' || !sourceRunId.trim()) {
      return res.status(400).json({ error: 'sourceRunId is required.' });
    }
    const reproduction = studioStore.startReproduction(sourceRunId.trim());
    if (!reproduction) return res.status(404).json({ error: 'Source run not found.' });
    res.status(201).json({ reproduction });
  });

  // --- /api/v1/fault-injection ---
  app.get('/api/v1/fault-injection', (_req, res) => {
    res.json({ tests: studioStore.listFaultTests() });
  });

  app.post('/api/v1/fault-injection', (req, res) => {
    const { code } = req.body || {};
    if (!VALID_NT_CODES.includes(code)) {
      return res.status(400).json({ error: 'Provide a valid negative test code (NT-1..NT-5).' });
    }
    const test = studioStore.runFaultInjection(code);
    res.status(201).json({ test });
  });

  // --- /api/v1/kpi ---
  app.get('/api/v1/kpi', (_req, res) => {
    const summary = studioStore.getKpiSummary();
    res.json({
      ...summary,
      documents: CAPSTONE_DOCUMENTS,
    });
  });

  // --- /api/v1/settings ---
  app.get('/api/v1/settings', (_req, res) => {
    res.json({ settings: studioStore.getSettings() });
  });

  app.patch('/api/v1/settings', (req, res) => {
    const settings = studioStore.updateSettings(req.body || {});
    res.json({ settings });
  });

  // Serve public assets (including capstone PDFs in /public/assets/aistudio)
  app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));

  // Vite middleware in dev; static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CLOUD-39 Reproducible Pipeline Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
