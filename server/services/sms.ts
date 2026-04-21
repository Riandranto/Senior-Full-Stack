// server/services/sms.ts
import { db } from "../db";
import { phoneOtps } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomInt } from "crypto";

// Générer un OTP à 6 chiffres
export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

// Sauvegarder l'OTP en base
export async function savePhoneOtp(phone: string, otp: string): Promise<void> {
  try {
    // Nettoyer les anciens OTP non utilisés
    await db.delete(phoneOtps)
      .where(and(
        eq(phoneOtps.phone, phone),
        eq(phoneOtps.isUsed, false)
      ));
    
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    await db.insert(phoneOtps).values({
      phone,
      otp,
      expiresAt,
      isUsed: false,
    });
    
    console.log(`✅ OTP saved for ${phone}: ${otp}`);
  } catch (error) {
    console.error('❌ Error saving phone OTP:', error);
    throw error;
  }
}

// Vérifier un OTP
export async function verifyPhoneOtp(phone: string, otp: string): Promise<boolean> {
  try {
    const validOtps = await db.select().from(phoneOtps)
      .where(and(
        eq(phoneOtps.phone, phone),
        eq(phoneOtps.otp, otp),
        eq(phoneOtps.isUsed, false)
      ))
      .limit(1);
    
    if (validOtps.length === 0) {
      console.log(`❌ No valid OTP found for ${phone}`);
      return false;
    }
    
    const validOtp = validOtps[0];
    const now = new Date();
    const expiresAt = new Date(validOtp.expiresAt);
    
    if (now > expiresAt) {
      console.log(`❌ OTP expired for ${phone}`);
      return false;
    }
    
    // Marquer comme utilisé
    await db.update(phoneOtps)
      .set({ isUsed: true })
      .where(eq(phoneOtps.id, validOtp.id));
    
    console.log(`✅ OTP verified for ${phone}`);
    return true;
  } catch (error) {
    console.error('❌ Error verifying phone OTP:', error);
    return false;
  }
}

// Envoyer un SMS (simulé en développement, réel en production)
export async function sendSmsOtp(phone: string, otp: string): Promise<boolean> {
  // Nettoyer le numéro (enlever les espaces, tirets)
  const cleanPhone = phone.replace(/[\s-]/g, '');
  
  // En développement, afficher dans la console ET retourner true
  if (process.env.NODE_ENV === 'development') {
    console.log(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                    📱 SMS OTP DÉVELOPPEMENT                  ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Téléphone: ${cleanPhone.padEnd(40)}║
    ║  Code OTP:  ${otp.padEnd(40)}║
    ║  Expiration: 5 minutes                                       ║
    ╚══════════════════════════════════════════════════════════════╝
    `);
    return true;
  }
  
  // En production, intégrer un service SMS comme Twilio
  try {
    // Décommenter pour Twilio
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    await client.messages.create({
      body: `Votre code Farady est: ${otp}. Valable 5 minutes.`,
      to: cleanPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    console.log(`✅ SMS sent to ${cleanPhone}`);
    return true;
    */
    
    console.log(`📱 SMS would be sent to ${cleanPhone} with OTP: ${otp}`);
    return true;
  } catch (error) {
    console.error('❌ SMS sending failed:', error);
    return false;
  }
}