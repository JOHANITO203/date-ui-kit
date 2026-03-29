import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check, ChevronsUpDown, Search } from 'lucide-react';
import { ICONS } from '../types';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import GlassButton from './ui/GlassButton';
import Logo from './ui/Logo';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type AuthMethod = 'phone' | 'email';
type Distance = 25 | 50 | 100;

type FormState = {
  consentAge: boolean;
  consentTerms: boolean;
  authMethod: AuthMethod;
  phone: string;
  email: string;
  otp: string;
  firstName: string;
  birthDate: string;
  gender: '' | 'homme' | 'femme' | 'autre';
  city: string;
  originCountry: string;
  languages: string[];
  photos: number;
  lookingFor: 'hommes' | 'femmes' | 'tous';
  ageMin: number;
  ageMax: number;
  distance: Distance;
  intent: '' | 'serieuse' | 'connexion' | 'decouverte' | 'verrai';
  interests: string[];
  interfaceLang: 'fr' | 'en' | 'ru';
  targetLang: 'fr' | 'en' | 'ru';
  autoTranslate: boolean;
  verifyNow: boolean;
  preciseLocation: boolean;
  notifications: boolean;
};

const TOTAL_STEPS = 12;
const LANGS = ['Francais', 'Anglais', 'Russe', 'Espagnol', 'Allemand', 'Italien', 'Chinois', 'Japonais'];
const INTERESTS = ['Musique', 'Sport', 'Business', 'Voyage', 'Cinema', 'Food', 'Mode', 'Spiritualite', 'Tech', 'Art', 'Danse', 'Lifestyle'];

type CityOption = {
  name: string;
  flag: string;
};

type NationalityOption = {
  name: string;
  flag: string;
  category: string;
};

const LAUNCH_CITIES: CityOption[] = [
  { name: 'Voronej', flag: '🇷🇺' },
  { name: 'Moscou', flag: '🇷🇺' },
  { name: 'Saint-Petersbourg', flag: '🇷🇺' },
  { name: 'Sotchi', flag: '🇷🇺' },
];

