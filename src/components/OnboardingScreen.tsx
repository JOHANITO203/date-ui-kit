import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, ChevronsUpDown, Search } from 'lucide-react';
import { ICONS } from '../types';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useI18n } from '../i18n/I18nProvider';
import { onboardingCopy } from '../i18n/onboardingCopy';
import GlassButton from './ui/GlassButton';
import Logo from './ui/Logo';
import { useAuth } from '../auth/AuthProvider';
import { authApi } from '../services';
import type { AuthErrorResponse, AuthResponse } from '../contracts';
import { saveOnboardingProfileSnapshot } from '../domain/profileHydration';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type Distance = 25 | 50 | 100;
type ApiStatus = 'idle' | 'loading' | 'success' | 'error' | 'retry';

type FormState = {
  consentAge: boolean;
  consentTerms: boolean;
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
  autoDetectLanguage: boolean;
  verifyNow: boolean;
  preciseLocation: boolean;
  notifications: boolean;
};

const TOTAL_STEPS = 12;
const PHOTO_SLOTS = 5;
const AGE_RANGE_MAX = 65;
const LANGUAGE_KEYS = ['francais', 'anglais', 'russe', 'espagnol', 'allemand', 'italien', 'chinois', 'japonais'] as const;
const INTEREST_KEYS = ['musique', 'sport', 'business', 'voyage', 'cinema', 'food', 'mode', 'spiritualite', 'tech', 'art', 'danse', 'lifestyle'] as const;
const INTENT_KEYS = ['serieuse', 'connexion', 'decouverte', 'verrai'] as const;

type CityOption = {
  key: string;
  flagCode: string;
};

type NationalityOption = {
  key: string;
  flagCode: string;
  categoryKey: string;
};

const LAUNCH_CITIES: CityOption[] = [
  { key: 'voronezh', flagCode: 'RU' },
  { key: 'moscow', flagCode: 'RU' },
  { key: 'saint_petersburg', flagCode: 'RU' },
  { key: 'sochi', flagCode: 'RU' },
];

const NATIONALITIES: NationalityOption[] = [
  { key: 'russian', flagCode: 'RU', categoryKey: 'russia' },
  { key: 'nigerian', flagCode: 'NG', categoryKey: 'africa_west' },
  { key: 'ghanaian', flagCode: 'GH', categoryKey: 'africa_west' },
  { key: 'beninese', flagCode: 'BJ', categoryKey: 'africa_west' },
  { key: 'senegalese', flagCode: 'SN', categoryKey: 'africa_west' },
  { key: 'ivorian', flagCode: 'CI', categoryKey: 'africa_west' },
  { key: 'guinean', flagCode: 'GN', categoryKey: 'africa_west' },
  { key: 'malian', flagCode: 'ML', categoryKey: 'africa_west' },
  { key: 'cameroonian', flagCode: 'CM', categoryKey: 'africa_central' },
  { key: 'congolese_drc', flagCode: 'CD', categoryKey: 'africa_central' },
  { key: 'congolese_rc', flagCode: 'CG', categoryKey: 'africa_central' },
  { key: 'gabonese', flagCode: 'GA', categoryKey: 'africa_central' },
  { key: 'angolan', flagCode: 'AO', categoryKey: 'africa_central' },
  { key: 'chadian', flagCode: 'TD', categoryKey: 'africa_central' },
  { key: 'ethiopian', flagCode: 'ET', categoryKey: 'africa_east' },
  { key: 'kenyan', flagCode: 'KE', categoryKey: 'africa_east' },
  { key: 'rwandan', flagCode: 'RW', categoryKey: 'africa_east' },
  { key: 'ugandan', flagCode: 'UG', categoryKey: 'africa_east' },
  { key: 'tanzanian', flagCode: 'TZ', categoryKey: 'africa_east' },
  { key: 'egyptian', flagCode: 'EG', categoryKey: 'africa_north' },
  { key: 'moroccan', flagCode: 'MA', categoryKey: 'africa_north' },
  { key: 'algerian', flagCode: 'DZ', categoryKey: 'africa_north' },
  { key: 'tunisian', flagCode: 'TN', categoryKey: 'africa_north' },
  { key: 'uzbek', flagCode: 'UZ', categoryKey: 'asia_central' },
  { key: 'tajik', flagCode: 'TJ', categoryKey: 'asia_central' },
  { key: 'kyrgyz', flagCode: 'KG', categoryKey: 'asia_central' },
  { key: 'kazakh', flagCode: 'KZ', categoryKey: 'asia_central' },
  { key: 'turkmen', flagCode: 'TM', categoryKey: 'asia_central' },
  { key: 'chinese', flagCode: 'CN', categoryKey: 'asia_east' },
  { key: 'north_korean', flagCode: 'KP', categoryKey: 'asia_east' },
  { key: 'vietnamese', flagCode: 'VN', categoryKey: 'asia_east' },
  { key: 'indian', flagCode: 'IN', categoryKey: 'asia_south' },
  { key: 'pakistani', flagCode: 'PK', categoryKey: 'asia_south' },
  { key: 'bangladeshi', flagCode: 'BD', categoryKey: 'asia_south' },
  { key: 'belarusian', flagCode: 'BY', categoryKey: 'europe_east' },
  { key: 'moldovan', flagCode: 'MD', categoryKey: 'europe_east' },
  { key: 'armenian', flagCode: 'AM', categoryKey: 'europe_east' },
  { key: 'azeri', flagCode: 'AZ', categoryKey: 'europe_east' },
  { key: 'georgian', flagCode: 'GE', categoryKey: 'europe_east' },
  { key: 'german', flagCode: 'DE', categoryKey: 'europe' },
  { key: 'french', flagCode: 'FR', categoryKey: 'europe' },
  { key: 'italian', flagCode: 'IT', categoryKey: 'europe' },
  { key: 'serbian', flagCode: 'RS', categoryKey: 'europe' },
  { key: 'ukrainian', flagCode: 'UA', categoryKey: 'europe' },
  { key: 'cuban', flagCode: 'CU', categoryKey: 'latam_caribbean' },
  { key: 'brazilian', flagCode: 'BR', categoryKey: 'latam_caribbean' },
  { key: 'colombian', flagCode: 'CO', categoryKey: 'latam_caribbean' },
  { key: 'ecuadorian', flagCode: 'EC', categoryKey: 'latam_caribbean' },
  { key: 'venezuelan', flagCode: 'VE', categoryKey: 'latam_caribbean' },
];


