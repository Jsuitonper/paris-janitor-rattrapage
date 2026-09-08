import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import * as commissionTierRepository from '../src/repositories/commissionTier.repository';
import * as maintenanceRepository from '../src/repositories/maintenance.repository';
import * as platformSettingsRepository from '../src/repositories/platformSettings.repository';
import * as propertyRepository from '../src/repositories/property.repository';
import * as providerRepository from '../src/repositories/provider.repository';
import * as serviceCategoryRepository from '../src/repositories/serviceCategory.repository';
import * as serviceOfferingRepository from '../src/repositories/serviceOffering.repository';
import * as userRepository from '../src/repositories/user.repository';
import * as vipPlanRepository from '../src/repositories/vipPlan.repository';
import { hashPassword } from '../src/services/auth.service';
import { DEFAULT_COMMISSION_TIERS, DEFAULT_SIMULATOR_OPTIONS, DEFAULT_VIP_PLANS } from '../src/services/pricing/defaults';
import * as providerPayoutService from '../src/services/providerPayout.service';
import { computeBreakdown } from '../src/services/quoteSimulator.service';
import {
  addConversation,
  addLead,
  addReview,
  configureAdmin,
  createService,
  createStay,
  invoiceSummary,
  providerRatings,
} from './demo/builders';
import { CATEGORIES, LEADS, OFFERINGS, PASSWORD, PROPERTIES, PROVIDERS, TRAVELERS, dayOfMonth, isoDay, monthsAgo } from './demo/fixtures';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@parisjanitor.fr';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-1234';

