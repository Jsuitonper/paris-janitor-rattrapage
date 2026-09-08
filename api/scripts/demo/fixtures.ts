import type { PricingRule } from '../../src/types/pricing';

export const REFERENCE = new Date();

export function monthStart(offset: number): Date {
  return new Date(Date.UTC(REFERENCE.getUTCFullYear(), REFERENCE.getUTCMonth() + offset, 1));
}

export function dayOfMonth(monthOffset: number, day: number, hour = 10): Date {
  return new Date(Date.UTC(REFERENCE.getUTCFullYear(), REFERENCE.getUTCMonth() + monthOffset, day, hour));
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthsAgo(count: number): Date {
  const date = new Date(REFERENCE);
  date.setUTCMonth(date.getUTCMonth() - count);
  return date;
}

export const PASSWORD = 'demo-1234';

export const TRAVELERS = [
  { email: 'lea.martin@example.fr', firstName: 'Léa', lastName: 'Martin', tier: 'free' as const, anchorMonthsAgo: null },
  { email: 'hugo.bernard@example.fr', firstName: 'Hugo', lastName: 'Bernard', tier: 'bagpacker' as const, anchorMonthsAgo: 8 },
  { email: 'nina.rossi@example.fr', firstName: 'Nina', lastName: 'Rossi', tier: 'explorator' as const, anchorMonthsAgo: 4 },
];

export const PROVIDERS = [
  { name: 'Taxi Montorgueil', job: 'Chauffeur', email: 'contact@taxi-montorgueil.fr', phone: '0140260101' },
  { name: 'Éclat de Paris', job: 'Agent d’entretien', email: 'planning@eclatdeparis.fr', phone: '0140260202' },
  { name: 'Studio Lumière', job: 'Photographe', email: 'studio@lumiere-paris.fr', phone: '0140260303' },
  { name: 'Plomberie Rivoli', job: 'Plombier', email: 'urgence@plomberie-rivoli.fr', phone: '0140260404' },
];

export const CATEGORIES = [
  { name: 'Transport', slug: 'transport', description: 'Transferts aéroport, gares et bagages' },
  { name: 'Entretien', slug: 'entretien', description: 'Ménage, linge et remise en état' },
  { name: 'Image', slug: 'image', description: 'Photographie et mise en valeur du logement' },
  { name: 'Dépannage', slug: 'depannage', description: 'Petites réparations et urgences' },
];

const fixedRule = (priceCents: number): PricingRule => ({
  unit: 'fixed',
  baseCents: priceCents,
  tiers: [{ upToQty: null, unitPriceCents: 0 }],
  minCents: 100,
});

export const OFFERINGS = [
  {
    name: 'Transfert aéroport',
    description: 'Prise en charge à l’adresse du logement, dépose au terminal. Tarif dégressif au kilomètre.',
    category: 'transport',
    provider: 'Taxi Montorgueil',
    vatRateBps: 2000,
    vipOnly: false,
    pricingRule: {
      unit: 'km' as const,
      baseCents: 500,
      tiers: [
        { upToQty: 10, unitPriceCents: 200 },
        { upToQty: null, unitPriceCents: 150 },
      ],
      minCents: 100,
    },
  },
  {
    name: 'Ménage complet du logement',
    description: 'Nettoyage intégral entre deux séjours, produits fournis.',
    category: 'entretien',
    provider: 'Éclat de Paris',
    vatRateBps: 2000,
    vipOnly: false,
    pricingRule: fixedRule(5000),
  },
  {
    name: 'Fourniture du linge de maison',
    description: 'Draps, serviettes et torchons livrés et repris.',
    category: 'entretien',
    provider: 'Éclat de Paris',
    vatRateBps: 2000,
    vipOnly: false,
    pricingRule: fixedRule(2500),
  },
  {
    name: 'Photos professionnelles',
    description: 'Reportage photo du logement, retouches incluses, livraison sous 72 heures.',
    category: 'image',
    provider: 'Studio Lumière',
    vatRateBps: 2000,
    vipOnly: false,
    pricingRule: fixedRule(15000),
  },
  {
    name: 'Dépannage plomberie',
    description: 'Intervention ponctuelle facturée à l’heure, première heure au tarif plein.',
    category: 'depannage',
    provider: 'Plomberie Rivoli',
    vatRateBps: 2000,
    vipOnly: false,
    pricingRule: {
      unit: 'hour' as const,
      baseCents: 3000,
      tiers: [
        { upToQty: 1, unitPriceCents: 6000 },
        { upToQty: null, unitPriceCents: 4500 },
      ],
      minCents: 100,
    },
  },
  {
    name: 'Conciergerie privée 24h/24',
    description: 'Ligne directe, accueil personnalisé et conciergerie dédiée pendant tout le séjour.',
    category: 'transport',
    provider: 'Taxi Montorgueil',
    vatRateBps: 2000,
    vipOnly: true,
    pricingRule: fixedRule(30000),
  },
];

export const PROPERTIES = [
  {
    title: 'Studio Montorgueil',
    description: 'Studio lumineux au cœur du 2e, à deux pas de la rue Montorgueil et de ses commerces.',
    street: '23 rue Montorgueil',
    postalCode: '75002',
    arrondissement: 2,
    capacity: 2,
    bedrooms: 1,
    surfaceM2: 25,
    amenities: ['Wi-Fi', 'Lave-linge', 'Cuisine équipée'],
    nightlyRateHtCents: 12000,
    status: 'published' as const,
  },
  {
    title: 'Deux-pièces Marais',
    description: 'Appartement de charme sous poutres apparentes, idéal pour un couple ou une petite famille.',
    street: '8 rue des Rosiers',
    postalCode: '75004',
    arrondissement: 4,
    capacity: 4,
    bedrooms: 2,
    surfaceM2: 48,
    amenities: ['Wi-Fi', 'Ascenseur', 'Lave-vaisselle', 'Climatisation'],
    nightlyRateHtCents: 19000,
    status: 'published' as const,
  },
  {
    title: 'Loft Canal Saint-Martin',
    description: 'Ancien atelier réhabilité, grande verrière et mezzanine, sur les quais du canal.',
    street: '112 quai de Jemmapes',
    postalCode: '75010',
    arrondissement: 10,
    capacity: 6,
    bedrooms: 3,
    surfaceM2: 92,
    amenities: ['Wi-Fi', 'Terrasse', 'Parking', 'Lave-linge'],
    nightlyRateHtCents: 28000,
    status: 'published' as const,
  },
  {
    title: 'Chambre de bonne Montmartre',
    description: 'Petit nid sous les toits avec vue sur les toits de Paris, refait à neuf.',
    street: '15 rue Lepic',
    postalCode: '75018',
    arrondissement: 18,
    capacity: 1,
    bedrooms: 1,
    surfaceM2: 14,
    amenities: ['Wi-Fi'],
    nightlyRateHtCents: 7000,
    status: 'published' as const,
  },
  {
    title: 'Duplex Saint-Germain',
    description: 'Duplex haussmannien à valider : photos et état des lieux en attente.',
    street: '4 rue de Buci',
    postalCode: '75006',
    arrondissement: 6,
    capacity: 4,
    bedrooms: 2,
    surfaceM2: 65,
    amenities: ['Wi-Fi', 'Cheminée'],
    nightlyRateHtCents: 24000,
    status: 'pending' as const,
  },
];

export const LEADS = [
  {
    input: { arrondissement: 11, surfaceM2: 42, capacity: 4, bedrooms: 2, nightlyRateHtCents: 14000, occupancyRateBps: 6500, averageStayNights: 3, optionKeys: ['cleaning', 'linen'] },
    contact: { firstName: 'Camille', lastName: 'Fournier', email: 'camille.fournier@example.fr', phone: '0601020304' },
    status: 'contacted' as const,
    notes: 'Rappelée, souhaite démarrer en janvier. Relance prévue après les fêtes.',
  },
  {
    input: { arrondissement: 6, surfaceM2: 70, capacity: 5, bedrooms: 3, nightlyRateHtCents: 26000, occupancyRateBps: 7500, averageStayNights: 4, optionKeys: ['cleaning', 'checkin', 'photos'] },
    contact: { firstName: 'Antoine', lastName: 'Lemaire', email: 'a.lemaire@example.fr', phone: '0611223344' },
    status: 'converted' as const,
    notes: 'Contrat signé, premier bien en cours de publication.',
  },
  {
    input: { arrondissement: 18, surfaceM2: 18, capacity: 2, bedrooms: 1, nightlyRateHtCents: 8000, occupancyRateBps: 5000, averageStayNights: 2, optionKeys: [] },
    contact: { firstName: 'Sophie', lastName: 'Nguyen', email: 'sophie.nguyen@example.fr', phone: '' },
    status: 'new' as const,
    notes: '',
  },
  {
    input: { arrondissement: 3, surfaceM2: 55, capacity: 4, bedrooms: 2, nightlyRateHtCents: 21000, occupancyRateBps: 8000, averageStayNights: 3, optionKeys: ['cleaning'] },
    contact: null,
    status: 'new' as const,
    notes: '',
  },
];