const zodiacList = [
  { symbol: '\u2648', key: 'aries', start: [3, 21], end: [4, 19] },
  { symbol: '\u2649', key: 'taurus', start: [4, 20], end: [5, 20] },
  { symbol: '\u264A', key: 'gemini', start: [5, 21], end: [6, 20] },
  { symbol: '\u264B', key: 'cancer', start: [6, 21], end: [7, 22] },
  { symbol: '\u264C', key: 'leo', start: [7, 23], end: [8, 22] },
  { symbol: '\u264D', key: 'virgo', start: [8, 23], end: [9, 22] },
  { symbol: '\u264E', key: 'libra', start: [9, 23], end: [10, 22] },
  { symbol: '\u264F', key: 'scorpio', start: [10, 23], end: [11, 21] },
  { symbol: '\u2650', key: 'sagittarius', start: [11, 22], end: [12, 21] },
  { symbol: '\u2651', key: 'capricorn', start: [12, 22], end: [1, 19] },
  { symbol: '\u2652', key: 'aquarius', start: [1, 20], end: [2, 18] },
  { symbol: '\u2653', key: 'pisces', start: [2, 19], end: [3, 20] },
];

const YEARS = Array.from({ length: 83 }, (_, index) => new Date().getFullYear() - 18 - index);


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


const flagFromCode = (code: string) =>
  String.fromCodePoint(...code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0)));

const formatDate = (date: string) => {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const parseIsoDate = (date: string) => {
  if (!date) {
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() - 24 };
  }
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() - 24 };
  }
  return { day, month, year };
};

