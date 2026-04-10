import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useI18n } from '../i18n/I18nProvider';
import { translations } from '../i18n/translations';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { appApi } from '../services';
import type { SettingsEnvelope, BlockEntry } from '../contracts';
import { resolveShadowGhostAccess } from '../domain/shadowGhost';
import { TRAVEL_PASS_ENABLED, TRAVEL_PASS_LOCKED_CITY } from '../domain/travelPass';
import { useAuth } from '../auth/AuthProvider';

type SectionId = 'account' | 'privacy' | 'notifications' | 'preferences';
type ItemType = 'text' | 'password' | 'toggle' | 'list' | 'slider' | 'range' | 'select';

type SettingItem = {
  id: string;
  labelKey: string;
  type: ItemType;
  descKey?: string;
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  selectedOption?: string;
};

type SettingSection = {
  id: SectionId;
  titleKey: string;
  icon: ReactNode;
  items: SettingItem[];
  path: string;
};

type ApiStatus = 'idle' | 'loading' | 'success' | 'error' | 'retry';

const PHONE_COUNTRY_CODES = [
  { value: '+7', label: '+7 (RU)' },
  { value: '+1', label: '+1 (US/CA)' },
  { value: '+33', label: '+33 (FR)' },
  { value: '+44', label: '+44 (UK)' },
  { value: '+49', label: '+49 (DE)' },
];

const MOJIBAKE_RE = /(?:Ð.|Ñ.|Ã.|Â.)|�/;
const resolveI18nPath = (obj: Record<string, unknown>, path: string): string | undefined =>
  path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj) as string | undefined;

