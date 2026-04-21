// server/services/email.ts
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Configuration du transporteur email
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  
  // En développement sans SMTP, on ne crée pas de transporter
  if (process.env.NODE_ENV === 'development') {
    logger.info('📧 Development mode - emails will be logged to console');
    return null;
  }
  
  // Vérifier les credentials SMTP
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    logger.warn('⚠️ SMTP not configured');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  
  logger.info('✅ Email transporter initialized');
  
  // Vérifier la connexion (ne pas bloquer)
  transporter.verify((error) => {
    if (error) {
      logger.error('❌ SMTP connection failed:', error);
    } else {
      logger.info('✅ SMTP connection verified');
    }
  });
  
  return transporter;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendEmailOtp(email: string, otp: string, language: string = 'fr'): Promise<boolean> {
  const transport = getTransporter();
  
  // En développement, juste logger
  if (process.env.NODE_ENV === 'development') {
    console.log(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                    📧 EMAIL OTP DÉVELOPPEMENT                ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Email: ${email.padEnd(45)}║
    ║  Code OTP: ${otp.padEnd(43)}║
    ║  Expiration: 5 minutes                                       ║
    ╚══════════════════════════════════════════════════════════════╝
    `);
    return true;
  }
  
  if (!transport) {
    logger.warn('Email transporter not available');
    return false;
  }
  
  const isFrench = language === 'fr';
  
  const subject = isFrench ? 'Code de vérification Farady' : 'Kaody fanamarinana Farady';
  
  const textContent = isFrench 
    ? `Bonjour,\n\nVotre code de vérification Farady est: ${otp}\n\nCe code est valable pendant 5 minutes.\n\nNe partagez jamais ce code avec personne.\n\nFarady - Application de transport`
    : `Salama,\n\nNy kaody fanamarinanao Farady dia: ${otp}\n\nIty kaody ity dia manan-kery mandritra ny 5 minitra.\n\nAza zaraina amin'olona ity kaody ity.\n\nFarady - Rindranasa fitaterana`;
  
  try {
    await transport.sendMail({
      from: `"Farady" <${process.env.SMTP_FROM || 'noreply@farady.com'}>`,
      to: email,
      subject: subject,
      text: textContent,
    });
    
    logger.info(`Email OTP sent to ${email}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
}