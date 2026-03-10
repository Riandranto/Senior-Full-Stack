import twilio from 'twilio';
import { logger } from '../utils/logger';

// Interface pour support multi-opérateurs Madagascar
interface SMSProvider {
  send(phone: string, message: string): Promise<boolean>;
}

class TwilioProvider implements SMSProvider {
  private client: twilio.Twilio;
  
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  
  async send(phone: string, message: string): Promise<boolean> {
    try {
      // Format numéro Madagascar
      const formattedPhone = phone.startsWith('+261') ? phone : `+261${phone.slice(1)}`;
      
      await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });
      
      logger.info({ phone }, 'SMS sent successfully');
      return true;
    } catch (error) {
      logger.error({ error, phone }, 'Failed to send SMS');
      return false;
    }
  }
}

// Provider pour Orange Madagascar (API spécifique)
class OrangeMadagascarProvider implements SMSProvider {
  private apiKey: string;
  private apiSecret: string;
  
  constructor() {
    this.apiKey = process.env.ORANGE_API_KEY!;
    this.apiSecret = process.env.ORANGE_API_SECRET!;
  }
  
  async send(phone: string, message: string): Promise<boolean> {
    try {
      // Implémentation API Orange Madagascar
      const response = await fetch('https://api.orange.madagascar/sms/v1/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone,
          message,
          sender: 'FARADY'
        })
      });
      
      return response.ok;
    } catch (error) {
      logger.error({ error }, 'Orange SMS failed');
      return false;
    }
  }
}

export class SMSService {
  private providers: SMSProvider[];
  private currentProvider: number = 0;
  
  constructor() {
    this.providers = [
      new TwilioProvider(),
      new OrangeMadagascarProvider()
    ];
  }
  
  async sendOTP(phone: string, otp: string): Promise<boolean> {
    const message = `Farady: Votre code de confirmation est ${otp}. Valable 5 minutes.`;
    
    // Try providers in round-robin
    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentProvider + i) % this.providers.length;
      const success = await this.providers[providerIndex].send(phone, message);
      
      if (success) {
        this.currentProvider = (providerIndex + 1) % this.providers.length;
        return true;
      }
    }
    
    // Fallback to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV OTP] ${phone}: ${otp}`);
      return true;
    }
    
    return false;
  }
}

export const smsService = new SMSService();