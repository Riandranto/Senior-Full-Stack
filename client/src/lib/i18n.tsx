import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'mg' | 'fr';

const translations = {
  mg: {
    welcome: "Tonga soa eto amin'ny Farady",
    request_ride: 'Mangataka',
    bidding: 'Tolo-bidy',
    accept: 'Ekena',
    reject: 'Lavina',
    cancel: 'Ajanony',
    arrived: 'Tonga ny mpamily',
    start_ride: 'Atombohy ny dia',
    complete_ride: 'Vita ny dia',
    where_to: 'Ho aiza ianao?',
    pickup: 'Fiaingana',
    dropoff: 'Fahatongavana',
    taxi: 'Taxi',
    bajaj: 'Bajaj',
    finding_drivers: 'Mitady mpamily...',
    price: 'Vidin-dalana',
    eta: 'Fahatongavana (min)',
    send_offer: 'Andefa tolo-bidy',
    online: 'Miasa',
    offline: 'Tsy miasa',
    login_phone: 'Laharana finday',
    login_otp: 'Kaody OTP (ohatra: 123456)',
    login_btn: 'Midira',
    history: 'Tantara',
    profile: 'Mombamomba',
    driver: 'Mpamily',
    passenger: 'Mpanjifa',
    help: 'Fanampiana',
    faq: 'Fanontaniana matetika',
    emergency_contacts: 'Laharan-toerana maika',
    how_to_use: 'Fomba fampiasana',
    police: 'Polisy',
    ambulance: 'Ambulansa',
    fire: 'Afo',
    faq_q1: 'Ahoana ny fomba mangataka fiara?',
    faq_a1: 'Safidio ny toerana hiaingana sy hahatongavana, dia tsindrio ny bokotra "Mangataka". Andraso ny tolo-bidy avy amin\'ny mpamily.',
    faq_q2: 'Ahoana ny fomba fandoavana?',
    faq_a2: 'Ny fandoavana dia ataon\'ny mpanjifa mivantana amin\'ny mpamily rehefa vita ny dia.',
    faq_q3: 'Inona no atao raha tsy tonga ny mpamily?',
    faq_a3: 'Azonao atao ny manafoana ny dia ary mangataka fiara vaovao. Raha misy olana, miantso ny laharana maika.',
    faq_q4: 'Ahoana ny fomba hidirana ho mpamily?',
    faq_a4: 'Sorato ny faha-karatra mpamily ary ny mombamomba ny fiaranao rehefa misoratra anarana.',
    guide_passenger_title: 'Torolalana ho an\'ny mpanjifa',
    guide_passenger_1: '1. Safidio ny toerana hiaingana sy hahatongavana',
    guide_passenger_2: '2. Safidio ny karazana fiara (Taxi na Bajaj)',
    guide_passenger_3: '3. Tsindrio "Mangataka" ary andraso ny tolo-bidy',
    guide_passenger_4: '4. Ekeo ny tolo-bidy tsara indrindra',
    guide_passenger_5: '5. Andraso ny mpamily ary ataovy ny dia',
    guide_driver_title: 'Torolalana ho an\'ny mpamily',
    guide_driver_1: '1. Ampidiro ny kaontinao ary alefaso "Miasa"',
    guide_driver_2: '2. Andraso ny fangatahana avy amin\'ny mpanjifa',
    guide_driver_3: '3. Alefaso ny tolo-bidy vidin-dalana',
    guide_driver_4: '4. Raha voaray, mandehana maka ny mpanjifa',
    guide_driver_5: '5. Atombohy sy vitao ny dia',
    app_version: 'Dikan-teny',
    contact_us: 'Mifandraisa aminay',
    safety_tips: 'Torohevitra fiarovana',
    safety_tip_1: 'Zahao foana ny laharana sy ny sariny amin\'ny mpamily alohan\'ny hidirana.',
    safety_tip_2: 'Zarao amin\'ny havanao ny mombamomba ny dianao.',
    safety_tip_3: 'Raha tsy mahazo aina ianao, tsindrio ny bokotra SOS.',
    settings: 'Fikirana',
    language: 'Fiteny',
    dark_mode: 'Hizaha maizina',
    notifications_label: 'Fampandrenesana',
    about_app: "Momba an'i Farady",
    about_app_desc: "Farady dia fampiharana fitaterana ho an'ny tanànan'i Fort-Dauphin sy ny manodidina. Natao hanatsarana ny fitaterana eto an-toerana.",
    distance: 'Halavirana',
    estimated_time: 'Fotoana',
  },
  fr: {
    welcome: 'Bienvenue',
    request_ride: 'Commander',
    bidding: 'Enchères',
    accept: 'Accepter',
    reject: 'Refuser',
    cancel: 'Annuler',
    arrived: 'Chauffeur arrivé',
    start_ride: 'Démarrer la course',
    complete_ride: 'Terminer la course',
    where_to: 'Où allez-vous ?',
    pickup: 'Point de départ',
    dropoff: 'Destination',
    taxi: 'Taxi',
    bajaj: 'Bajaj',
    finding_drivers: 'Recherche de chauffeurs...',
    price: 'Prix',
    eta: 'Arrivée (min)',
    send_offer: 'Faire une offre',
    online: 'En ligne',
    offline: 'Hors ligne',
    login_phone: 'Numéro de téléphone',
    login_otp: 'Code OTP (ex: 1234)',
    login_btn: 'Se connecter',
    history: 'Historique',
    profile: 'Profil',
    driver: 'Chauffeur',
    passenger: 'Passager',
    help: 'Aide',
    faq: 'Questions fréquentes',
    emergency_contacts: 'Contacts d\'urgence',
    how_to_use: 'Comment utiliser',
    police: 'Police',
    ambulance: 'Ambulance',
    fire: 'Pompiers',
    faq_q1: 'Comment commander une course ?',
    faq_a1: 'Choisissez votre point de départ et destination, puis appuyez sur "Commander". Attendez les offres des chauffeurs.',
    faq_q2: 'Comment payer ?',
    faq_a2: 'Le paiement se fait directement entre le passager et le chauffeur à la fin de la course.',
    faq_q3: 'Que faire si le chauffeur n\'arrive pas ?',
    faq_a3: 'Vous pouvez annuler la course et en commander une nouvelle. En cas de problème, appelez les numéros d\'urgence.',
    faq_q4: 'Comment devenir chauffeur ?',
    faq_a4: 'Inscrivez-vous avec votre permis de conduire et les informations de votre véhicule.',
    guide_passenger_title: 'Guide passager',
    guide_passenger_1: '1. Choisissez le point de départ et la destination',
    guide_passenger_2: '2. Sélectionnez le type de véhicule (Taxi ou Bajaj)',
    guide_passenger_3: '3. Appuyez sur "Commander" et attendez les offres',
    guide_passenger_4: '4. Acceptez la meilleure offre',
    guide_passenger_5: '5. Attendez le chauffeur et profitez du trajet',
    guide_driver_title: 'Guide chauffeur',
    guide_driver_1: '1. Connectez-vous et passez "En ligne"',
    guide_driver_2: '2. Attendez les demandes des passagers',
    guide_driver_3: '3. Envoyez votre offre de prix',
    guide_driver_4: '4. Si accepté, allez chercher le passager',
    guide_driver_5: '5. Démarrez et terminez la course',
    app_version: 'Version',
    contact_us: 'Nous contacter',
    safety_tips: 'Conseils de sécurité',
    safety_tip_1: 'Vérifiez toujours le numéro et la photo du chauffeur avant de monter.',
    safety_tip_2: 'Partagez les détails de votre trajet avec vos proches.',
    safety_tip_3: 'Si vous vous sentez en danger, appuyez sur le bouton SOS.',
    settings: 'Paramètres',
    language: 'Langue',
    dark_mode: 'Mode sombre',
    notifications_label: 'Notifications',
    about_app: 'À propos de Farady',
    about_app_desc: "Farady est une application de transport pour la ville de Fort-Dauphin et ses environs. Conçue pour améliorer le transport local.",
    distance: 'Distance',
    estimated_time: 'Temps estimé',
  }
};

type I18nContextType = {
  t: (key: keyof typeof translations['mg']) => string;
  lang: Language;
  setLang: (lang: Language) => void;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('farady_lang');
    return (saved === 'mg' || saved === 'fr') ? saved : 'mg';
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem('farady_lang', l);
  };

  const t = (key: keyof typeof translations['mg']) => {
    return translations[lang][key] || key;
  };

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
