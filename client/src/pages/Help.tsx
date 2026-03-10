import { MobileLayout } from '@/components/RoleLayout';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Phone, Shield, BookOpen, AlertTriangle, Info } from 'lucide-react';

export default function HelpPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) return null;

  const role = user.role.toLowerCase() as 'passenger' | 'driver';

  const faqItems = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') },
  ];

  const emergencyContacts = [
    { label: t('police'), number: '117', color: 'text-blue-600 dark:text-blue-400' },
    { label: t('ambulance'), number: '118', color: 'text-red-600 dark:text-red-400' },
    { label: t('fire'), number: '117', color: 'text-orange-600 dark:text-orange-400' },
  ];

  const passengerGuide = [
    t('guide_passenger_1'),
    t('guide_passenger_2'),
    t('guide_passenger_3'),
    t('guide_passenger_4'),
    t('guide_passenger_5'),
  ];

  const driverGuide = [
    t('guide_driver_1'),
    t('guide_driver_2'),
    t('guide_driver_3'),
    t('guide_driver_4'),
    t('guide_driver_5'),
  ];

  const safetyTips = [
    t('safety_tip_1'),
    t('safety_tip_2'),
    t('safety_tip_3'),
  ];

  return (
    <MobileLayout role={role}>
      <div className="absolute inset-0 overflow-y-auto p-4 pt-20 pb-8 space-y-6">
        <h1 className="text-2xl font-bold font-display" data-testid="text-help-title">
          {t('help')}
        </h1>

        <Card className="p-4 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-emergency">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{t('emergency_contacts')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Fort-Dauphin / Tolagnaro</p>
          <div className="space-y-3">
            {emergencyContacts.map((contact) => (
              <a
                key={contact.number + contact.label}
                href={`tel:${contact.number}`}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover-elevate"
                data-testid={`link-call-${contact.label.toLowerCase()}`}
              >
                <span className="font-medium">{contact.label}</span>
                <span className={`text-lg font-bold ${contact.color}`}>{contact.number}</span>
              </a>
            ))}
          </div>
        </Card>

        <Card className="p-4 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-faq">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{t('faq')}</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-sm" data-testid={`accordion-faq-${index}`}>
                  {item.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground" data-testid={`text-faq-answer-${index}`}>{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <Card className="p-4 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-guide">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{t('how_to_use')}</h2>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2" data-testid="text-guide-passenger-title">{t('guide_passenger_title')}</h3>
            <ul className="space-y-2">
              {passengerGuide.map((step, i) => (
                <li key={i} className="text-sm text-muted-foreground" data-testid={`text-guide-passenger-${i}`}>{step}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2" data-testid="text-guide-driver-title">{t('guide_driver_title')}</h3>
            <ul className="space-y-2">
              {driverGuide.map((step, i) => (
                <li key={i} className="text-sm text-muted-foreground" data-testid={`text-guide-driver-${i}`}>{step}</li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-4 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-safety">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{t('safety_tips')}</h2>
          </div>
          <ul className="space-y-3">
            {safetyTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground" data-testid={`text-safety-tip-${i}`}>{tip}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-app-info">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('app_version')}</span>
            <span className="text-sm font-medium" data-testid="text-app-version">Farady v1.0.0</span>
          </div>
        </Card>
      </div>
    </MobileLayout>
  );
}
