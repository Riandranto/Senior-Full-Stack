// server/services/email.ts
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Configuration du transporteur email
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  
  // Configuration pour différents providers
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
  
  // Vérifier si les credentials sont configurés
  if (config.auth.user && config.auth.pass) {
    transporter = nodemailer.createTransport(config);
    logger.info('✅ Email transporter initialized');
  } else {
    logger.warn('⚠️ SMTP credentials not configured, email sending disabled');
    // Mode développement: utiliser ethereal.email pour les tests
    if (process.env.NODE_ENV === 'development') {
      nodemailer.createTestAccount((err, account) => {
        if (err) {
          logger.error('Failed to create ethereal account:', err);
          return;
        }
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        });
        logger.info('📧 Ethereal email test account created:', account.web);
      });
    }
  }
  
  return transporter;
}

export async function sendEmailOtp(email: string, otp: string, language: string = 'fr'): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    logger.warn('Email transporter not available, skipping email send');
    return false;
  }
  
  const isFrench = language === 'fr';
  
  const subject = isFrench ? 'Code de vérification Farady' : 'Kaody fanamarinana Farady';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background: linear-gradient(135deg, #2563EB, #1D4ED8);
          border-radius: 12px 12px 0 0;
          margin: -20px -20px 20px -20px;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 24px;
        }
        .otp-code {
          text-align: center;
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #2563EB;
          background-color: #f0f4ff;
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0;
          font-family: monospace;
        }
        .message {
          color: #333;
          line-height: 1.6;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          color: #888;
          font-size: 12px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .button {
          display: inline-block;
          background-color: #2563EB;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚕 Farady</h1>
        </div>
        
        <div class="message">
          ${isFrench ? 
            '<p>Bonjour,</p><p>Vous avez demandé un code de vérification pour vous connecter à l\'application Farady.</p>' :
            '<p>Salama,</p><p>Nangataka kaody fanamarinana hiditra amin\'ny fampiharana Farady ianao.</p>'
          }
        </div>
        
        <div class="otp-code">
          ${otp}
        </div>
        
        <div class="message">
          ${isFrench ? 
            '<p>Ce code est valable pendant 5 minutes.</p><p><strong>Ne partagez jamais ce code avec personne.</strong></p>' :
            '<p>Ity kaody ity dia manan-kery mandritra ny 5 minitra.</p><p><strong>Aza zaraina amin\'olona ity kaody ity.</strong></p>'
          }
        </div>
        
        <div class="footer">
          <p>Farady - Application de transport</p>
          <p>${isFrench ? 'Cet email a été envoyé automatiquement, merci de ne pas y répondre.' : 'Ity mailaka ity dia nalefa ho azy, aza mamaly.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const textContent = isFrench 
    ? `Bonjour,\n\nVotre code de vérification Farady est: ${otp}\n\nCe code est valable pendant 5 minutes.\n\nNe partagez jamais ce code avec personne.\n\nFarady - Application de transport`
    : `Salama,\n\nNy kaody fanamarinanao Farady dia: ${otp}\n\nIty kaody ity dia manan-kery mandritra ny 5 minitra.\n\nAza zaraina amin'olona ity kaody ity.\n\nFarady - Rindranasa fitaterana`;
  
  try {
    const info = await transport.sendMail({
      from: `"Farady" <${process.env.SMTP_FROM || 'noreply@farady.com'}>`,
      to: email,
      subject: subject,
      text: textContent,
      html: htmlContent,
    });
    
    logger.info(`Email OTP sent to ${email}: ${info.messageId}`);
    
    // En mode développement, afficher l'URL de prévisualisation Ethereal
    if (process.env.NODE_ENV === 'development' && info.messageId && (info as any).getTestMessageUrl) {
      logger.info(`📧 Preview URL: ${(info as any).getTestMessageUrl()}`);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
}

// Fonction pour générer un OTP à 6 chiffres
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}