const toIsoDate = (day: number, month: number, year: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const ONBOARDING_DRAFT_STORAGE_KEY = 'exotic.onboarding.draft.v1';
const ONBOARDING_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type OnboardingDraftPayload = {
  step: Step;
  form: FormState;
  updatedAtIso: string;
};

type UploadedPhoto = {
  id: string;
  path: string;
  url: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

const isAuthError = (payload: AuthResponse<unknown>): payload is AuthErrorResponse =>
  payload.ok === false;

const createInitialForm = (locale: 'en' | 'ru'): FormState => ({
  consentAge: false,
  consentTerms: false,
  firstName: '',
  birthDate: '',
  gender: '',
  city: '',
  originCountry: '',
  languages: [],
  photos: 0,
  lookingFor: 'tous',
  ageMin: 18,
  ageMax: AGE_RANGE_MAX,
  distance: 50,
  intent: '',
  interests: [],
  interfaceLang: locale,
  targetLang: locale === 'ru' ? 'ru' : 'en',
  autoTranslate: true,
  autoDetectLanguage: true,
  verifyNow: false,
  preciseLocation: false,
  notifications: false,
});

const isValidStep = (value: unknown): value is Step =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= TOTAL_STEPS;

const readOnboardingDraft = (
  locale: 'en' | 'ru',
): {
  step: Step;
  form: FormState;
} => {
  const fallback = {
    step: 1 as Step,
    form: createInitialForm(locale),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as OnboardingDraftPayload;
    if (!parsed || typeof parsed !== 'object') return fallback;
    if (!isValidStep(parsed.step)) return fallback;

    const updatedAtMs = new Date(parsed.updatedAtIso).getTime();
    if (!Number.isFinite(updatedAtMs)) return fallback;
    if (Date.now() - updatedAtMs > ONBOARDING_DRAFT_TTL_MS) return fallback;

    return {
      step: parsed.step,
      form: {
        ...fallback.form,
        ...(parsed.form ?? {}),
      },
    };
  } catch {
    return fallback;
  }
};

const persistOnboardingDraft = (step: Step, form: FormState) => {
  if (typeof window === 'undefined') return;
  const payload: OnboardingDraftPayload = {
    step,
    form,
    updatedAtIso: new Date().toISOString(),
  };
  window.localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
};

const clearOnboardingDraft = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
};

const OnboardingScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { isAuthenticated, refreshSession } = useAuth();
  const copy = onboardingCopy[locale];
  const { isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const [initialDraft] = useState(() => readOnboardingDraft(locale));

  const [step, setStep] = useState<Step>(initialDraft.step);
  const [citySearch, setCitySearch] = useState('');
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false);
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [isNationalitySelectorOpen, setIsNationalitySelectorOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState(() => parseIsoDate(''));
  const [form, setForm] = useState<FormState>(initialDraft.form);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [profileHydrationStatus, setProfileHydrationStatus] = useState<ApiStatus>('idle');
  const [submitStatus, setSubmitStatus] = useState<ApiStatus>('idle');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<ApiStatus>('idle');
  const [photoErrorMessage, setPhotoErrorMessage] = useState('');
  const [verifySelfieStatus, setVerifySelfieStatus] = useState<ApiStatus>('idle');
  const [verifySelfiePreviewUrl, setVerifySelfiePreviewUrl] = useState<string | null>(null);
  const [verifySelfieErrorMessage, setVerifySelfieErrorMessage] = useState('');
  const [verifyConsentGranted, setVerifyConsentGranted] = useState(false);
  const [verifyConsentOpen, setVerifyConsentOpen] = useState(false);
  const hydrationRequestIdRef = useRef(0);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const verifySelfieCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    persistOnboardingDraft(step, form);
  }, [step, form]);

  useEffect(() => {
    return () => {
      if (verifySelfiePreviewUrl && verifySelfiePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(verifySelfiePreviewUrl);
      }
    };
  }, [verifySelfiePreviewUrl]);

  useEffect(() => {
    if (!location.search) return;
    void refreshSession();
  }, [location.search, refreshSession]);

  const hydrateProfile = useCallback(
    async (mode: 'load' | 'retry' = 'load') => {
      if (!isAuthenticated) return;
      const requestId = hydrationRequestIdRef.current + 1;
      hydrationRequestIdRef.current = requestId;
      setProfileHydrationStatus(mode === 'retry' ? 'retry' : 'loading');
      try {
        const payload = await authApi.getProfileMe();
        if (hydrationRequestIdRef.current !== requestId) return;
        if (!payload.ok || !payload.data) {
          setProfileHydrationStatus('error');
          return;
        }
        const profile = payload.data.profile;
        const settings = payload.data.settings;
        setForm((prev) => ({
          ...prev,
          firstName: prev.firstName || profile?.first_name || '',
          birthDate: prev.birthDate || profile?.birth_date || '',
          gender: (prev.gender || profile?.gender || '') as '' | 'homme' | 'femme' | 'autre',
          city: prev.city || profile?.city || '',
          originCountry: prev.originCountry || profile?.origin_country || '',
          languages: prev.languages.length > 0 ? prev.languages : profile?.languages ?? prev.languages,
          intent: (prev.intent || profile?.intent || '') as '' | 'serieuse' | 'connexion' | 'decouverte' | 'verrai',
          interests: prev.interests.length > 0 ? prev.interests : profile?.interests ?? prev.interests,
          photos: prev.photos > 0 ? prev.photos : profile?.photos_count ?? prev.photos,
          verifyNow: prev.verifyNow || Boolean(profile?.verified_opt_in),
          interfaceLang: prev.interfaceLang || (settings?.language ?? locale),
          targetLang: prev.targetLang || (settings?.target_lang ?? prev.targetLang),
          autoTranslate: settings?.auto_translate ?? prev.autoTranslate,
          autoDetectLanguage: settings?.auto_detect_language ?? prev.autoDetectLanguage,
          notifications: settings?.notifications_enabled ?? prev.notifications,
          preciseLocation: settings?.precise_location_enabled ?? prev.preciseLocation,
          distance: ((settings?.distance_km as Distance | null) ?? prev.distance) as Distance,
          ageMin: settings?.age_min ?? prev.ageMin,
          ageMax: settings?.age_max ?? prev.ageMax,
        }));
        setProfileHydrationStatus('success');
      } catch {
        if (hydrationRequestIdRef.current !== requestId) return;
        setProfileHydrationStatus('error');
      }
    },
    [isAuthenticated, locale, hydrationRequestIdRef],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void hydrateProfile('load');
    return () => {
      hydrationRequestIdRef.current += 1;
    };
  }, [hydrateProfile, isAuthenticated, hydrationRequestIdRef]);

  const age = useMemo(() => ageFromDob(form.birthDate), [form.birthDate]);
  const zodiac = useMemo(() => zodiacFromDob(form.birthDate), [form.birthDate]);
  const selectedCity = useMemo(() => LAUNCH_CITIES.find((city) => city.key === form.city) ?? null, [form.city]);
  const selectedNationality = useMemo(() => NATIONALITIES.find((nationality) => nationality.key === form.originCountry) ?? null, [form.originCountry]);

  const filteredCities = useMemo(
    () =>
      LAUNCH_CITIES.filter((city) =>
        (copy.cities[city.key] ?? city.key).toLowerCase().includes(citySearch.trim().toLowerCase()),
      ),
    [citySearch, copy.cities],
  );

  const filteredNationalities = useMemo(
    () =>
      NATIONALITIES.filter((nationality) =>
        (copy.nationalities[nationality.key] ?? nationality.key).toLowerCase().includes(nationalitySearch.trim().toLowerCase()),
      ),
    [nationalitySearch, copy.nationalities],
  );
  const daysInDraftMonth = useMemo(() => getDaysInMonth(dateDraft.year, dateDraft.month), [dateDraft.month, dateDraft.year]);
  const draftDays = useMemo(() => Array.from({ length: daysInDraftMonth }, (_, index) => index + 1), [daysInDraftMonth]);

  const canContinue = useMemo(() => {
    if (step === 2) return form.consentAge && form.consentTerms;
    if (step === 3) return isAuthenticated;
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

  const openDateSelector = () => {
    setDateDraft(parseIsoDate(form.birthDate));
    setIsDateSelectorOpen(true);
  };

  const closeDateSelector = () => {
    setIsDateSelectorOpen(false);
  };

  const updateDraftMonth = (month: number) => {
    setDateDraft((prev) => ({
      ...prev,
      month,
      day: Math.min(prev.day, getDaysInMonth(prev.year, month)),
    }));
  };

  const updateDraftYear = (year: number) => {
    setDateDraft((prev) => ({
      ...prev,
      year,
      day: Math.min(prev.day, getDaysInMonth(year, prev.month)),
    }));
  };

  const applyDateSelection = () => {
    setField('birthDate', toIsoDate(dateDraft.day, dateDraft.month, dateDraft.year));
    closeDateSelector();
  };

  const syncPhotosCount = useCallback((count: number) => {
    setField('photos', count);
  }, []);

  const openPhotoPicker = () => {
    photoInputRef.current?.click();
  };

  const openVerifySelfieConsent = () => {
    setVerifyConsentOpen(true);
  };

  const openVerifySelfieCameraPicker = () => {
    verifySelfieCameraInputRef.current?.click();
  };

  const loadProfilePhotos = useCallback(async () => {
    if (!isAuthenticated) return;
    const payload = await authApi.getProfilePhotos();
    if (isAuthError(payload)) return;
    const next = payload.data?.photos ?? [];
    setUploadedPhotos(next);
    syncPhotosCount(next.length);
  }, [isAuthenticated, syncPhotosCount]);

  useEffect(() => {
    void loadProfilePhotos();
  }, [loadProfilePhotos]);

  const removePhotoAt = async (index: number) => {
    const target = uploadedPhotos[index];
    if (!target) return;

    setPhotoUploadStatus(photoUploadStatus === 'error' ? 'retry' : 'loading');
    setPhotoErrorMessage('');

    const response = await authApi.deleteProfilePhoto(target.id);
    if (isAuthError(response)) {
      setPhotoUploadStatus('error');
      setPhotoErrorMessage(response.message ?? 'Unable to remove photo now.');
      return;
    }

    const next = uploadedPhotos.filter((photo) => photo.id !== target.id);
    setUploadedPhotos(next);
    syncPhotosCount(next.length);
    setPhotoUploadStatus('success');
  };

  const onPhotoFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.currentTarget;
    const files: File[] = Array.from(inputEl.files ?? []).filter(
      (file): file is File => file instanceof File && file.type.startsWith('image/'),
    );
    if (files.length === 0) return;

    const available = PHOTO_SLOTS - uploadedPhotos.length;
    if (available <= 0) {
      inputEl.value = '';
      return;
    }

    setPhotoUploadStatus(photoUploadStatus === 'error' ? 'retry' : 'loading');
    setPhotoErrorMessage('');

    const accepted = files.slice(0, available);
    const appended: UploadedPhoto[] = [];

    for (const file of accepted) {
      const response = await authApi.uploadProfilePhoto(file);
      if (isAuthError(response)) {
        setPhotoUploadStatus('error');
        setPhotoErrorMessage(response.message ?? 'Unable to upload photo now.');
        break;
      }
      if (!response.data?.photo) {
        setPhotoUploadStatus('error');
        setPhotoErrorMessage('Unable to upload photo now.');
        break;
      }
      appended.push(response.data.photo);
    }

    if (appended.length > 0) {
      const next = [...uploadedPhotos, ...appended].sort((a, b) => a.sort_order - b.sort_order);
      setUploadedPhotos(next);
      syncPhotosCount(next.length);
      setPhotoUploadStatus('success');
    }

    inputEl.value = '';
  };

  const onVerifySelfieSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.currentTarget;
    const file = Array.from(inputEl.files ?? []).find(
      (item) => item instanceof File && item.type.startsWith('image/'),
    );
    if (!file) return;

    setVerifySelfieStatus(verifySelfieStatus === 'error' ? 'retry' : 'loading');
    setVerifySelfieErrorMessage('');

    if (verifySelfiePreviewUrl && verifySelfiePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(verifySelfiePreviewUrl);
    }

    const nextPreview = URL.createObjectURL(file);
    const response = await authApi.submitKycSelfie(file);
    if (isAuthError(response)) {
      URL.revokeObjectURL(nextPreview);
      setVerifySelfieStatus('error');
      setVerifySelfieErrorMessage(response.message ?? 'Unable to submit selfie now.');
      setField('verifyNow', false);
      inputEl.value = '';
      return;
    }

    setVerifySelfiePreviewUrl(nextPreview);
    setVerifySelfieStatus('success');
    setVerifySelfieErrorMessage('');
    setField('verifyNow', true);
    inputEl.value = '';
  };

  const completeOnboardingAndGoDiscover = async () => {
    if (submitStatus === 'loading' || submitStatus === 'retry') return;
    let hasSession = isAuthenticated;
    if (!hasSession) {
      try {
        await refreshSession();
        const sessionProbe = await authApi.getSession();
        hasSession = Boolean(sessionProbe.ok && sessionProbe.data?.authenticated);
      } catch {
        hasSession = false;
      }
    }
    if (!hasSession) {
      setSubmitErrorMessage('Authenticate first to complete onboarding.');
      setSubmitStatus('error');
      return;
    }
    setSubmitStatus(submitStatus === 'error' ? 'retry' : 'loading');
    const response = await authApi.completeOnboarding({
      version: 'v1',
      firstName: form.firstName,
      locale: locale,
      birthDate: form.birthDate,
      gender: form.gender || 'autre',
      city: form.city,
      originCountry: form.originCountry,
      languages: form.languages,
      intent: (form.intent || 'verrai') as 'serieuse' | 'connexion' | 'decouverte' | 'verrai',
      interests: form.interests,
      photosCount: form.photos,
      verifyNow: form.verifyNow,
      lookingFor: form.lookingFor,
      ageMin: form.ageMin,
      ageMax: form.ageMax,
      distanceKm: form.distance,
      targetLang: form.targetLang,
      autoTranslate: form.autoTranslate,
      autoDetectLanguage: form.autoDetectLanguage,
      notifications: form.notifications,
      preciseLocation: form.preciseLocation,
    });
    if (isAuthError(response)) {
      setSubmitErrorMessage(response.message ?? 'Unable to save onboarding now. Please retry.');
      setSubmitStatus('error');
      return;
    }
    saveOnboardingProfileSnapshot({
      firstName: form.firstName,
      city: form.city,
      intent: form.intent || 'verrai',
      interests: form.interests,
      birthDate: form.birthDate,
      verifyNow: form.verifyNow,
    });
    setSubmitStatus('success');
    clearOnboardingDraft();
    navigate('/discover');
  };

  const next = async () => {
    if (!canContinue) return;
    setSubmitErrorMessage('');
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    await completeOnboardingAndGoDiscover();
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
        {isDateSelectorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md p-4 flex items-end sm:items-center sm:justify-center"
            onClick={closeDateSelector}
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
                  <h3 className="text-xl font-black italic uppercase tracking-tight">{copy.dateModal.title}</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{copy.dateModal.subtitle}</p>
                </div>
                <button className="h-9 w-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center" onClick={closeDateSelector} aria-label={copy.common.close}>
                  <ICONS.X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40 px-2 pb-2">{copy.dateModal.day}</p>
                  <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1 pr-1">
                    {draftDays.map((day) => (
                      <button
                        key={`draft-day-${day}`}
                        onClick={() => setDateDraft((prev) => ({ ...prev, day }))}
                        className={`w-full rounded-xl px-2 py-2 text-sm font-black transition-all ${
                          dateDraft.day === day ? 'gradient-premium text-white' : 'bg-white/0 text-white/65 hover:bg-white/10'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[18px] border border-white/10 bg-white/5 p-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40 px-2 pb-2">{copy.dateModal.month}</p>
                  <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1 pr-1">
                    {copy.dateModal.months.map((month, index) => {
                      const monthNumber = index + 1;
                      return (
                        <button
                          key={`draft-month-${month}`}
                          onClick={() => updateDraftMonth(monthNumber)}
                          className={`w-full rounded-xl px-2 py-2 text-sm font-black transition-all ${
                            dateDraft.month === monthNumber ? 'gradient-premium text-white' : 'bg-white/0 text-white/65 hover:bg-white/10'
                          }`}
                        >
                          {month.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[18px] border border-white/10 bg-white/5 p-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40 px-2 pb-2">{copy.dateModal.year}</p>
                  <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1 pr-1">
                    {YEARS.map((year) => (
                      <button
                        key={`draft-year-${year}`}
                        onClick={() => updateDraftYear(year)}
                        className={`w-full rounded-xl px-2 py-2 text-sm font-black transition-all ${
                          dateDraft.year === year ? 'gradient-premium text-white' : 'bg-white/0 text-white/65 hover:bg-white/10'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-sky-500/10 p-3 mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45 mb-1">{copy.dateModal.selectedDate}</p>
                <p className="text-lg font-black tracking-tight">{formatDate(toIsoDate(dateDraft.day, dateDraft.month, dateDraft.year))}</p>
              </div>

              <button onClick={applyDateSelection} className="w-full h-[var(--cta-height)] rounded-[22px] gradient-premium font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_30px_rgba(236,72,153,0.25)]">
                {copy.dateModal.confirm}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <h3 className="text-xl font-black italic uppercase tracking-tight">{copy.cityModal.title}</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{copy.cityModal.subtitle}</p>
                </div>
                <button
                  className="h-9 w-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center"
                  onClick={() => {
                    setIsCitySelectorOpen(false);
                    setCitySearch('');
                  }}
                  aria-label={copy.common.close}
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
                  placeholder={copy.cityModal.search}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-2">
                {filteredCities.map((city) => {
                  const isActive = form.city === city.key;
                  return (
                    <button
                      key={`city-option-${city.key}`}
                      onClick={() => {
                        setField('city', city.key);
                        setIsCitySelectorOpen(false);
                        setCitySearch('');
                      }}
                      className={`w-full rounded-[18px] border px-4 py-3.5 flex items-center gap-3 text-left transition-all ${
                        isActive ? 'border-pink-500/45 bg-gradient-to-r from-pink-500/20 to-sky-500/20' : 'border-white/10 bg-white/5 hover:border-pink-500/30'
                      }`}
                    >
                      <span className="text-2xl leading-none">{flagFromCode(city.flagCode)}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-wide">{copy.cities[city.key] ?? city.key}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{copy.common.launchServer}</span>
                      </div>
                      {isActive && <Check size={16} className="ml-auto text-pink-300" />}
                    </button>
                  );
                })}
                {filteredCities.length === 0 && (
                  <p className="text-center text-xs text-white/45 py-8 uppercase tracking-[0.16em] font-black">{copy.cityModal.empty}</p>
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
                  <h3 className="text-xl font-black italic uppercase tracking-tight">{copy.nationalityModal.title}</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{copy.nationalityModal.subtitle}</p>
                </div>
                <button
                  className="h-9 w-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center"
                  onClick={() => {
                    setIsNationalitySelectorOpen(false);
                    setNationalitySearch('');
                  }}
                  aria-label={copy.common.close}
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
                  placeholder={copy.nationalityModal.search}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-2">
                {filteredNationalities.map((nationality) => {
                  const isActive = form.originCountry === nationality.key;
                  return (
                    <button
                      key={`nationality-option-${nationality.key}`}
                      onClick={() => {
                        setField('originCountry', nationality.key);
                        setIsNationalitySelectorOpen(false);
                        setNationalitySearch('');
                      }}
                      className={`w-full rounded-[18px] border px-4 py-3.5 flex items-center gap-3 text-left transition-all ${
                        isActive ? 'border-pink-500/45 bg-gradient-to-r from-pink-500/20 to-sky-500/20' : 'border-white/10 bg-white/5 hover:border-pink-500/30'
                      }`}
                    >
                      <span className="text-2xl leading-none">{flagFromCode(nationality.flagCode)}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-wide">
                          {copy.nationalities[nationality.key] ?? nationality.key}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{copy.nationalityCategories[nationality.categoryKey] ?? nationality.categoryKey}</span>
                      </div>
                      {isActive && <Check size={16} className="ml-auto text-pink-300" />}
                    </button>
                  );
                })}
                {filteredNationalities.length === 0 && (
                  <p className="text-center text-xs text-white/45 py-8 uppercase tracking-[0.16em] font-black">{copy.nationalityModal.empty}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container-form h-full mx-auto flex flex-col gap-4">
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={back} className="h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center" aria-label={copy.common.close}>
              <ICONS.ChevronLeft size={18} />
            </button>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
              {copy.top.stepOf.replace('{step}', String(step)).replace('{total}', String(TOTAL_STEPS))}
            </p>
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
                  <h1 className="text-[2.25rem] font-black italic uppercase tracking-tight">{copy.intro.title}</h1>
                  <p className="text-white/60 font-semibold uppercase tracking-[0.08em] max-w-[20ch]">{copy.intro.subtitle}</p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.consent.title}</h2>
                  <p className="text-white/60">{copy.consent.subtitle}</p>
                  <button onClick={() => setField('consentAge', !form.consentAge)} className="w-full rounded-[20px] border border-white/10 bg-white/5 p-4 text-left">
                    {form.consentAge ? '[x]' : '[ ]'} {copy.consent.age}
                  </button>
                  <button onClick={() => setField('consentTerms', !form.consentTerms)} className="w-full rounded-[20px] border border-white/10 bg-white/5 p-4 text-left">
                    {form.consentTerms ? '[x]' : '[ ]'} {copy.consent.terms}
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.auth.title}</h2>
                  {isAuthenticated ? (
                    <div className="rounded-[18px] border border-emerald-400/30 bg-emerald-500/10 p-4">
                      <p className="text-sm font-black uppercase tracking-[0.12em] text-emerald-100">Authenticated</p>
                      <p className="mt-2 text-xs text-white/75">Session is active. Continue onboarding.</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
                        {profileHydrationStatus === 'loading'
                          ? 'Profile sync: loading'
                          : profileHydrationStatus === 'retry'
                            ? 'Profile sync: retry'
                          : profileHydrationStatus === 'success'
                            ? 'Profile sync: success'
                            : profileHydrationStatus === 'error'
                              ? 'Profile sync: error'
                              : 'Profile sync: idle'}
                      </p>
                      {profileHydrationStatus === 'error' && (
                        <button
                          type="button"
                          onClick={() => {
                            void hydrateProfile('retry');
                          }}
                          className="mt-2 h-9 px-3 rounded-full border border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
                        >
                          Retry sync
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-white/60 text-sm">Connect your account with Google before continuing.</p>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = authApi.getGoogleStartUrl('/onboarding', '/onboarding');
                          }}
                          className="h-11 rounded-[14px] border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-[0.16em] hover:border-pink-500/35 transition-all"
                        >
                          Continue with Google
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/login?from=/onboarding')}
                        className="h-10 px-4 rounded-full border border-white/15 bg-white/5 text-[11px] font-black uppercase tracking-[0.14em] text-white/75"
                      >
                        Open login
                      </button>
                      {submitErrorMessage && <p className="text-xs text-red-300">{submitErrorMessage}</p>}
                    </>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.profile.title}</h2>

                  <div className="grid grid-cols-2 gap-3">
                    <input className={fieldClass} placeholder={copy.profile.firstNamePlaceholder} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">{copy.profile.birthDate}</p>
                      <button type="button" className={`${fieldClass} h-[50px] flex items-center justify-between text-left`} onClick={openDateSelector}>
                        <span className={form.birthDate ? 'text-white' : 'text-white/35'}>{form.birthDate ? formatDate(form.birthDate) : copy.profile.birthDatePlaceholder}</span>
                        <CalendarDays size={18} className="text-white/60" />
                      </button>
                    </div>
                  </div>

                  {zodiac && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[18px] border border-pink-500/25 bg-gradient-to-r from-pink-500/10 to-blue-500/10 p-3.5 backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl gradient-premium flex items-center justify-center text-white text-xl shadow-[0_10px_24px_rgba(236,72,153,0.35)]">{zodiac.symbol}</div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{copy.profile.zodiac}</p>
                            <p className="text-base font-black tracking-tight">{copy.zodiacLabels[zodiac.key] ?? zodiac.key}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${age >= 18 ? 'text-pink-300' : 'text-red-400'}`}>{age > 0 ? age : '--'}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{copy.common.years}</p>
                        </div>
                      </div>
                      {age > 0 && age < 18 && <p className="mt-2 text-xs text-red-300">{copy.profile.required18}</p>}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {(['homme', 'femme', 'autre'] as const).map((gender) => (
                      <button key={gender} onClick={() => setField('gender', gender)} className={tileClass(form.gender === gender)}>
                        {copy.genders[gender]}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">{copy.profile.city}</p>
                      <button
                        type="button"
                        onClick={() => setIsCitySelectorOpen(true)}
                        className={`${fieldClass} h-[50px] flex items-center justify-between text-left`}
                      >
                        <span className={form.city ? 'text-white' : 'text-white/35'}>
                          {selectedCity ? `${flagFromCode(selectedCity.flagCode)} ${copy.cities[selectedCity.key] ?? selectedCity.key}` : copy.profile.cityPlaceholder}
                        </span>
                        <ChevronsUpDown size={16} className="text-white/45" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-2">{copy.profile.nationality}</p>
                      <button
                        type="button"
                        onClick={() => setIsNationalitySelectorOpen(true)}
                        className={`${fieldClass} h-[50px] flex items-center justify-between text-left`}
                      >
                        <span className={form.originCountry ? 'text-white' : 'text-white/35'}>
                          {selectedNationality
                            ? `${flagFromCode(selectedNationality.flagCode)} ${copy.nationalities[selectedNationality.key] ?? selectedNationality.key}`
                            : copy.profile.nationalityPlaceholder}
                        </span>
                        <ChevronsUpDown size={16} className="text-white/45" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LAUNCH_CITIES.map((city) => (
                      <button key={`quick-city-${city.key}`} onClick={() => setField('city', city.key)} className={pillClass(form.city === city.key)}>
                        {`${flagFromCode(city.flagCode)} ${copy.cities[city.key] ?? city.key}`}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_KEYS.map((lang) => (
                      <button key={`lang-${lang}`} onClick={() => toggleInArray('languages', lang)} className={pillClass(form.languages.includes(lang))}>
                        {copy.languageLabels[lang] ?? lang}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.photo.title}</h2>
                  <p className="text-white/60">{copy.photo.subtitle}</p>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onPhotoFilesSelected}
                  />
                  <button
                    type="button"
                    onClick={openPhotoPicker}
                    className="w-full h-11 rounded-[14px] border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-[0.16em] hover:border-pink-500/35 transition-all"
                  >
                    Select photos from device
                  </button>
                  <div className="grid grid-cols-3 auto-rows-[88px] sm:auto-rows-[96px] md:auto-rows-[110px] gap-3 max-w-[32rem]">
                    {Array.from({ length: PHOTO_SLOTS }).map((_, index) => {
                      const slotNumber = index + 1;
                      const uploadedPhoto = uploadedPhotos[index] ?? null;
                      const isFilled = Boolean(uploadedPhoto);
                      const isMain = index === 0;
                      const slotLayout =
                        index === 0
                          ? 'col-span-2 row-span-2'
                          : index === 1
                          ? 'col-start-3 row-start-1'
                          : index === 2
                          ? 'col-start-3 row-start-2'
                          : index === 3
                          ? 'col-start-1 row-start-3'
                          : 'col-start-2 row-start-3';

                      return (
                        <button
                          key={`photo-slot-${slotNumber}`}
                          type="button"
                          onClick={() => {
                            if (isFilled) {
                              removePhotoAt(index);
                              return;
                            }
                            openPhotoPicker();
                          }}
                          className={`${slotLayout} relative h-full min-h-[88px] rounded-[20px] border border-dashed transition-all overflow-hidden ${
                            isFilled
                              ? 'border-pink-500/45 bg-black/40'
                              : 'border-white/20 bg-white/[0.02] hover:border-pink-500/35'
                          }`}
                        >
                          {uploadedPhoto && (
                            <img
                              src={uploadedPhoto?.url ?? '/placeholder.svg'}
                              alt={`Selected photo ${slotNumber}`}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <div
                              className={`rounded-full flex items-center justify-center ${
                                isMain ? 'w-12 h-12' : 'w-9 h-9'
                              } ${isFilled ? 'bg-black/45 text-pink-200' : 'bg-white/5 text-white/45'}`}
                            >
                              {isFilled ? <Check size={isMain ? 22 : 16} /> : <ICONS.Camera size={isMain ? 22 : 16} />}
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                              {isMain ? copy.photo.mainPhoto : `${copy.photo.photoLabel} ${slotNumber}`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-white/55">
                    {copy.photo.added
                      .replace('{count}', String(uploadedPhotos.length))
                      .replace('{total}', String(PHOTO_SLOTS))}
                  </p>
                  {photoUploadStatus === 'loading' || photoUploadStatus === 'retry' ? (
                    <p className="text-xs text-white/60">Uploading photo...</p>
                  ) : null}
                  {photoErrorMessage ? <p className="text-xs text-red-300">{photoErrorMessage}</p> : null}
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.lookingFor.title}</h2>
                  <p className="text-white/60">{copy.lookingFor.subtitle}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['hommes', 'femmes', 'tous'] as const).map((value) => (
                      <button key={`looking-${value}`} onClick={() => setField('lookingFor', value)} className={tileClass(form.lookingFor === value)}>
                        {copy.lookingFor.label[value]}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3 rounded-[18px] border border-white/10 bg-white/5 backdrop-blur-xl p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{copy.lookingFor.ageRange}</p>
                      <p className="text-sm text-pink-300 font-black">{`${form.ageMin} - ${form.ageMax} ${copy.common.years}`}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span>{copy.lookingFor.ageMin}</span>
                        <span className="font-black text-pink-300">{form.ageMin}</span>
                      </div>
                      <input
                        type="range"
                        min={18}
                        max={Math.max(form.ageMax - 1, 18)}
                        value={form.ageMin}
                        onChange={(e) => setField('ageMin', Math.min(Number(e.target.value), form.ageMax - 1))}
                        className="w-full accent-pink-500"
                        aria-label={copy.lookingFor.ageMin}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span>{copy.lookingFor.ageMax}</span>
                        <span className="font-black text-sky-300">{form.ageMax}</span>
                      </div>
                      <input
                        type="range"
                        min={Math.min(form.ageMin + 1, AGE_RANGE_MAX)}
                        max={AGE_RANGE_MAX}
                        value={form.ageMax}
                        onChange={(e) => setField('ageMax', Math.max(Number(e.target.value), form.ageMin + 1))}
                        className="w-full accent-sky-400"
                        aria-label={copy.lookingFor.ageMax}
                      />
                    </div>
                  </div>
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
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.intent.title}</h2>
                  <p className="text-white/60">{copy.intent.subtitle}</p>
                  {INTENT_KEYS.map((intentId) => {
                    const intentOption = copy.intent.options[intentId];
                    return (
                    <button
                      key={`intent-${intentId}`}
                      onClick={() => setField('intent', intentId as FormState['intent'])}
                      className={`w-full rounded-[18px] border px-4 py-3.5 text-left transition-all ${
                        form.intent === intentId ? 'border-pink-500/50 bg-pink-500/10 shadow-[0_10px_24px_rgba(236,72,153,0.15)]' : 'border-white/10 bg-white/5 hover:border-white/25'
                      }`}
                    >
                      <p className="text-sm font-black uppercase tracking-[0.08em]">{intentOption.title}</p>
                      <p className="text-xs text-white/55 mt-1">{intentOption.subtitle}</p>
                    </button>
                  )})}
                </div>
              )}

              {step === 8 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.interests.title}</h2>
                  <p className="text-white/60">{copy.interests.subtitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_KEYS.map((interest) => (
                      <button key={`interest-${interest}`} onClick={() => toggleInArray('interests', interest, 5)} className={pillClass(form.interests.includes(interest))}>
                        {copy.interestLabels[interest] ?? interest}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-white/50">{copy.interests.selected.replace('{count}', String(form.interests.length))}</p>
                </div>
              )}

              {step === 9 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.translation.title}</h2>
                  <p className="text-white/60">{copy.translation.subtitle}</p>

                  <button
                    onClick={() => setField('autoDetectLanguage', !form.autoDetectLanguage)}
                    className="w-full rounded-[18px] border border-white/10 bg-white/5 p-4 flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.08em]">{copy.translation.detectTitle}</p>
                      <p className="text-xs text-white/50 mt-1">{copy.translation.detectSubtitle}</p>
                    </div>
                    <span className={`text-xs font-black uppercase ${form.autoDetectLanguage ? 'text-pink-300' : 'text-white/55'}`}>
                      {form.autoDetectLanguage ? copy.common.active : copy.common.off}
                    </span>
                  </button>

                  <div className="w-full rounded-[18px] border border-sky-400/25 bg-gradient-to-r from-sky-500/10 to-pink-500/10 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.08em]">{copy.translation.autoTitle}</p>
                      <p className="text-xs text-white/50 mt-1">{copy.translation.autoSubtitle}</p>
                    </div>
                    <span className="text-xs font-black uppercase text-sky-300">{copy.common.on}</span>
                  </div>
                </div>
              )}

              {step === 10 && (
                <div className="space-y-4 text-center py-6">
                  <div className="w-24 h-24 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 overflow-hidden flex items-center justify-center">
                    {verifySelfiePreviewUrl ? (
                      <img src={verifySelfiePreviewUrl} alt="Verification selfie" className="w-full h-full object-cover" />
                    ) : (
                      <ICONS.Shield className="text-blue-400" size={40} />
                    )}
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.verify.title}</h2>
                  <p className="text-white/60">{copy.verify.subtitle}</p>
                  <input
                    ref={verifySelfieCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={onVerifySelfieSelected}
                  />
                  <GlassButton variant="premium" onClick={openVerifySelfieConsent} className="w-full h-[var(--cta-height)] font-black uppercase tracking-[0.14em]">
                    {copy.verify.now}
                  </GlassButton>
                  {verifyConsentOpen && (
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-left space-y-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-200">
                        Selfie verification consent
                      </p>
                      <p className="text-xs text-white/75 leading-relaxed">
                        You agree to provide a selfie for identity verification. This photo is used only for verification and will not appear on your profile, feed, or chats.
                      </p>
                      <button
                        onClick={() => {
                          setVerifyConsentGranted(true);
                          setVerifyConsentOpen(false);
                          openVerifySelfieCameraPicker();
                        }}
                        className="w-full h-10 rounded-xl border border-sky-300/35 bg-sky-500/12 text-sky-100 text-[10px] font-black uppercase tracking-[0.12em]"
                      >
                        Front camera selfie
                      </button>
                      <button
                        onClick={() => setVerifyConsentOpen(false)}
                        className="w-full h-9 rounded-xl border border-white/15 bg-transparent text-white/70 text-[10px] font-black uppercase tracking-[0.12em]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {verifyConsentGranted && !verifyConsentOpen && (
                    <div className="rounded-[14px] border border-sky-400/20 bg-sky-500/10 p-2">
                      <p className="text-[10px] text-sky-100 font-black uppercase tracking-[0.12em]">
                        Consent captured. Use front camera for selfie verification.
                      </p>
                    </div>
                  )}
                  {verifySelfieStatus === 'success' && <p className="text-xs text-sky-300">{copy.common.active}</p>}
                  {verifySelfieErrorMessage && <p className="text-xs text-red-300">{verifySelfieErrorMessage}</p>}
                  <button
                    onClick={() => {
                      setField('verifyNow', false);
                      setVerifySelfieStatus('idle');
                      setVerifyConsentOpen(false);
                      setVerifyConsentGranted(false);
                      if (verifySelfiePreviewUrl && verifySelfiePreviewUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(verifySelfiePreviewUrl);
                      }
                      setVerifySelfiePreviewUrl(null);
                    }}
                    className="text-xs font-black uppercase tracking-[0.2em] text-white/55"
                  >
                    {copy.verify.later}
                  </button>
                </div>
              )}

              {step === 11 && (
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.permissions.title}</h2>
                  <button onClick={() => setField('preciseLocation', !form.preciseLocation)} className="w-full rounded-[18px] border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                    <span>{copy.permissions.preciseLocation}</span>
                    <span className="text-pink-400 text-xs font-black uppercase">{form.preciseLocation ? copy.common.active : copy.common.enable}</span>
                  </button>
                  <button onClick={() => setField('notifications', !form.notifications)} className="w-full rounded-[18px] border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                    <span>{copy.permissions.notifications}</span>
                    <span className="text-sky-400 text-xs font-black uppercase">{form.notifications ? copy.common.active : copy.common.enable}</span>
                  </button>
                </div>
              )}

              {step === 12 && (
                <div className="space-y-5 text-center py-4">
                  <div className="w-32 h-32 mx-auto rounded-full border-4 border-pink-500/70 overflow-hidden relative">
                    {uploadedPhotos[0]?.url || verifySelfiePreviewUrl ? (
                      <img
                        src={uploadedPhotos[0]?.url ?? verifySelfiePreviewUrl ?? ''}
                        alt={copy.ready.profileAlt}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-600/30 to-sky-500/30 flex items-center justify-center">
                        <ICONS.Profile size={34} className="text-white/70" />
                      </div>
                    )}
                    {form.verifyNow && (
                      <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center">
                        <ICONS.Shield size={14} />
                      </span>
                    )}
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">{copy.ready.title}</h2>
                  <p className="text-white/60">{`${form.firstName || 'User'}${age ? `, ${age} ${copy.common.years}` : ''}${form.city ? ` - ${copy.cities[form.city]}` : ''}`}</p>
                  <GlassButton
                    variant="premium"
                    onClick={() => {
                      void completeOnboardingAndGoDiscover();
                    }}
                    className="w-full h-[var(--cta-height)] font-black uppercase tracking-[0.14em]"
                  >
                    {copy.ready.viewProfiles}
                  </GlassButton>
                  <button
                    onClick={() => navigate('/profile/edit', { state: { fromOnboarding: true } })}
                    className="text-xs font-black uppercase tracking-[0.2em] text-white/55"
                  >
                    {copy.ready.improveProfile}
                  </button>
                  {submitErrorMessage && <p className="text-xs text-red-300">{submitErrorMessage}</p>}
                  {submitStatus === 'error' && (
                    <button
                      onClick={next}
                      className="h-9 px-4 rounded-full border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
                    >
                      Retry submit
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {step < 12 && (
          <div className="pb-safe shrink-0">
            <button
              onClick={next}
              disabled={!canContinue || submitStatus === 'loading' || submitStatus === 'retry'}
              className={`w-full h-[var(--cta-height)] rounded-[24px] font-black uppercase tracking-[0.16em] transition-all ${
                canContinue && submitStatus !== 'loading' && submitStatus !== 'retry'
                  ? 'gradient-premium text-white shadow-[0_14px_30px_rgba(236,72,153,0.28)]'
                  : 'bg-white/20 text-white/45 cursor-not-allowed'
              }`}
            >
              {submitStatus === 'loading' || submitStatus === 'retry' ? 'Please wait...' : copy.common.continue}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;
