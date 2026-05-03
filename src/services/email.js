const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

// Email de confirmação pro cliente quando ele envia o lead
async function sendLeadConfirmation(lead, vehicle) {
  await resend.emails.send({
    from: FROM,
    to: lead.email,
    subject: `Recebemos sua solicitação — ${vehicle.brand} ${vehicle.model}`,
    html: `
      <h2>Olá, ${lead.fullName}!</h2>
      <p>Recebemos sua solicitação de aluguel para o veículo:</p>
      <p><strong>${vehicle.year} ${vehicle.brand} ${vehicle.model}</strong></p>
      <p>Entraremos em contato em breve pelo telefone <strong>${lead.phone}</strong>.</p>
      <br/>
      <p>Obrigado!</p>
    `,
  });
}

// Lembrete de DL vencendo (chamado pelo cron)
async function sendLicenseExpiryReminder(customer, daysLeft) {
  if (!customer.email) return;
  await resend.emails.send({
    from: FROM,
    to: customer.email,
    subject: `Sua driver's license vence em ${daysLeft} dias`,
    html: `
      <h2>Olá, ${customer.fullName}!</h2>
      <p>Sua driver's license vence em <strong>${daysLeft} dias</strong>.</p>
      <p>Renove antes do vencimento para continuar com o aluguel ativo.</p>
      <br/>
      <p>Qualquer dúvida, entre em contato conosco.</p>
    `,
  });
}

module.exports = { sendLeadConfirmation, sendLicenseExpiryReminder };