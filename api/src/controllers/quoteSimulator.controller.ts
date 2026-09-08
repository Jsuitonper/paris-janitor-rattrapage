import type { RequestHandler } from 'express';
import * as quoteSimulatorService from '../services/quoteSimulator.service';
import { leadContactSchema, leadListQuerySchema, leadQualifySchema, simulationInputSchema } from '../validators/simulator.schema';

export const listOptions: RequestHandler = async (_req, res) => {
  res.json(await quoteSimulatorService.listOptions());
};

export const simulate: RequestHandler = async (req, res) => {
  const input = simulationInputSchema.parse(req.body);
  const { lead, breakdown } = await quoteSimulatorService.simulate(input);
  res.status(201).json({ leadId: lead.id, input, breakdown });
};

export const submitContact: RequestHandler = async (req, res) => {
  const contact = leadContactSchema.parse(req.body);
  const lead = await quoteSimulatorService.attachContact(req.params.id as string, contact);
  res.json({ leadId: lead.id, status: lead.status });
};

export const adminListLeads: RequestHandler = async (req, res) => {
  const query = leadListQuerySchema.parse(req.query);
  res.json(await quoteSimulatorService.listLeads(query));
};

export const adminQualifyLead: RequestHandler = async (req, res) => {
  const patch = leadQualifySchema.parse(req.body);
  res.json(await quoteSimulatorService.qualifyLead(req.params.id as string, patch));
};

export const adminExportLeads: RequestHandler = async (_req, res) => {
  const csv = await quoteSimulatorService.exportLeadsCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-paris-janitor.csv"');
  res.send(csv);
};