async function seedPricing(): Promise<void> {
  await commissionTierRepository.replaceCommissionTiers(DEFAULT_COMMISSION_TIERS);
  for (const plan of DEFAULT_VIP_PLANS) {
    await vipPlanRepository.upsertVipPlan(plan);
  }
  await platformSettingsRepository.updateSettings({
    stayCommissionBps: 2000,
    ownerYearlyFeeCents: 10000,
    simulatorOptions: DEFAULT_SIMULATOR_OPTIONS,
  });
}

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);

  const reset = process.env.SEED_DEMO_RESET === '1';
  const alreadySeeded = (await maintenanceRepository.countDocumentsIn('users')) > 0;
  if (alreadySeeded && !reset) {
    console.error('Des données existent déjà. Relancez avec SEED_DEMO_RESET=1 pour les remplacer.');
    await disconnectDatabase();
    process.exit(1);
  }
  if (reset) {
    const cleared = await maintenanceRepository.resetDemoData();
    console.log('Collections vidées : ' + cleared.length);
  }

  await seedPricing();
  console.log('Tarification : barème annexe 1, formules annexe 2, options du simulateur');

  const admin = await userRepository.createUser({
    email: ADMIN_EMAIL,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    role: 'admin',
    profile: { firstName: 'Admin', lastName: 'Paris Janitor' },
  });
  configureAdmin(admin.id);

  const travelers = new Map<string, string>();
  for (const traveler of TRAVELERS) {
    const user = await userRepository.createUser({
      email: traveler.email,
      passwordHash: await hashPassword(PASSWORD),
      role: 'traveler',
      profile: { firstName: traveler.firstName, lastName: traveler.lastName },
    });
    if (traveler.tier !== 'free' && traveler.anchorMonthsAgo !== null) {
      const anchorAt = monthsAgo(traveler.anchorMonthsAgo);
      const currentPeriodEnd = new Date(anchorAt);
      currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 1);
      await userRepository.updateUserVip(user.id, {
        tier: traveler.tier,
        status: 'active',
        anchorAt,
        currentPeriodEnd,
        interval: 'yearly',
        stripeSubscriptionId: 'sub_demo_' + traveler.tier,
      });
    }
    travelers.set(traveler.email, user.id);
  }
  console.log('Comptes : 1 admin, ' + TRAVELERS.length + ' voyageurs (Free, Bag Packer, Explorator)');

  const providers = new Map<string, string>();
  for (const provider of PROVIDERS) {
    const created = await providerRepository.createProvider({ ...provider, status: 'validated' });
    providers.set(provider.name, created.id);
  }

  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await serviceCategoryRepository.createCategory(category);
    categories.set(category.slug, created.id);
  }

  const offerings = new Map<string, string>();
  for (const offering of OFFERINGS) {
    const created = await serviceOfferingRepository.createOffering({
      name: offering.name,
      description: offering.description,
      categoryId: categories.get(offering.category)!,
      providerId: providers.get(offering.provider)!,
      pricingRule: offering.pricingRule,
      vatRateBps: offering.vatRateBps,
      vipOnly: offering.vipOnly,
      active: true,
    });
    offerings.set(offering.name, created.id);
  }
  console.log('Catalogue : ' + PROVIDERS.length + ' prestataires, ' + CATEGORIES.length + ' catégories, ' + OFFERINGS.length + ' prestations');

  const properties = new Map<string, string>();
  for (const property of PROPERTIES) {
    const created = await propertyRepository.createProperty({
      title: property.title,
      description: property.description,
      address: { street: property.street, postalCode: property.postalCode, city: 'Paris', arrondissement: property.arrondissement },
      capacity: property.capacity,
      bedrooms: property.bedrooms,
      surfaceM2: property.surfaceM2,
      amenities: property.amenities,
      nightlyRateHtCents: property.nightlyRateHtCents,
      vatRateBps: 1000,
      status: property.status === 'published' ? 'pending' : property.status,
    });
    if (property.status === 'published') {
      await propertyRepository.updateProperty(created.id, { status: 'published' });
    }
    properties.set(property.title, created.id);
  }
  console.log('Biens : 4 publiés, 1 en attente de modération');

  const lea = travelers.get('lea.martin@example.fr')!;
  const hugo = travelers.get('hugo.bernard@example.fr')!;
  const nina = travelers.get('nina.rossi@example.fr')!;

  await createStay(lea, { propertyId: properties.get('Studio Montorgueil')!, startDate: isoDay(dayOfMonth(-1, 4)), endDate: isoDay(dayOfMonth(-1, 8)), guests: 2 }, 'paid-completed');
  await createStay(hugo, { propertyId: properties.get('Deux-pièces Marais')!, startDate: isoDay(dayOfMonth(-1, 12)), endDate: isoDay(dayOfMonth(-1, 17)), guests: 4 }, 'paid-completed');
  await createStay(nina, { propertyId: properties.get('Loft Canal Saint-Martin')!, startDate: isoDay(dayOfMonth(-1, 20)), endDate: isoDay(dayOfMonth(-1, 23)), guests: 5 }, 'paid-completed');
  await createStay(lea, { propertyId: properties.get('Studio Montorgueil')!, startDate: isoDay(dayOfMonth(1, 9)), endDate: isoDay(dayOfMonth(1, 13)), guests: 2 }, 'confirmed');
  await createStay(hugo, { propertyId: properties.get('Chambre de bonne Montmartre')!, startDate: isoDay(dayOfMonth(1, 18)), endDate: isoDay(dayOfMonth(1, 20)), guests: 1 }, 'requested');
  console.log('Séjours : 3 passés payés et clôturés, 1 confirmé à venir, 1 en attente');

  const taxi = offerings.get('Transfert aéroport')!;
  const menage = offerings.get('Ménage complet du logement')!;
  const linge = offerings.get('Fourniture du linge de maison')!;
  const photos = offerings.get('Photos professionnelles')!;
  const plomberie = offerings.get('Dépannage plomberie')!;
  const conciergerie = offerings.get('Conciergerie privée 24h/24')!;

  const taxiLea = await createService(lea, { offeringId: taxi, qty: 22, scheduledAt: dayOfMonth(-1, 4, 8) }, 'completed', {
    performedAt: dayOfMonth(-1, 4, 8),
    durationMinutes: 55,
    workDone: 'Transfert Roissy CDG vers le logement, 22 km, deux valises.',
    materialsUsed: 'Berline 4 places',
  });
  const menageLea = await createService(lea, { offeringId: menage, qty: 1, scheduledAt: dayOfMonth(-1, 8, 11) }, 'completed', {
    performedAt: dayOfMonth(-1, 8, 11),
    durationMinutes: 120,
    workDone: 'Ménage complet après départ : cuisine, salle d’eau, sols et vitres.',
    materialsUsed: 'Produits écologiques fournis',
  });
  const lingeHugo = await createService(hugo, { offeringId: linge, qty: 1, scheduledAt: dayOfMonth(-1, 12, 9) }, 'completed', {
    performedAt: dayOfMonth(-1, 12, 9),
    durationMinutes: 30,
    workDone: 'Livraison de deux parures de lit et six serviettes, reprise le jour du départ.',
  });
  const plomberieHugo = await createService(hugo, { offeringId: plomberie, qty: 2, scheduledAt: dayOfMonth(-1, 15, 14) }, 'completed', {
    performedAt: dayOfMonth(-1, 15, 14),
    durationMinutes: 105,
    workDone: 'Remplacement du mitigeur de la salle de bain et purge du chauffe-eau.',
    materialsUsed: 'Mitigeur thermostatique, joints',
    incidents: 'Coupure d’eau de 20 minutes signalée au voyageur.',
  });
  const conciergerieNina = await createService(nina, { offeringId: conciergerie, qty: 1, scheduledAt: dayOfMonth(-1, 20, 16) }, 'completed', {
    performedAt: dayOfMonth(-1, 20, 16),
    durationMinutes: 240,
    workDone: 'Accueil personnalisé, remise des clés et accompagnement pendant le séjour.',
  });
  const photosNina = await createService(nina, { offeringId: photos, qty: 1, scheduledAt: dayOfMonth(-1, 22, 10) }, 'completed', {
    performedAt: dayOfMonth(-1, 22, 10),
    durationMinutes: 90,
    workDone: 'Reportage photo du loft, 25 clichés retouchés livrés.',
  });

  await createService(lea, { offeringId: taxi, qty: 18, scheduledAt: dayOfMonth(1, 9, 7) }, 'confirmed');
  await createService(hugo, { offeringId: menage, qty: 1, scheduledAt: dayOfMonth(1, 18, 12) }, 'requested');
  console.log('Prestations : 6 réalisées avec fiche d’intervention complétée, 1 confirmée, 1 en attente');

  await addReview(taxiLea, 5, 'Chauffeur ponctuel, véhicule impeccable et trajet très agréable.', 'approved');
  await addReview(menageLea, 4, 'Logement nickel au retour, quelques traces sur les vitres.', 'approved');
  await addReview(plomberieHugo, 5, 'Intervention rapide, plombier très pédagogue sur l’entretien du chauffe-eau.', 'approved');
  await addReview(conciergerieNina, 5, 'Accueil parfait, on se sent attendu. C’est ce qui justifie l’abonnement.', 'approved');
  await addReview(lingeHugo, 3, 'Linge propre mais livré avec deux heures de retard.', 'pending');
  await addReview(photosNina, 1, 'Contenu hors sujet publié par erreur.', 'rejected', 'Commentaire sans rapport avec la prestation.');
  console.log('Avis : 4 publiés, 1 en attente de modération, 1 refusé');

  await addConversation(taxiLea, 'Transfert aéroport', [
    { role: 'traveler', body: 'Bonjour, mon vol atterrit à 7h15, le chauffeur peut-il patienter en cas de retard bagages ?' },
    { role: 'concierge', body: 'Bonjour Léa, oui, le chauffeur suit votre numéro de vol et attend jusqu’à 45 minutes sans supplément.' },
    { role: 'traveler', body: 'Parfait, merci beaucoup !' },
  ]);
  await addConversation(plomberieHugo, 'Dépannage plomberie', [
    { role: 'traveler', body: 'La fuite sous l’évier a repris ce matin, est-ce couvert par l’intervention de la semaine dernière ?' },
    { role: 'concierge', body: 'Nous envoyons le plombier demain matin sans frais supplémentaires, la pièce était sous garantie.' },
  ]);
  await addConversation(conciergerieNina, 'Conciergerie privée 24h/24', [
    { role: 'traveler', body: 'Peut-on prévoir une réservation au restaurant pour quatre personnes vendredi soir ?' },
  ]);
  console.log('Messagerie : 3 fils dont 1 en attente de réponse');

  const settings = await platformSettingsRepository.getSettings();
  for (const lead of LEADS) {
    await addLead({ input: lead.input, breakdown: computeBreakdown(lead.input, settings) }, lead.contact, lead.status, lead.notes);
  }
  console.log('Simulations : ' + LEADS.length + ' leads dont 3 avec coordonnées');

  const lastMonth = dayOfMonth(-1, 1);
  const payouts = await providerPayoutService.generateProviderInvoices({
    year: lastMonth.getUTCFullYear(),
    month: lastMonth.getUTCMonth() + 1,
  });
  console.log('Factures prestataires du mois précédent : ' + payouts.created.length + ' émises');
  console.log('Factures : ' + (await invoiceSummary()));
  for (const rating of await providerRatings()) {
    console.log('Note prestataire — ' + rating);
  }

  console.log('');
  console.log('Comptes de démonstration :');
  console.log('  admin      ' + ADMIN_EMAIL + ' / ' + ADMIN_PASSWORD);
  for (const traveler of TRAVELERS) {
    console.log('  ' + traveler.tier.padEnd(10) + ' ' + traveler.email + ' / ' + PASSWORD);
  }

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
