import speakeasy from 'speakeasy';
import { redisClient } from './redis';
import { smsService } from './sms.service';
import { logger } from './logger';

interface OTPData {
  otp: string;
  attempts: number;
  expiresAt: Date;
}

export class OTPService {
  private static readonly OTP_TTL = 300; // 5 minutes en secondes
  private static readonly MAX_ATTEMPTS = 3;
  
  async generateAndSendOTP(phone: string): Promise<boolean> {
    try {
      // Générer OTP
      const secret = process.env.OTP_SECRET || 'default-secret';
      const otp = speakeasy.totp({
        secret: secret + phone,
        digits: 6,
        step: 300 // 5 minutes
      });
      
      // Stocker dans Redis avec TTL
      const otpData: OTPData = {
        otp,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTPService.OTP_TTL * 1000)
      };
      
      await redisClient.setex(
        `otp:${phone}`,
        OTPService.OTP_TTL,
        JSON.stringify(otpData)
      );
      
      // Envoyer par SMS
      const sent = await smsService.sendOTP(phone, otp);
      
      if (!sent) {
        logger.warn({ phone }, 'Failed to send OTP via SMS');
        // Stocker quand même pour permettre le développement
      }
      
      logger.info({ phone }, 'OTP generated and stored');
      return true;
    } catch (error) {
      logger.error({ error, phone }, 'OTP generation failed');
      return false;
    }
  }
  
  async verifyOTP(phone: string, providedOTP: string): Promise<boolean> {
    try {
      // Récupérer de Redis
      const data = await redisClient.get(`otp:${phone}`);
      
      if (!data) {
        logger.warn({ phone }, 'OTP not found or expired');
        return false;
      }
      
      const otpData: OTPData = JSON.parse(data);
      
      // Vérifier expiration
      if (new Date() > new Date(otpData.expiresAt)) {
        await redisClient.del(`otp:${phone}`);
        logger.warn({ phone }, 'OTP expired');
        return false;
      }
      
      // Vérifier nombre de tentatives
      if (otpData.attempts >= OTPService.MAX_ATTEMPTS) {
        await redisClient.del(`otp:${phone}`);
        logger.warn({ phone }, 'Max OTP attempts exceeded');
        return false;
      }
      
      // Vérifier OTP
      const isValid = otpData.otp === providedOTP;
      
      if (!isValid) {
        // Incrémenter les tentatives
        otpData.attempts++;
        await redisClient.setex(
          `otp:${phone}`,
          OTPService.OTP_TTL,
          JSON.stringify(otpData)
        );
        
        logger.warn({ phone, attempts: otpData.attempts }, 'Invalid OTP');
        return false;
      }
      
      // OTP valide - supprimer
      await redisClient.del(`otp:${phone}`);
      logger.info({ phone }, 'OTP verified successfully');
      
      return true;
    } catch (error) {
      logger.error({ error, phone }, 'OTP verification failed');
      return false;
    }
  }
  
  async resendOTP(phone: string): Promise<boolean> {
    // Supprimer ancien OTP
    await redisClient.del(`otp:${phone}`);
    // Générer nouveau
    return this.generateAndSendOTP(phone);
  }
}

export const otpService = new OTPService();