const NATIONALITIES: NationalityOption[] = [
  { name: 'Russe', flag: '🇷🇺', category: 'Russie' },
  { name: 'Nigerian', flag: '🇳🇬', category: 'Afrique de l Ouest' },
  { name: 'Ghaneen', flag: '🇬🇭', category: 'Afrique de l Ouest' },
  { name: 'Beninois', flag: '🇧🇯', category: 'Afrique de l Ouest' },
  { name: 'Senegalais', flag: '🇸🇳', category: 'Afrique de l Ouest' },
  { name: 'Ivoirien', flag: '🇨🇮', category: 'Afrique de l Ouest' },
  { name: 'Guineen', flag: '🇬🇳', category: 'Afrique de l Ouest' },
  { name: 'Malien', flag: '🇲🇱', category: 'Afrique de l Ouest' },
  { name: 'Camerounais', flag: '🇨🇲', category: 'Afrique Centrale' },
  { name: 'Congolais RDC', flag: '🇨🇩', category: 'Afrique Centrale' },
  { name: 'Congolais RC', flag: '🇨🇬', category: 'Afrique Centrale' },
  { name: 'Gabonais', flag: '🇬🇦', category: 'Afrique Centrale' },
  { name: 'Angolais', flag: '🇦🇴', category: 'Afrique Centrale' },
  { name: 'Tchadien', flag: '🇹🇩', category: 'Afrique Centrale' },
  { name: 'Ethiopien', flag: '🇪🇹', category: 'Afrique de l Est' },
  { name: 'Kenyan', flag: '🇰🇪', category: 'Afrique de l Est' },
  { name: 'Rwandais', flag: '🇷🇼', category: 'Afrique de l Est' },
  { name: 'Ougandais', flag: '🇺🇬', category: 'Afrique de l Est' },
  { name: 'Tanzanien', flag: '🇹🇿', category: 'Afrique de l Est' },
  { name: 'Egyptien', flag: '🇪🇬', category: 'Afrique du Nord' },
  { name: 'Marocain', flag: '🇲🇦', category: 'Afrique du Nord' },
  { name: 'Algerien', flag: '🇩🇿', category: 'Afrique du Nord' },
  { name: 'Tunisien', flag: '🇹🇳', category: 'Afrique du Nord' },
  { name: 'Ouzbek', flag: '🇺🇿', category: 'Asie Centrale' },
  { name: 'Tadjik', flag: '🇹🇯', category: 'Asie Centrale' },
  { name: 'Kirghize', flag: '🇰🇬', category: 'Asie Centrale' },
  { name: 'Kazakh', flag: '🇰🇿', category: 'Asie Centrale' },
  { name: 'Turkmene', flag: '🇹🇲', category: 'Asie Centrale' },
  { name: 'Chinois', flag: '🇨🇳', category: 'Asie de l Est' },
  { name: 'Coreen du Nord', flag: '🇰🇵', category: 'Asie de l Est' },
  { name: 'Vietnamien', flag: '🇻🇳', category: 'Asie de l Est' },
  { name: 'Indien', flag: '🇮🇳', category: 'Asie du Sud' },
  { name: 'Pakistanais', flag: '🇵🇰', category: 'Asie du Sud' },
  { name: 'Bangladais', flag: '🇧🇩', category: 'Asie du Sud' },
  { name: 'Bielorusse', flag: '🇧🇾', category: 'Europe de l Est' },
  { name: 'Moldave', flag: '🇲🇩', category: 'Europe de l Est' },
  { name: 'Armenien', flag: '🇦🇲', category: 'Europe de l Est' },
  { name: 'Azeri', flag: '🇦🇿', category: 'Europe de l Est' },
  { name: 'Georgien', flag: '🇬🇪', category: 'Europe de l Est' },
  { name: 'Allemand', flag: '🇩🇪', category: 'Europe' },
  { name: 'Francais', flag: '🇫🇷', category: 'Europe' },
  { name: 'Italien', flag: '🇮🇹', category: 'Europe' },
  { name: 'Serbe', flag: '🇷🇸', category: 'Europe' },
  { name: 'Ukrainien', flag: '🇺🇦', category: 'Europe' },
  { name: 'Cubain', flag: '🇨🇺', category: 'Amerique Latine et Caraibes' },
  { name: 'Bresilien', flag: '🇧🇷', category: 'Amerique Latine et Caraibes' },
  { name: 'Colombien', flag: '🇨🇴', category: 'Amerique Latine et Caraibes' },
  { name: 'Equatorien', flag: '🇪🇨', category: 'Amerique Latine et Caraibes' },
  { name: 'Venezuelien', flag: '🇻🇪', category: 'Amerique Latine et Caraibes' },
];

const zodiacList = [
  { symbol: '♈', label: 'Belier', start: [3, 21], end: [4, 19] },
  { symbol: '♉', label: 'Taureau', start: [4, 20], end: [5, 20] },
  { symbol: '♊', label: 'Gemeaux', start: [5, 21], end: [6, 20] },
  { symbol: '♋', label: 'Cancer', start: [6, 21], end: [7, 22] },
  { symbol: '♌', label: 'Lion', start: [7, 23], end: [8, 22] },
  { symbol: '♍', label: 'Vierge', start: [8, 23], end: [9, 22] },
  { symbol: '♎', label: 'Balance', start: [9, 23], end: [10, 22] },
  { symbol: '♏', label: 'Scorpion', start: [10, 23], end: [11, 21] },
  { symbol: '♐', label: 'Sagittaire', start: [11, 22], end: [12, 21] },
  { symbol: '♑', label: 'Capricorne', start: [12, 22], end: [1, 19] },
  { symbol: '♒', label: 'Verseau', start: [1, 20], end: [2, 18] },
  { symbol: '♓', label: 'Poissons', start: [2, 19], end: [3, 20] },
];

const fieldClass =
  'w-full rounded-[18px] border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3.5 text-white placeholder:text-white/35 outline-none focus:border-pink-500/50 transition-colors';

const pillClass = (active: boolean) =>
  `h-10 px-4 rounded-full border text-[11px] font-black uppercase tracking-[0.14em] transition-all ${
    active ? 'gradient-premium border-transparent text-white' : 'border-white/10 bg-white/5 text-white/55'
  }`;

const tileClass = (active: boolean) =>
  `h-11 rounded-[14px] border text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
    active ? 'bg-white text-black border-white' : 'bg-white/5 text-white/55 border-white/10 hover:border-pink-500/35'
  }`;