const AccountSettingsScreen = () => {
  const navigate = useNavigate();
  const { category, sub } = useParams();
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const { t: rawT, locale, setLocale } = useI18n();
  const t = (key: string, params?: Record<string, string | number>) => {
    const localized = rawT(key, params);
    if (localized !== key && !MOJIBAKE_RE.test(localized)) return localized;
    const englishTemplate = resolveI18nPath(
      translations.en as unknown as Record<string, unknown>,
      key,
    );
    if (typeof englishTemplate !== 'string') return localized;
    if (!params) return englishTemplate;
    return englishTemplate.replace(/\{(\w+)\}/g, (_, name: string) => `${params[name] ?? `{${name}}`}`);
  };
  const { logout, user } = useAuth();
  const isLarge = isDesktop || isTablet;
  const [settingsEnvelope, setSettingsEnvelope] = useState<SettingsEnvelope | null>(null);
  const [loadStatus, setLoadStatus] = useState<ApiStatus>('idle');
  const [profileMe, setProfileMe] = useState<{
    profile: {
      first_name?: string | null;
      last_name?: string | null;
      locale?: string | null;
      city?: string | null;
    } | null;
    settings: {
      language?: 'en' | 'ru' | null;
      phone_country_code?: string | null;
      phone_national_number?: string | null;
      distance_km?: number | null;
      age_min?: number | null;
      age_max?: number | null;
      gender_preference?: 'everyone' | 'women' | 'men' | null;
      notifications_enabled?: boolean | null;
    } | null;
  } | null>(null);
  const [profilePatchStatus, setProfilePatchStatus] = useState<ApiStatus>('idle');
  const [settingsPatchStatus, setSettingsPatchStatus] = useState<ApiStatus>('idle');
  const [profileSettingsError, setProfileSettingsError] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<BlockEntry[]>([]);
  const [distanceDraft, setDistanceDraft] = useState(25);
  const [ageMinDraft, setAgeMinDraft] = useState(22);
  const [ageMaxDraft, setAgeMaxDraft] = useState(35);
  const [phoneCountryCodeDraft, setPhoneCountryCodeDraft] = useState('+7');
  const [phoneNationalNumberDraft, setPhoneNationalNumberDraft] = useState('');
  const loadRequestIdRef = useRef(0);

  const loadAll = useCallback(async (mode: 'load' | 'retry' = 'load') => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoadStatus(mode === 'retry' ? 'retry' : 'loading');
    try {
      const [settingsPayload, profilePayload, blocksPayload] = await Promise.all([
        appApi.getSettings(),
        appApi.getProfileMe(),
        appApi.getBlockedUsers(),
      ]);
      if (loadRequestIdRef.current !== requestId) return;
      setSettingsEnvelope(settingsPayload);
      setProfileMe({
        profile: profilePayload.profile,
        settings: profilePayload.settings,
      });
      setBlockedUsers(blocksPayload.blocks);
      setLoadStatus('success');
    } catch {
      if (loadRequestIdRef.current !== requestId) return;
      setLoadStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll('load');
  }, [loadAll]);

  const settings = settingsEnvelope?.settings;
  const travelPassServerAccess = settingsEnvelope?.travelPassServerAccess;
  const shadowGhostAccess = resolveShadowGhostAccess({
    planTier: settingsEnvelope?.planTier ?? 'free',
    entitlementSource: settings?.preferences.shadowGhostEntitlementSource,
    entitlementExpiresAtIso: settings?.preferences.shadowGhostEntitlementExpiresAtIso,
  });

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  const patchSettings = (patch: Parameters<typeof appApi.patchSettings>[0]['patch']) => {
    const save = async () => {
      setSettingsPatchStatus(settingsPatchStatus === 'error' ? 'retry' : 'loading');
      setProfileSettingsError('');
      try {
        const payload = await appApi.patchSettings({ patch });
        setSettingsEnvelope(payload);
        if (patch.preferences?.language) {
          setLocale(patch.preferences.language);
        }
        setSettingsPatchStatus('success');
      } catch {
        setSettingsPatchStatus('error');
        setProfileSettingsError(t('settings.error'));
      }
    };

    void save();
  };

  const patchProfileSettings = async (payload: Parameters<typeof appApi.patchProfileMe>[0]) => {
    setProfilePatchStatus(profilePatchStatus === 'error' ? 'retry' : 'loading');
    setProfileSettingsError('');
    let failed = false;
    try {
      const response = await appApi.patchProfileMe(payload);
      setProfileMe({
        profile: response.profile,
        settings: response.settings,
      });
      setProfilePatchStatus('success');
    } catch {
      failed = true;
      setProfilePatchStatus('error');
      setProfileSettingsError(t('settings.error'));
    } finally {
      if (!failed) {
        setProfilePatchStatus('idle');
      }
    }
  };

  const selectedGenderOption =
    (profileMe?.settings?.gender_preference ?? settings?.preferences.genderPreference) === 'men'
      ? 'settings.items.men'
      : (profileMe?.settings?.gender_preference ?? settings?.preferences.genderPreference) === 'women'
        ? 'settings.items.women'
        : 'settings.items.everyone';

  const selectedLanguageOption = `locale.${profileMe?.settings?.language ?? locale}`;

  const selectedTravelCityOption = !TRAVEL_PASS_ENABLED
    ? 'settings.cities.voronezh'
    : settings?.preferences.travelPassCity === 'voronezh'
      ? 'settings.cities.voronezh'
      : settings?.preferences.travelPassCity === 'saint-petersburg'
        ? 'settings.cities.saintPetersburg'
        : settings?.preferences.travelPassCity === 'sochi'
          ? 'settings.cities.sochi'
          : 'settings.cities.moscow';

  const selectedVisibilityOption =
    (settings?.privacy.visibility ?? 'public') === 'hidden'
      ? 'settings.visibility.hidden'
      : (settings?.privacy.visibility ?? 'public') === 'limited'
        ? 'settings.visibility.limited'
        : 'settings.visibility.public';

  const sections: SettingSection[] = [
    {
      id: 'account',
      titleKey: 'settings.sections.account',
      icon: <ICONS.Profile size={18} />,
      items: [
        { labelKey: 'settings.items.phone', id: 'phone', type: 'text' },
        { labelKey: 'settings.items.email', id: 'email', type: 'text' },
        { labelKey: 'settings.items.password', id: 'password', type: 'password' },
      ],
      path: '/settings/account',
    },
    {
      id: 'privacy',
      titleKey: 'settings.sections.privacy',
      icon: <ICONS.Shield size={18} />,
      items: [
        {
          labelKey: 'settings.items.visibility',
          id: 'visibility',
          type: 'select',
          descKey: 'settings.items.visibilityDesc',
          options: ['settings.visibility.public', 'settings.visibility.limited', 'settings.visibility.hidden'],
          selectedOption: selectedVisibilityOption,
        },
        { labelKey: 'settings.items.hideAge', id: 'hide-age', type: 'toggle', descKey: 'settings.items.hideAgeDesc' },
        { labelKey: 'settings.items.hideDistance', id: 'hide-distance', type: 'toggle', descKey: 'settings.items.hideDistanceDesc' },
        { labelKey: 'settings.items.shadowGhost', id: 'shadow-ghost', type: 'toggle', descKey: 'settings.items.shadowGhostDesc' },
        { labelKey: 'settings.items.incognito', id: 'incognito', type: 'toggle', descKey: 'settings.items.incognitoDesc' },
        { labelKey: 'settings.items.readReceipts', id: 'read-receipts', type: 'toggle', descKey: 'settings.items.readReceiptsDesc' },
        {
          labelKey: 'settings.items.travelPass',
          id: 'travel-pass-city',
          type: 'select',
          descKey: 'settings.items.travelPassDesc',
          options: ['settings.cities.voronezh', 'settings.cities.moscow', 'settings.cities.saintPetersburg', 'settings.cities.sochi'],
          selectedOption: selectedTravelCityOption,
        },
        { labelKey: 'settings.items.blocked', id: 'blocked', type: 'list', descKey: 'settings.items.blockedDesc' },
      ],
      path: '/settings/privacy',
    },
    {
      id: 'notifications',
      titleKey: 'settings.sections.notifications',
      icon: <ICONS.Bell size={18} />,
      items: [
        { labelKey: 'settings.items.notificationsMaster', id: 'notifications-enabled', type: 'toggle', descKey: 'settings.items.notificationsMasterDesc' },
      ],
      path: '/settings/notifications',
    },
    {
      id: 'preferences',
      titleKey: 'settings.sections.preferences',
      icon: <ICONS.Settings size={18} />,
      items: [
        { labelKey: 'settings.items.distance', id: 'distance', type: 'slider', unit: 'km', min: 2, max: 160 },
        { labelKey: 'settings.items.age', id: 'age', type: 'range', min: 18, max: 100 },
        {
          labelKey: 'settings.items.gender',
          id: 'gender',
          type: 'select',
          options: ['settings.items.men', 'settings.items.women', 'settings.items.everyone'],
          selectedOption: selectedGenderOption,
        },
        {
          labelKey: 'settings.items.language',
          id: 'language',
          type: 'select',
          options: ['locale.en', 'locale.ru'],
          selectedOption: selectedLanguageOption,
        },
      ],
      path: '/settings/preferences',
    },
  ];

  const currentSection = sections.find((section) => section.id === (category as SectionId));
  const activeSection = currentSection ?? sections[0];
  const hasInvalidCategory = Boolean(category) && !currentSection;
  const currentSubItem = sub ? activeSection.items.find((entry) => entry.id === sub) : undefined;
  const hasInvalidSub = Boolean(sub) && !currentSubItem;

  const getSection = () => activeSection;
  const getSectionTitle = (section: SettingSection) => t(section.titleKey);
  const currentDistanceValue = profileMe?.settings?.distance_km ?? settings?.preferences.distanceKm ?? 25;
  const travelPassSourceLabel = travelPassServerAccess
    ? t(`settings.travelPass.sources.${travelPassServerAccess.source}`)
    : t('settings.travelPass.sources.none');

  const isToggleEnabled = (id: string) => {
    switch (id) {
      case 'hide-age':
        return settings?.privacy.hideAge ?? false;
      case 'hide-distance':
        return settings?.privacy.hideDistance ?? false;
      case 'shadow-ghost':
        return settings?.privacy.shadowGhost ?? false;
      case 'incognito':
        return settings?.privacy.incognito ?? false;
      case 'read-receipts':
        return settings?.privacy.readReceipts ?? true;
      case 'notifications-enabled':
        return (
          (settings?.notifications.matches ?? true) ||
          (settings?.notifications.messages ?? true) ||
          (settings?.notifications.likes ?? true) ||
          (settings?.notifications.offers ?? true)
        );
      default:
        return false;
    }
  };

  useEffect(() => {
    setDistanceDraft(currentDistanceValue);
  }, [currentDistanceValue]);

  useEffect(() => {
    setAgeMinDraft(profileMe?.settings?.age_min ?? settings?.preferences.ageMin ?? 22);
    setAgeMaxDraft(profileMe?.settings?.age_max ?? settings?.preferences.ageMax ?? 35);
  }, [
    profileMe?.settings?.age_max,
    profileMe?.settings?.age_min,
    settings?.preferences.ageMax,
    settings?.preferences.ageMin,
  ]);

  const persistDistance = () => {
    if (distanceDraft === currentDistanceValue) return;
    void patchProfileSettings({
      settings: { distanceKm: distanceDraft },
    });
  };

  const persistAgeRange = () => {
    const persistedAgeMin = profileMe?.settings?.age_min ?? settings?.preferences.ageMin ?? 22;
    const persistedAgeMax = profileMe?.settings?.age_max ?? settings?.preferences.ageMax ?? 35;
    if (ageMinDraft === persistedAgeMin && ageMaxDraft === persistedAgeMax) return;
    void patchProfileSettings({
      settings: {
        ageMin: ageMinDraft,
        ageMax: ageMaxDraft,
      },
    });
  };

  useEffect(() => {
    const storedCode = profileMe?.settings?.phone_country_code;
    const storedNumber = profileMe?.settings?.phone_national_number;
    if (typeof storedCode === 'string' && storedCode.trim().length > 0) {
      setPhoneCountryCodeDraft(storedCode);
    }
    setPhoneNationalNumberDraft(
      typeof storedNumber === 'string' ? storedNumber.replace(/\D/g, '') : '',
    );
  }, [profileMe?.settings?.phone_country_code, profileMe?.settings?.phone_national_number]);

  const persistPhone = async () => {
    const normalizedCode = phoneCountryCodeDraft.trim();
    const normalizedNumber = phoneNationalNumberDraft.replace(/\D/g, '');
    const codeLooksValid = /^\+[0-9]{1,5}$/.test(normalizedCode);
    const numberLooksValid = /^[0-9]{4,15}$/.test(normalizedNumber);
    if (!codeLooksValid || !numberLooksValid) {
      setProfilePatchStatus('error');
      setProfileSettingsError(t('settings.phone.invalid'));
      return;
    }
    await patchProfileSettings({
      settings: {
        phoneCountryCode: normalizedCode,
        phoneNationalNumber: normalizedNumber,
      },
    });
  };

  const toggleSetting = (id: string) => {
    switch (id) {
      case 'hide-age':
        patchSettings({
          privacy: {
            hideAge: !(settings?.privacy.hideAge ?? false),
          },
        });
        break;
      case 'hide-distance':
        patchSettings({
          privacy: {
            hideDistance: !(settings?.privacy.hideDistance ?? false),
          },
        });
        break;
      case 'shadow-ghost':
        if (!shadowGhostAccess.canUse) {
          navigate('/boost');
          break;
        }
        patchSettings({
          privacy: {
            shadowGhost: !(settings?.privacy.shadowGhost ?? false),
          },
        });
        break;
      case 'incognito':
        patchSettings({
          privacy: {
            incognito: !(settings?.privacy.incognito ?? false),
          },
        });
        break;
      case 'read-receipts':
        patchSettings({
          privacy: {
            readReceipts: !(settings?.privacy.readReceipts ?? true),
          },
        });
        break;
      case 'notifications-enabled': {
        const nextValue = !isToggleEnabled('notifications-enabled');
        const nextNotifications = {
          matches: nextValue,
          messages: nextValue,
          likes: nextValue,
          offers: nextValue,
        };
        patchSettings({
          notifications: nextNotifications,
        });
        break;
      }
      default:
        break;
    }
  };

  const handleSelectOption = (itemId: string, optionKey: string) => {
    if (itemId === 'language') {
      const nextLocale = optionKey === 'locale.ru' ? 'ru' : 'en';
      setLocale(nextLocale);
      void patchProfileSettings({
        locale: nextLocale,
        settings: { language: nextLocale },
      });
      return;
    }

    if (itemId === 'gender') {
      const nextGender =
        optionKey === 'settings.items.men'
          ? 'men'
          : optionKey === 'settings.items.women'
            ? 'women'
            : 'everyone';
      void patchProfileSettings({
        settings: { genderPreference: nextGender },
      });
      return;
    }

    if (itemId === 'travel-pass-city') {
      if (!TRAVEL_PASS_ENABLED) return;
      if (!travelPassServerAccess?.canChangeServer) return;
      const nextCity =
        optionKey === 'settings.cities.voronezh'
          ? 'voronezh'
          : optionKey === 'settings.cities.saintPetersburg'
            ? 'saint-petersburg'
            : optionKey === 'settings.cities.sochi'
              ? 'sochi'
              : 'moscow';
      patchSettings({
        preferences: { travelPassCity: nextCity },
      });
      return;
    }

    if (itemId === 'visibility') {
      const nextVisibility =
        optionKey === 'settings.visibility.hidden'
          ? 'hidden'
          : optionKey === 'settings.visibility.limited'
            ? 'limited'
            : 'public';
      patchSettings({
        privacy: { visibility: nextVisibility },
      });
    }
  };

  const renderInvalidRouteState = () => (
    <div className="p-6 md:p-8">
      <div className="glass rounded-[28px] border border-white/10 p-6 md:p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-white/65">
          <ICONS.Info size={20} />
        </div>
        <h3 className="text-lg font-black">{t('settings.invalidTitle')}</h3>
        <p className="text-sm text-secondary">{t('settings.invalidSubtitle')}</p>
        <GlassButton onClick={() => navigate('/settings/account')} className="w-full md:w-auto px-6 py-3 rounded-2xl text-xs uppercase tracking-[0.18em]">
          {t('settings.backToSettings')}
        </GlassButton>
      </div>
    </div>
  );

  const renderDetail = () => {
    const isEmbedded = isLarge;
    const section = getSection();

    if (loadStatus === 'idle' || loadStatus === 'loading' || loadStatus === 'retry') {
      return (
        <div className="p-6 md:p-8">
          <div className="glass rounded-[28px] border border-white/10 p-6 md:p-8 text-center space-y-4">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/20 border-t-white/75 animate-spin" />
            <p className="text-sm text-secondary">
              {loadStatus === 'retry' ? `${t('discover.retry')}...` : t('settings.loading')}
            </p>
          </div>
        </div>
      );
    }

    if (loadStatus === 'error') {
      return (
        <div className="p-6 md:p-8">
          <div className="glass rounded-[28px] border border-red-400/30 bg-red-500/5 p-6 md:p-8 text-center space-y-4">
            <ICONS.Info size={20} className="mx-auto text-red-200" />
            <p className="text-sm text-white">{t('settings.error')}</p>
            <GlassButton
              onClick={() => {
                void loadAll('retry');
              }}
              className="w-full md:w-auto px-6 py-3 rounded-2xl text-xs uppercase tracking-[0.18em]"
            >
              {t('discover.retry')}
            </GlassButton>
          </div>
        </div>
      );
    }

    if (hasInvalidCategory || hasInvalidSub) {
      return renderInvalidRouteState();
    }

    if (sub) {
      const item = currentSubItem;
      const itemLabel = item ? t(item.labelKey) : sub;

      return (
        <div className={`${isEmbedded ? 'p-8' : 'p-6'} space-y-8`}>
          <div className="flex items-center gap-4 mb-6">
            {!isEmbedded && (
              <button onClick={() => navigate(`/settings/${section.id}`)} className="p-2 hover-effect rounded-full glass">
                <ICONS.ChevronLeft />
              </button>
            )}
            <h2 className="text-2xl font-bold">{itemLabel}</h2>
          </div>

          <div className="glass p-8 rounded-[32px] space-y-8 border border-white/5 shadow-2xl">
            <div className="space-y-2">
              <p className="text-secondary text-sm font-medium">{item?.descKey ? t(item.descKey) : t('settings.manageFallback', { label: itemLabel })}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">{t('settings.instantUpdate')}</p>
            </div>

            <div className="space-y-6">
              {item?.type === 'toggle' && (
                <div className="flex items-center justify-between p-6 glass rounded-2xl border border-white/5">
                  <span className="font-bold text-sm">{t('settings.activate', { label: itemLabel })}</span>
                  <button
                    onClick={() => toggleSetting(item.id)}
                    aria-pressed={isToggleEnabled(item.id)}
                    className={`group relative inline-flex h-7 w-14 rounded-full border transition-colors ${
                      isToggleEnabled(item.id)
                        ? 'bg-pink-500 border-pink-300/40 shadow-lg shadow-pink-500/20'
                        : 'bg-white/10 border-white/20 hover:border-white/35'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        isToggleEnabled(item.id) ? 'left-8' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {(item?.type === 'text' || item?.type === 'password') && (
                <div className="space-y-4">
                  {item.id === 'email' ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-1">{itemLabel}</label>
                      <input
                        type="text"
                        value={user?.email ?? ''}
                        readOnly
                        className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-medium text-white/80"
                      />
                    </div>
                  ) : item.id === 'phone' ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-1">{itemLabel}</label>
                      <div className="grid grid-cols-[130px_1fr] gap-3">
                        <select
                          value={phoneCountryCodeDraft}
                          onChange={(event) => setPhoneCountryCodeDraft(event.target.value)}
                          className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-bold text-white"
                        >
                          {PHONE_COUNTRY_CODES.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={phoneNationalNumberDraft}
                          onChange={(event) =>
                            setPhoneNationalNumberDraft(event.target.value.replace(/\D/g, '').slice(0, 15))
                          }
                          placeholder="9012345678"
                          className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-medium text-white"
                        />
                      </div>
                      <GlassButton
                        onClick={() => {
                          void persistPhone();
                        }}
                        className="w-full py-3 rounded-2xl text-xs uppercase tracking-[0.16em] font-black"
                      >
                        {t('settings.save')}
                      </GlassButton>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-1">{itemLabel}</label>
                      <div className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-sm text-white/70">
                        {t('settings.password.resetHint')}
                      </div>
                    </div>
                  )}
                  {profileSettingsError && <p className="text-xs text-red-300">{profileSettingsError}</p>}
                  {(profilePatchStatus === 'loading' || settingsPatchStatus === 'loading') && (
                    <p className="text-xs text-cyan-200">{t('settings.saving')}</p>
                  )}
                </div>
              )}

              {(item?.type === 'slider' || item?.type === 'range') && (
                <div className="space-y-8 py-4">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-secondary">{t('settings.currentValue')}</span>
                    <span className="text-2xl font-black text-pink-500">
                      {item.type === 'range' ? `${ageMinDraft} - ${ageMaxDraft}` : `${distanceDraft} ${item.unit ?? ''}`}
                    </span>
                  </div>
                  {item.type === 'slider' ? (
                    <div className="space-y-4">
                      <input
                        type="range"
                        min={item.min ?? 2}
                        max={item.max ?? 160}
                        value={distanceDraft}
                        onChange={(event) => setDistanceDraft(Number(event.target.value))}
                        onMouseUp={persistDistance}
                        onTouchEnd={persistDistance}
                        className="w-full accent-pink-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-white/70">
                          <span>{t('settings.items.age')} min</span>
                          <span className="font-black text-pink-300">{ageMinDraft}</span>
                        </div>
                        <input
                          type="range"
                          min={item.min ?? 18}
                          max={Math.max((item.max ?? 100) - 1, ageMaxDraft - 1)}
                          value={ageMinDraft}
                          onChange={(event) =>
                            setAgeMinDraft(Math.min(Number(event.target.value), ageMaxDraft - 1))
                          }
                          onMouseUp={persistAgeRange}
                          onTouchEnd={persistAgeRange}
                          className="w-full accent-pink-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-white/70">
                          <span>{t('settings.items.age')} max</span>
                          <span className="font-black text-sky-300">{ageMaxDraft}</span>
                        </div>
                        <input
                          type="range"
                          min={Math.min(ageMinDraft + 1, item.max ?? 100)}
                          max={item.max ?? 100}
                          value={ageMaxDraft}
                          onChange={(event) =>
                            setAgeMaxDraft(Math.max(Number(event.target.value), ageMinDraft + 1))
                          }
                          onMouseUp={persistAgeRange}
                          onTouchEnd={persistAgeRange}
                          className="w-full accent-sky-400"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] font-black text-white/20 uppercase tracking-widest">
                    <span>
                      {item.min} {item.unit ?? ''}
                    </span>
                    <span>
                      {item.max} {item.unit ?? ''}
                    </span>
                  </div>
                </div>
              )}

              {item?.type === 'select' && (
                item.id === 'travel-pass-city' && !travelPassServerAccess?.canChangeServer ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
                      <p className="text-sm font-black text-amber-100">{t('settings.travelPass.lockedTitle')}</p>
                      <p className="mt-2 text-xs text-white/75">{t('settings.travelPass.lockedBody')}</p>
                      {!TRAVEL_PASS_ENABLED && (
                        <p className="mt-3 text-xs text-white/60">
                          {t('settings.travelPass.lockedCity', {
                            city:
                              TRAVEL_PASS_LOCKED_CITY === 'voronezh'
                                ? t('settings.cities.voronezh')
                                : t('settings.cities.moscow'),
                          })}
                        </p>
                      )}
                    </div>
                    {TRAVEL_PASS_ENABLED && (
                      <GlassButton
                        onClick={() => navigate('/boost')}
                        className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.16em]"
                      >
                        {t('settings.travelPass.unlockCta')}
                      </GlassButton>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {item.id === 'travel-pass-city' && (
                      <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/80 font-black">
                          {t('settings.travelPass.currentAccess')}
                        </p>
                        <p className="mt-1 text-sm font-bold text-cyan-50">{travelPassSourceLabel}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      {item.options?.map((optionKey) => (
                        <button
                          key={optionKey}
                          onClick={() => handleSelectOption(item.id, optionKey)}
                          className={`p-5 rounded-2xl border text-sm font-bold transition-all flex items-center justify-between ${
                            optionKey === item.selectedOption ? 'bg-pink-500/10 border-pink-500/50 text-white' : 'bg-white/5 border-white/10 text-secondary hover:border-white/20'
                          }`}
                        >
                          {t(optionKey)}
                          {optionKey === item.selectedOption && <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}

              {item?.type === 'list' && (
                <div className="space-y-4">
                  {blockedUsers.length === 0 ? (
                    <>
                      <p className="text-xs text-secondary italic">{t('settings.emptyList')}</p>
                      <GlassButton className="w-full py-4 rounded-2xl text-xs font-bold opacity-50 cursor-not-allowed">{t('settings.addItem')}</GlassButton>
                    </>
                  ) : (
                    <div className="space-y-3">
                      {blockedUsers.map((entry) => (
                        <div
                          key={entry.blockedUserId}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div>
                            <p className="text-sm font-bold text-white">{entry.blockedUserId}</p>
                            <p className="text-[10px] text-white/50 uppercase tracking-[0.16em]">
                              {new Date(entry.createdAtIso).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              void appApi.unblockUser(entry.blockedUserId).then(() => {
                                setBlockedUsers((prev) =>
                                  prev.filter((item) => item.blockedUserId !== entry.blockedUserId),
                                );
                              });
                            }}
                            className="h-9 rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100"
                          >
                            {t('chat.unblock')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${isEmbedded ? 'p-8' : 'p-6'} space-y-8`}>
        {isEmbedded && <h2 className="text-2xl font-black italic uppercase tracking-tight">{t('settings.detailTitle', { section: getSectionTitle(section) })}</h2>}
        <div className="rounded-[32px] overflow-hidden border border-[var(--menu-premium-border)] bg-[rgba(18,22,30,0.78)] backdrop-blur-xl">
          {section.items.map((item, i, arr) => (
            <button
              key={item.id}
              onClick={() => navigate(`${section.path}/${item.id}`)}
              className={`w-full p-6 flex items-center justify-between hover:bg-white/7 transition-colors ${i !== arr.length - 1 ? 'border-b border-white/8' : ''}`}
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-bold text-white">{t(item.labelKey)}</span>
                {item.descKey && <span className="text-[10px] text-secondary font-medium mt-1">{t(item.descKey)}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-pink-500">{t('settings.manage')}</span>
                <ICONS.ChevronLeft className="rotate-180 text-white/20" size={16} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (isLarge) {
    return (
      <div className="h-full flex overflow-hidden">
        <div className="w-[320px] border-r border-[var(--menu-premium-border)] bg-[rgba(16,19,25,0.92)] flex flex-col p-8 shrink-0">
          <div className="flex items-center gap-4 mb-10">
            <button onClick={() => navigate('/profile')} className="p-2 hover-effect rounded-full glass">
              <ICONS.ChevronLeft />
            </button>
            <h2 className="text-2xl font-black italic uppercase tracking-tight">{t('settings.title')}</h2>
          </div>

          <div className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => navigate(section.path)}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                  category === section.id || (!category && section.id === 'account')
                    ? 'bg-gradient-to-r from-pink-500/18 to-blue-500/14 border border-pink-400/35 text-white shadow-[0_0_18px_rgba(236,72,153,0.2)]'
                    : 'text-secondary glass-panel-soft hover:text-white'
                }`}
              >
                <div className={`p-2 rounded-xl ${category === section.id || (!category && section.id === 'account') ? 'bg-pink-500/20 text-pink-500' : 'bg-white/5'}`}>{section.icon}</div>
                <span className="text-sm font-bold">{getSectionTitle(section)}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-8">
            <button
              onClick={handleSignOut}
              className="w-full p-4 glass rounded-2xl text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
            >
              <ICONS.LogOut size={18} />
              {t('settings.signOut')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar bg-[rgba(24,28,36,0.45)] premium-blur-overlay">{renderDetail()}</div>
      </div>
    );
  }

  if (category) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="h-full flex flex-col overflow-y-auto no-scrollbar"
        style={isTouch && isKeyboardOpen ? { paddingBottom: `${keyboardInset}px` } : undefined}
      >
        <div className="p-6 flex items-center gap-4 border-b border-white/5">
          <button onClick={() => navigate('/settings')} className="p-2 hover-effect rounded-full glass">
            <ICONS.ChevronLeft />
          </button>
          <h2 className="text-xl font-black italic uppercase tracking-tight">{getSectionTitle(getSection())}</h2>
        </div>
        <div className="flex-1 pb-28">{renderDetail()}</div>
      </motion.div>
    );
  }

  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full flex flex-col p-6 pb-28 overflow-y-auto no-scrollbar"
        style={isTouch && isKeyboardOpen ? { paddingBottom: `calc(7rem + ${keyboardInset}px)` } : undefined}
      >
        <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/profile')} className="p-2 hover-effect rounded-full glass">
            <ICONS.ChevronLeft />
          </button>
          <h2 className="text-2xl font-black italic uppercase tracking-tight">{t('settings.title')}</h2>
        </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {sections.map((section) => {
            const isActive = section.id === activeSection.id;
            return (
              <button
                key={`settings-chip-${section.id}`}
                onClick={() => navigate(section.path)}
                className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] border transition-colors ${
                  isActive
                    ? 'text-white border-pink-400/45 bg-gradient-to-r from-pink-500/20 to-blue-500/20'
                    : 'text-secondary border-white/10 glass-panel-soft'
                }`}
              >
                {getSectionTitle(section)}
              </button>
            );
          })}
        </div>

        <div className="space-y-8">

        {sections.map((section) => (
          <div key={section.id} className="space-y-4">
              <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] px-2">{getSectionTitle(section)}</h3>
              <div className="rounded-[32px] overflow-hidden border border-[var(--menu-premium-border)] bg-[rgba(18,22,30,0.82)] backdrop-blur-xl">
              {section.items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`${section.path}/${item.id}`)}
                  className={`w-full p-5 text-left flex items-center justify-between hover:bg-white/7 active:bg-white/10 transition-colors ${i !== section.items.length - 1 ? 'border-b border-white/8' : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-white/45">{section.icon}</span>
                    <span className="text-sm font-medium">{t(item.labelKey)}</span>
                  </span>
                  <ICONS.ChevronLeft className="rotate-180 text-white/20" size={16} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={handleSignOut} className="w-full p-5 glass rounded-[24px] text-red-500 font-black text-xs uppercase tracking-widest">
          {t('settings.signOut')}
        </button>
      </div>
    </motion.div>
  );
};

export default AccountSettingsScreen;
