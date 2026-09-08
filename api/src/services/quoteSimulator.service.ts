import * as quoteLeadRepository from '../repositories/quoteLead.repository';
import type {
  LeadContact,
  LeadStatus,
  QuoteLead,
  SimulationBreakdown,
  SimulationInput,
  SimulationOptionLine,
  SimulatorOption,
} from '../types/lead';
import { AppError } from '../utils/AppError';
import { bpsOf } from '../utils/money';
import { getSettings } from './pricingConfig.service';

const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

export function computeBreakdown(
  input: SimulationInput,
  settings: { stayCommissionBps: number; ownerYearlyFeeCents: number; simulatorOptions: SimulatorOption[] },
): SimulationBreakdown {
  const occupiedNights = Math.round((DAYS_PER_YEAR * input.occupancyRateBps) / 10000);
  const estimatedStays = Math.max(0, Math.floor(occupiedNights / input.averageStayNights));
  const grossRevenueHtCents = occupiedNights * input.nightlyRateHtCents;
  const platformCommissionHtCents = bpsOf(grossRevenueHtCents, settings.stayCommissionBps);

  const options: SimulationOptionLine[] = input.optionKeys
    .map((key) => settings.simulatorOptions.find((option) => option.key === key))
    .filter((option): option is SimulatorOption => option !== undefined)
    .map((option) => {
      const quantity = option.frequency === 'per_stay' ? estimatedStays : 1;
      return {
        key: option.key,
        label: option.label,
        frequency: option.frequency,
        unitPriceHtCents: option.priceHtCents,
        quantity,
        totalHtCents: option.priceHtCents * quantity,
      };
    });

  const optionsHtCents = options.reduce((total, option) => total + option.totalHtCents, 0);
  const totalHtCents = platformCommissionHtCents + settings.ownerYearlyFeeCents + optionsHtCents;
  const yearlyHtCents = grossRevenueHtCents - totalHtCents;

  return {
    assumptions: {
      nightlyRateHtCents: input.nightlyRateHtCents,
      occupancyRateBps: input.occupancyRateBps,
      occupiedNights,
      averageStayNights: input.averageStayNights,
      estimatedStays,
      commissionBps: settings.stayCommissionBps,
    },
    grossRevenueHtCents,
    charges: {
      platformCommissionHtCents,
      ownerYearlyFeeCents: settings.ownerYearlyFeeCents,
      options,
      optionsHtCents,
      totalHtCents,
    },
    net: {
      yearlyHtCents,
      monthlyHtCents: Math.round(yearlyHtCents / MONTHS_PER_YEAR),
      perOccupiedNightHtCents: occupiedNights === 0 ? 0 : Math.round(yearlyHtCents / occupiedNights),
    },
  };
}

export async function simulate(input: SimulationInput): Promise<{ lead: QuoteLead; breakdown: SimulationBreakdown }> {
  const settings = await getSettings();
  const breakdown = computeBreakdown(input, settings);
  const lead = await quoteLeadRepository.createLead({ input, breakdown });
  return { lead, breakdown };
}

export async function attachContact(leadId: string, contact: LeadContact): Promise<QuoteLead> {
  const lead = await quoteLeadRepository.findLeadById(leadId);
  if (!lead) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Simulation introuvable');
  }
  if (lead.contact) {
    throw new AppError(409, 'CONTACT_ALREADY_PROVIDED', 'Des coordonnées ont déjà été enregistrées pour cette simulation');
  }
  return (await quoteLeadRepository.updateLead(leadId, { contact }))!;
}

export async function listOptions(): Promise<SimulatorOption[]> {
  return (await getSettings()).simulatorOptions;
}

export function listLeads(filter: { status?: LeadStatus; withContact?: boolean } = {}): Promise<QuoteLead[]> {
  return quoteLeadRepository.listLeads(filter);
}

export async function qualifyLead(leadId: string, patch: { status?: LeadStatus; notes?: string }): Promise<QuoteLead> {
  const lead = await quoteLeadRepository.findLeadById(leadId);
  if (!lead) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead introuvable');
  }
  return (await quoteLeadRepository.updateLead(leadId, patch))!;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export async function exportLeadsCsv(): Promise<string> {
  const leads = await listLeads();
  const header = [
    'date',
    'statut',
    'prenom',
    'nom',
    'email',
    'telephone',
    'arrondissement',
    'surface_m2',
    'capacite',
    'nuitee_ht_eur',
    'occupation_pct',
    'revenu_brut_ht_eur',
    'commission_ht_eur',
    'abonnement_ht_eur',
    'options_ht_eur',
    'net_annuel_ht_eur',
    'notes',
  ];
  const euros = (cents: number) => (cents / 100).toFixed(2);
  const rows = leads.map((lead) =>
    [
      lead.createdAt.toISOString(),
      lead.status,
      lead.contact?.firstName ?? '',
      lead.contact?.lastName ?? '',
      lead.contact?.email ?? '',
      lead.contact?.phone ?? '',
      lead.input.arrondissement,
      lead.input.surfaceM2,
      lead.input.capacity,
      euros(lead.input.nightlyRateHtCents),
      lead.input.occupancyRateBps / 100,
      euros(lead.breakdown.grossRevenueHtCents),
      euros(lead.breakdown.charges.platformCommissionHtCents),
      euros(lead.breakdown.charges.ownerYearlyFeeCents),
      euros(lead.breakdown.charges.optionsHtCents),
      euros(lead.breakdown.net.yearlyHtCents),
      lead.notes,
    ]
      .map(csvCell)
      .join(';'),
  );
  return [header.join(';'), ...rows].join('\n');
}