const ageFromDob = (date: string) => {
  if (!date) return 0;
  const now = new Date();
  const dob = new Date(date);
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
};

const zodiacFromDob = (date: string) => {
  if (!date) return null;
  const dob = new Date(date);
  const month = dob.getMonth() + 1;
  const day = dob.getDate();
  return (
    zodiacList.find((z) => {
      const [sm, sd] = z.start;
      const [em, ed] = z.end;
      if (sm <= em) return (month === sm && day >= sd) || (month === em && day <= ed) || (month > sm && month < em);
      return (month === sm && day >= sd) || (month === em && day <= ed) || month > sm || month < em;
    }) ?? null
  );
};

const formatRussianPhoneInput = (raw: string) => {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7')) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const local = digits.slice(1);

  let out = '+7';
  if (local.length > 0) out += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) out += ')';
  if (local.length > 3) out += ` ${local.slice(3, 6)}`;
  if (local.length > 6) out += `-${local.slice(6, 8)}`;
  if (local.length > 8) out += `-${local.slice(8, 10)}`;
  return out;
};

const isRussianPhoneValid = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('7');
};

const OnboardingScreen = () => {
  const navigate = useNavigate();
  const { isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);

  const [step, setStep] = useState<Step>(1);
  const [dateFocused, setDateFocused] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [isNationalitySelectorOpen, setIsNationalitySelectorOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    consentAge: false,
    consentTerms: false,
    authMethod: 'phone',
    phone: '',
    email: '',
    otp: '',
    firstName: '',
    birthDate: '',
    gender: '',
    city: '',
    originCountry: '',
    languages: [],
    photos: 0,
    lookingFor: 'tous',
    ageMin: 18,
    ageMax: 35,
    distance: 50,
    intent: '',
    interests: [],
    interfaceLang: 'fr',
    targetLang: 'en',
    autoTranslate: true,
    verifyNow: false,
    preciseLocation: false,
    notifications: false,
  });

  const age = useMemo(() => ageFromDob(form.birthDate), [form.birthDate]);
  const zodiac = useMemo(() => zodiacFromDob(form.birthDate), [form.birthDate]);
  const selectedCity = useMemo(() => LAUNCH_CITIES.find((city) => city.name === form.city) ?? null, [form.city]);
  const selectedNationality = useMemo(() => NATIONALITIES.find((nationality) => nationality.name === form.originCountry) ?? null, [form.originCountry]);

  const filteredCities = useMemo(
    () => LAUNCH_CITIES.filter((city) => city.name.toLowerCase().includes(citySearch.trim().toLowerCase())),
    [citySearch],
  );

  const filteredNationalities = useMemo(
    () => NATIONALITIES.filter((nationality) => nationality.name.toLowerCase().includes(nationalitySearch.trim().toLowerCase())),
    [nationalitySearch],
  );

  const canContinue = useMemo(() => {
    if (step === 2) return form.consentAge && form.consentTerms;
    if (step === 3) return form.authMethod === 'phone' ? isRussianPhoneValid(form.phone) && form.otp.length >= 4 : /\S+@\S+\.\S+/.test(form.email) && form.otp.length >= 4;
    if (step === 4) return Boolean(form.firstName && form.birthDate && age >= 18 && form.gender && form.city && form.originCountry && form.languages.length);
    if (step === 5) return form.photos >= 1;
    if (step === 6) return form.ageMin < form.ageMax;
    if (step === 7) return Boolean(form.intent);
    if (step === 8) return form.interests.length >= 3 && form.interests.length <= 5;
    return true;
  }, [age, form, step]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInArray = (key: 'languages' | 'interests', value: string, max?: number) => {
    setForm((prev) => {
      const list = prev[key];
      if (list.includes(value)) return { ...prev, [key]: list.filter((v) => v !== value) };
      if (max && list.length >= max) return prev;
      return { ...prev, [key]: [...list, value] };
    });
  };

  const next = () => {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    navigate('/discover');
  };

  const back = () => {
    if (step === 1) {
      navigate('/');
      return;
    }
    setStep((s) => (s - 1) as Step);
  };

  return (
    <div className="screen-safe h-full bg-black text-white px-[var(--page-x)] pt-5 pb-3 overflow-hidden">
      <AnimatePresence>
        {isCitySelectorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md p-4 flex items-end sm:items-center sm:justify-center"
            onClick={() => {
              setIsCitySelectorOpen(false);
              setCitySearch('');
            }}
          >
            <motion.div
              initial={{ y: 48, opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0.8 }}
              transition={{ type: 'spring', damping: 24, stiffness: 230 }}
              className="w-full sm:max-w-[32rem] rounded-t-[30px] sm:rounded-[30px] border border-white/10 bg-[#0e0f13]/90 backdrop-blur-2xl p-5 max-h-[80dvh] flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tight">Ville de lancement</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Moscou, Voronej, Saint-Petersbourg, Sotchi</p>
                </div>
                <button
                  className="h-9 w-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center"
                  onClick={() => {
                    setIsCitySelectorOpen(false);
                    setCitySearch('');
                  }}
                  aria-label="Fermer le selecteur de ville"
                >
                  <ICONS.X size={16} />
                </button>
              </div>

              <div className="relative mb-4">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  value={citySearch}
                  onChange={(event) => setCitySearch(event.target.value)}
                  className={`${fieldClass} pl-11`}
                  placeholder="Rechercher une ville"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-2">
                {filteredCities.map((city) => {
                  const isActive = form.city === city.name;
                  return (
                    <button
                      key={`city-option-${city.name}`}
                      onClick={() => {
                        setField('city', city.name);
                        setIsCitySelectorOpen(false);
                        setCitySearch('');
                      }}
                      className={`w-full rounded-[18px] border px-4 py-3.5 flex items-center gap-3 text-left transition-all ${
                        isActive ? 'border-pink-500/45 bg-gradient-to-r from-pink-500/20 to-sky-500/20' : 'border-white/10 bg-white/5 hover:border-pink-500/30'
                      }`}
                    >
                      <span className="text-2xl leading-none">{city.flag}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-wide">{city.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Serveur launch</span>
                      </div>
                      {isActive && <Check size={16} className="ml-auto text-pink-300" />}
                    </button>
                  );
                })}
                {filteredCities.length === 0 && (
                  <p className="text-center text-xs text-white/45 py-8 uppercase tracking-[0.16em] font-black">Aucune ville trouvee</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNationalitySelectorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md p-4 flex items-end sm:items-center sm:justify-center"
            onClick={() => {
              setIsNationalitySelectorOpen(false);
              setNationalitySearch('');
            }}
          >
            <motion.div
              initial={{ y: 48, opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0.8 }}
              transition={{ type: 'spring', damping: 24, stiffness: 230 }}
              className="w-full sm:max-w-[34rem] rounded-t-[30px] sm:rounded-[30px] border border-white/10 bg-[#0e0f13]/90 backdrop-blur-2xl p-5 max-h-[84dvh] flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tight">Nationalite / origine</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Liste dynamique populations etrangeres en Russie</p>
                </div>
                <button
                  className="h-9 w-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center"
                  onClick={() => {
                    setIsNationalitySelectorOpen(false);
                    setNationalitySearch('');
                  }}
                  aria-label="Fermer le selecteur de nationalite"
                >
                  <ICONS.X size={16} />
                </button>
              </div>

              <div className="relative mb-4">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  value={nationalitySearch}
                  onChange={(event) => setNationalitySearch(event.target.value)}
                  className={`${fieldClass} pl-11`}
                  placeholder="Rechercher une nationalite"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-2">
                {filteredNationalities.map((nationality) => {
                  const isActive = form.originCountry === nationality.name;
                  return (
                    <button
                      key={`nationality-option-${nationality.name}`}
                      onClick={() => {
                        setField('originCountry', nationality.name);
                        setIsNationalitySelectorOpen(false);
                        setNationalitySearch('');
                      }}
                      className={`w-full rounded-[18px] border px-4 py-3.5 flex items-center gap-3 text-left transition-all ${
                        isActive ? 'border-pink-500/45 bg-gradient-to-r from-pink-500/20 to-sky-500/20' : 'border-white/10 bg-white/5 hover:border-pink-500/30'
                      }`}
                    >
                      <span className="text-2xl leading-none">{nationality.flag}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-wide">{nationality.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{nationality.category}</span>
                      </div>
                      {isActive && <Check size={16} className="ml-auto text-pink-300" />}
                    </button>
                  );
                })}
                {filteredNationalities.length === 0 && (
                  <p className="text-center text-xs text-white/45 py-8 uppercase tracking-[0.16em] font-black">Aucun resultat</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container-form h-full mx-auto flex flex-col gap-4">
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={back} className="h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center" aria-label="Retour">
              <ICONS.ChevronLeft size={18} />
            </button>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">{`Etape ${step} sur ${TOTAL_STEPS}`}</p>
            <div className="w-10" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={`step-${i}`} className={`h-1 flex-1 rounded-full ${i < step ? 'gradient-premium' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar" style={isTouch && isKeyboardOpen ? { paddingBottom: `${keyboardInset}px` } : undefined}>
          <AnimatePresence mode="wait">
            <motion.div key={`step-content-${step}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.22 }} className="space-y-5">
              {step === 1 && (
                <div className="py-8 flex flex-col items-center gap-6 text-center">
                  <Logo size={58} showText className="justify-center" />
                  <h1 className="text-[2.25rem] font-black italic uppercase tracking-tight">EXOTIC</h1>
                  <p className="text-white/60 font-semibold uppercase tracking-[0.08em] max-w-[20ch]">Rencontre des personnes exotiques autour de toi</p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Conditions de base</h2>
                  <p className="text-white/60">Pour assurer la securite de notre communaute, nous avons besoin de quelques confirmations.</p>
                  <button onClick={() => setField('consentAge', !form.consentAge)} className="w-full rounded-[20px] border border-white/10 bg-white/5 p-4 text-left">
                    {form.consentAge ? '☑' : '☐'} J'ai 18 ans ou plus
                  </button>
                  <button onClick={() => setField('consentTerms', !form.consentTerms)} className="w-full rounded-[20px] border border-white/10 bg-white/5 p-4 text-left">
                    {form.consentTerms ? '☑' : '☐'} J'accepte les CGU et la politique de confidentialite
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Creation de compte</h2>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-[16px] border border-white/10 bg-white/5">
                    <button onClick={() => setField('authMethod', 'phone')} className={tileClass(form.authMethod === 'phone')}>
                      Telephone
                    </button>
                    <button onClick={() => setField('authMethod', 'email')} className={tileClass(form.authMethod === 'email')}>
                      Email
                    </button>
                  </div>

                  {form.authMethod === 'phone' ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">Numero Russie</p>
                        <input
                          className={fieldClass}
                          value={form.phone}
                          onChange={(e) => setField('phone', formatRussianPhoneInput(e.target.value))}
                          placeholder="+7 (900) 000-00-00"
                          inputMode="tel"
                          autoComplete="tel-national"
                        />
                        <p className={`text-xs ml-1 ${isRussianPhoneValid(form.phone) ? 'text-green-400' : 'text-white/45'}`}>
                          {isRussianPhoneValid(form.phone) ? 'Numero valide (format RU)' : 'Format attendu : +7 (XXX) XXX-XX-XX'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <input className={fieldClass} value={form.otp} onChange={(e) => setField('otp', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code OTP" inputMode="numeric" />
                        <button type="button" onClick={() => setField('otp', '0000')} className="h-10 px-4 rounded-full border border-pink-500/35 bg-pink-500/10 text-[11px] font-black uppercase tracking-[0.14em] text-pink-300">
                          Utiliser OTP test (0000)
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <input className={fieldClass} value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" />
                      <input className={fieldClass} value={form.otp} onChange={(e) => setField('otp', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code OTP" inputMode="numeric" />
                    </>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Profil essentiel</h2>

                  <div className="grid grid-cols-2 gap-3">
                    <input className={fieldClass} placeholder="Prenom" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">Date de naissance</p>
                      <div className="relative">
                        <input
                          className={`${fieldClass} onboarding-date-input pr-12`}
                          type="date"
                          value={form.birthDate}
                          onFocus={() => setDateFocused(true)}
                          onBlur={() => setDateFocused(false)}
                          onChange={(e) => setField('birthDate', e.target.value)}
                        />
                        <CalendarDays size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {zodiac && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[18px] border border-pink-500/25 bg-gradient-to-r from-pink-500/10 to-blue-500/10 p-3.5 backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl gradient-premium flex items-center justify-center text-white text-xl shadow-[0_10px_24px_rgba(236,72,153,0.35)]">{zodiac.symbol}</div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Signe zodiacal</p>
                            <p className="text-base font-black tracking-tight">{zodiac.label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${age >= 18 ? 'text-pink-300' : 'text-red-400'}`}>{age > 0 ? age : '--'}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">ans</p>
                        </div>
                      </div>
                      {!dateFocused && age > 0 && age < 18 && <p className="mt-2 text-xs text-red-300">18+ requis pour continuer.</p>}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {(['homme', 'femme', 'autre'] as const).map((gender) => (
                      <button key={gender} onClick={() => setField('gender', gender)} className={tileClass(form.gender === gender)}>
                        {gender}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">Ville (launch)</p>
                      <button
                        type="button"
                        onClick={() => setIsCitySelectorOpen(true)}
                        className={`${fieldClass} h-[50px] flex items-center justify-between text-left`}
                      >
                        <span className={form.city ? 'text-white' : 'text-white/35'}>
                          {selectedCity ? `${selectedCity.flag} ${selectedCity.name}` : 'Selectionner une ville'}
                        </span>
                        <ChevronsUpDown size={16} className="text-white/45" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">Nationalite / origine</p>
                      <button
                        type="button"
                        onClick={() => setIsNationalitySelectorOpen(true)}
                        className={`${fieldClass} h-[50px] flex items-center justify-between text-left`}
                      >
                        <span className={form.originCountry ? 'text-white' : 'text-white/35'}>
                          {selectedNationality ? `${selectedNationality.flag} ${selectedNationality.name}` : 'Selectionner une nationalite'}
                        </span>
                        <ChevronsUpDown size={16} className="text-white/45" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LAUNCH_CITIES.map((city) => (
                      <button key={`quick-city-${city.name}`} onClick={() => setField('city', city.name)} className={pillClass(form.city === city.name)}>
                        {`${city.flag} ${city.name}`}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LANGS.map((lang) => (
                      <button key={`lang-${lang}`} onClick={() => toggleInArray('languages', lang)} className={pillClass(form.languages.includes(lang))}>
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Ajout photo</h2>
                  <p className="text-white/60">Les profils avec 3 photos ou plus performent mieux.</p>
                  <button className="w-full h-44 rounded-[22px] border border-dashed border-white/20 bg-white/[0.02] flex items-center justify-center text-white/45" onClick={() => setField('photos', Math.min(form.photos + 1, 6))}>
                    <ICONS.Camera size={28} />
                  </button>
                  <p className="text-sm text-white/55">{`${form.photos}/6 photo(s) ajoutee(s)`}</p>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Qui veux-tu rencontrer ?</h2>
                  <p className="text-white/60">Ce choix definit implicitement tes affinites.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['hommes', 'femmes', 'tous'] as const).map((value) => (
                      <button key={`looking-${value}`} onClick={() => setField('lookingFor', value)} className={tileClass(form.lookingFor === value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-pink-400 font-black">{`${form.ageMin} - ${form.ageMax} ans`}</p>
                  <input type="range" min={18} max={70} value={form.ageMin} onChange={(e) => setField('ageMin', Math.min(Number(e.target.value), form.ageMax - 1))} className="w-full accent-pink-500" />
                  <input type="range" min={19} max={75} value={form.ageMax} onChange={(e) => setField('ageMax', Math.max(Number(e.target.value), form.ageMin + 1))} className="w-full accent-sky-400" />
                  <div className="grid grid-cols-3 gap-2">
                    {([25, 50, 100] as const).map((distance) => (
                      <button key={`distance-${distance}`} onClick={() => setField('distance', distance)} className={tileClass(form.distance === distance)}>
                        {`${distance} km`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-3">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Ce que tu cherches</h2>
                  {[
                    { id: 'serieuse', label: 'Relation serieuse' },
                    { id: 'connexion', label: 'Discussion / Connexion' },
                    { id: 'decouverte', label: 'Decouverte / Rencontres' },
                    { id: 'verrai', label: 'Je verrai' },
                  ].map((it) => (
                    <button key={`intent-${it.id}`} onClick={() => setField('intent', it.id as FormState['intent'])} className={`w-full rounded-[18px] border px-4 py-4 text-left ${form.intent === it.id ? 'border-pink-500/50 bg-pink-500/10' : 'border-white/10 bg-white/5'}`}>
                      {it.label}
                    </button>
                  ))}
                </div>
              )}

              {step === 8 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Centres d'interet</h2>
                  <p className="text-white/60">Choisissez 3 a 5 minimum pour enrichir votre profil.</p>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map((interest) => (
                      <button key={`interest-${interest}`} onClick={() => toggleInArray('interests', interest, 5)} className={pillClass(form.interests.includes(interest))}>
                        {interest}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-white/50">{`${form.interests.length}/5 selectionnes`}</p>
                </div>
              )}

              {step === 9 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Traduction du chat</h2>
                  <select className={fieldClass} value={form.interfaceLang} onChange={(e) => setField('interfaceLang', e.target.value as FormState['interfaceLang'])}>
                    <option value="fr">Francais</option>
                    <option value="en">English</option>
                    <option value="ru">Russkiy</option>
                  </select>
                  <select className={fieldClass} value={form.targetLang} onChange={(e) => setField('targetLang', e.target.value as FormState['targetLang'])}>
                    <option value="en">English</option>
                    <option value="fr">Francais</option>
                    <option value="ru">Russkiy</option>
                  </select>
                  <button onClick={() => setField('autoTranslate', !form.autoTranslate)} className="w-full rounded-[18px] border border-white/10 bg-white/5 p-4 text-left">
                    {`Traduction automatique : ${form.autoTranslate ? 'ON' : 'OFF'}`}
                  </button>
                </div>
              )}

              {step === 10 && (
                <div className="space-y-4 text-center py-6">
                  <div className="w-24 h-24 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <ICONS.Shield className="text-blue-400" size={40} />
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Verifie ton profil</h2>
                  <p className="text-white/60">Les profils verifies inspirent plus confiance et obtiennent plus de matches.</p>
                  <GlassButton variant="premium" onClick={() => setField('verifyNow', true)} className="w-full h-[var(--cta-height)] font-black uppercase tracking-[0.14em]">
                    Verifier maintenant
                  </GlassButton>
                  <button onClick={() => setField('verifyNow', false)} className="text-xs font-black uppercase tracking-[0.2em] text-white/55">
                    Passer pour l'instant
                  </button>
                </div>
              )}

              {step === 11 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Autorisations utiles</h2>
                  <button onClick={() => setField('preciseLocation', !form.preciseLocation)} className="w-full rounded-[18px] border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                    <span>Localisation precise</span>
                    <span className="text-pink-400 text-xs font-black uppercase">{form.preciseLocation ? 'Active' : 'Activer'}</span>
                  </button>
                  <button onClick={() => setField('notifications', !form.notifications)} className="w-full rounded-[18px] border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                    <span>Notifications</span>
                    <span className="text-sky-400 text-xs font-black uppercase">{form.notifications ? 'Active' : 'Activer'}</span>
                  </button>
                </div>
              )}

              {step === 12 && (
                <div className="space-y-5 text-center py-4">
                  <div className="w-32 h-32 mx-auto rounded-full border-4 border-pink-500/70 overflow-hidden relative">
                    <img src="/assets/profile-1.jpg" alt="Profil" className="w-full h-full object-cover" />
                    {form.verifyNow && (
                      <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center">
                        <ICONS.Shield size={14} />
                      </span>
                    )}
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">Profil pret !</h2>
                  <p className="text-white/60">{`${form.firstName || 'Alex'}, ${age || 24} ans • ${form.city || 'Barnaul'}`}</p>
                  <GlassButton variant="premium" onClick={() => navigate('/discover')} className="w-full h-[var(--cta-height)] font-black uppercase tracking-[0.14em]">
                    Voir mes profils
                  </GlassButton>
                  <button onClick={() => navigate('/profile/edit')} className="text-xs font-black uppercase tracking-[0.2em] text-white/55">
                    Ameliorer mon profil
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {step < 12 && (
          <div className="pb-safe shrink-0">
            <button
              onClick={next}
              disabled={!canContinue}
              className={`w-full h-[var(--cta-height)] rounded-[24px] font-black uppercase tracking-[0.16em] transition-all ${
                canContinue ? 'gradient-premium text-white shadow-[0_14px_30px_rgba(236,72,153,0.28)]' : 'bg-white/20 text-white/45 cursor-not-allowed'
              }`}
            >
              Continuer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;
