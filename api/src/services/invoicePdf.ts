import PDFDocument from 'pdfkit';
import type { Invoice, InvoiceLine } from '../types/invoice';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function euros(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const units = Math.floor(absolute / 100).toString();
  const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + grouped + ',' + (absolute % 100).toString().padStart(2, '0') + ' EUR';
}

function day(date: Date): string {
  return new Date(date).toISOString().slice(0, 10).split('-').reverse().join('/');
}

function percent(bps: number): string {
  return (bps / 100).toString().replace('.', ',') + ' %';
}

function header(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  doc.fontSize(18).text('Paris Janitor', { continued: false });
  doc.fontSize(9).fillColor('#555555');
  doc.text('23 rue Montorgueil, 75002 Paris');
  doc.text('Conciergerie immobilière');
  doc.moveDown(1.2);
  doc.fillColor('#000000').fontSize(14);
  doc.text(invoice.type === 'traveler' ? 'Facture voyageur' : 'Facture prestataire');
  doc.fontSize(10).fillColor('#333333');
  doc.text('Numéro : ' + invoice.number);
  doc.text('Émise le : ' + day(invoice.issuedAt));
  if (invoice.period) {
    doc.text('Période : ' + MONTHS[invoice.period.month - 1] + ' ' + invoice.period.year);
  }
  doc.moveDown(0.8);
  doc.fillColor('#000000').fontSize(10).text(invoice.party.name);
  doc.fontSize(9).fillColor('#555555');
  if (invoice.party.email) doc.text(invoice.party.email);
  if (invoice.party.detail) doc.text(invoice.party.detail);
  doc.fillColor('#000000').moveDown(1);
}

function travelerLines(doc: PDFKit.PDFDocument, lines: InvoiceLine[]): void {
  doc.fontSize(9);
  for (const line of lines) {
    doc.font('Helvetica-Bold').text(line.label);
    doc.font('Helvetica').fillColor('#555555');
    doc.text('Réalisée le ' + day(line.performedAt) + ' — ' + line.qty + ' ' + line.unitLabel);
    doc.fillColor('#000000');
    doc.text('Montant HT : ' + euros(line.grossHtCents));
    if (line.discountHtCents > 0) {
      const label = line.netHtCents === 0 ? 'Prestation offerte (avantage VIP)' : 'Remise VIP';
      doc.text(label + ' : -' + euros(line.discountHtCents));
    }
    doc.text('Net HT : ' + euros(line.netHtCents));
    doc.text('TVA ' + percent(line.vatRateBps) + ' : ' + euros(line.vatCents));
    doc.text('Total TTC : ' + euros(line.totalTtcCents));
    doc.moveDown(0.6);
  }
}

function providerLines(doc: PDFKit.PDFDocument, lines: InvoiceLine[]): void {
  doc.fontSize(9);
  for (const line of lines) {
    doc.font('Helvetica-Bold').text(line.label);
    doc.font('Helvetica').fillColor('#555555');
    doc.text('Réalisée le ' + day(line.performedAt) + ' — ' + line.qty + ' ' + line.unitLabel);
    doc.fillColor('#000000');
    doc.text('Montant facturé HT : ' + euros(line.grossHtCents));
    doc.text('Commission Paris Janitor ' + percent(line.commissionBps) + ' : -' + euros(line.commissionHtCents));
    doc.text('Net prestataire HT : ' + euros(line.providerNetHtCents));
    doc.moveDown(0.6);
  }
}

function totals(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.6);
  doc.fontSize(10);
  if (invoice.type === 'traveler') {
    doc.text('Total HT : ' + euros(invoice.totals.grossHtCents));
    if (invoice.totals.discountHtCents > 0) {
      doc.text('Total remises : -' + euros(invoice.totals.discountHtCents));
    }
    doc.text('Base imposable HT : ' + euros(invoice.totals.netHtCents));
    doc.text('TVA : ' + euros(invoice.totals.vatCents));
    doc.font('Helvetica-Bold').fontSize(12).text('Net à payer TTC : ' + euros(invoice.totals.totalTtcCents));
  } else {
    doc.text('Total facturé HT : ' + euros(invoice.totals.grossHtCents));
    doc.text('Total commissions Paris Janitor : -' + euros(invoice.totals.commissionHtCents));
    doc.font('Helvetica-Bold').fontSize(12).text('Net à reverser HT : ' + euros(invoice.totals.providerNetHtCents));
  }
  doc.font('Helvetica').fontSize(8).fillColor('#777777').moveDown(1);
  doc.text('Document archivé par Paris Janitor. Les montants figés à l’émission ne sont pas recalculés.');
}

export function renderInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      compress: false,
      info: { Title: invoice.number, Author: 'Paris Janitor', CreationDate: invoice.issuedAt },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, invoice);
    if (invoice.type === 'traveler') {
      travelerLines(doc, invoice.lines);
    } else {
      providerLines(doc, invoice.lines);
    }
    totals(doc, invoice);

    doc.end();
  });
}
