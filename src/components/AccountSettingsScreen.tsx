import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useI18n } from '../i18n/I18nProvider';
import { ReactNode, useEffect, useState } from 'react';
import { appApi } from '../services';
import type { SettingsEnvelope } from '../contracts';

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

const AccountSettingsScreen = () => {
  const navigate = useNavigate();
  const { category, sub } = useParams();
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const { t, locale, setLocale } = useI18n();
  const isLarge = isDesktop || isTablet;
  const [settingsEnvelope, setSettingsEnvelope] = useState<SettingsEnvelope | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSettings(true);
    setSettingsError(false);
    appApi
      .getSettings()
      .then((payload) => {
        if (isCancelled) return;
        setSettingsEnvelope(payload);
        setLocale(payload.settings.preferences.language);
      })
      .catch(() => {
        if (isCancelled) return;
        setSettingsError(true);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingSettings(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const settings = settingsEnvelope?.settings;
  const travelPassServerAccess = settingsEnvelope?.travelPassServerAccess;

  const patchSettings = (patch: Parameters<typeof appApi.patchSettings>[0]['patch']) => {
    void appApi.patchSettings({ patch }).then((payload) => {
      setSettingsEnvelope(payload);
      if (patch.preferences?.language) {
        setLocale(patch.preferences.language);
      }
    });
  };

  const selectedGenderOption =
    settings?.preferences.genderPreference === 'men'
      ? 'settings.items.men'
      : settings?.preferences.genderPreference === 'women'
        ? 'settings.items.women'
        : 'settings.items.everyone';

  const selectedLanguageOption = `locale.${settings?.preferences.language ?? locale}`;

  const selectedTravelCityOption =
    settings?.preferences.travelPassCity === 'voronezh'
      ? 'settings.cities.voronezh'
      : settings?.preferences.travelPassCity === 'saint-petersburg'
        ? 'settings.cities.saintPetersburg'
        : settings?.preferences.travelPassCity === 'sochi'
          ? 'settings.cities.sochi'
          : 'settings.cities.moscow';

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
        { labelKey: 'settings.items.visibility', id: 'visibility', type: 'toggle', descKey: 'settings.items.visibilityDesc' },
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
        { labelKey: 'settings.items.matches', id: 'matches', type: 'toggle' },
        { labelKey: 'settings.items.messages', id: 'messages', type: 'toggle' },
        { labelKey: 'settings.items.likes', id: 'likes', type: 'toggle' },
        { labelKey: 'settings.items.offers', id: 'offers', type: 'toggle' },
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
  const currentDistanceValue = settings?.preferences.distanceKm ?? 25;
  const currentAgeRangeValue = `${settings?.preferences.ageMin ?? 22} - ${settings?.preferences.ageMax ?? 35}`;
  const travelPassSourceLabel = travelPassServerAccess
    ? t(`settings.travelPass.sources.${travelPassServerAccess.source}`)
    : t('settings.travelPass.sources.none');

  const isToggleEnabled = (id: string) => {
    switch (id) {
      case 'visibility':
        return (settings?.privacy.visibility ?? 'public') === 'public';
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
      case 'matches':
        return settings?.notifications.matches ?? true;
      case 'messages':
        return settings?.notifications.messages ?? true;
      case 'likes':
        return settings?.notifications.likes ?? true;
      case 'offers':
        return settings?.notifications.offers ?? true;
      default:
        return false;
    }
  };

  const toggleSetting = (id: string) => {
    switch (id) {
      case 'visibility':
        patchSettings({
          privacy: {
            visibility: (settings?.privacy.visibility ?? 'public') === 'public' ? 'limited' : 'public',
          },
        });
        break;
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
      case 'matches':
      case 'messages':
      case 'likes':
      case 'offers': {
        const nextNotifications = {
          matches: settings?.notifications.matches ?? true,
          messages: settings?.notifications.messages ?? true,
          likes: settings?.notifications.likes ?? true,
          offers: settings?.notifications.offers ?? true,
          [id]: !isToggleEnabled(id),
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
      patchSettings({
        preferences: { language: nextLocale },
        translation: { targetLocale: nextLocale },
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
      patchSettings({
        preferences: { genderPreference: nextGender },
      });
      return;
    }

    if (itemId === 'travel-pass-city') {
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

    if (isLoadingSettings) {
      return (
        <div className="p-6 md:p-8">
          <div className="glass rounded-[28px] border border-white/10 p-6 md:p-8 text-center space-y-4">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/20 border-t-white/75 animate-spin" />
            <p className="text-sm text-secondary">{t('settings.loading')}</p>
          </div>
        </div>
      );
    }

    if (settingsError) {
      return (
        <div className="p-6 md:p-8">
          <div className="glass rounded-[28px] border border-red-400/30 bg-red-500/5 p-6 md:p-8 text-center space-y-4">
            <ICONS.Info size={20} className="mx-auto text-red-200" />
            <p className="text-sm text-white">{t('settings.error')}</p>
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
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-1">{t('settings.newField', { label: itemLabel })}</label>
                    <input
                      type={item.type}
                      placeholder={t('settings.enterField', { label: itemLabel })}
                      className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:border-pink-500 focus:bg-white/10 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                  <GlassButton className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em]">{t('settings.save')}</GlassButton>
                </div>
              )}

              {(item?.type === 'slider' || item?.type === 'range') && (
                <div className="space-y-8 py-4">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-secondary">{t('settings.currentValue')}</span>
                    <span className="text-2xl font-black text-pink-500">
                      {item.type === 'range' ? currentAgeRangeValue : `${currentDistanceValue} ${item.unit ?? ''}`}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full relative">
                    <div className="absolute left-1/4 top-0 h-full w-1/2 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full" />
                    <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl border-4 border-black cursor-pointer" />
                    {item.type === 'range' && <div className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl border-4 border-black cursor-pointer" />}
                  </div>
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
                    </div>
                    <GlassButton
                      onClick={() => navigate('/boost')}
                      className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.16em]"
                    >
                      {t('settings.travelPass.unlockCta')}
                    </GlassButton>
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
                  <p className="text-xs text-secondary italic">{t('settings.emptyList')}</p>
                  <GlassButton className="w-full py-4 rounded-2xl text-xs font-bold opacity-50 cursor-not-allowed">{t('settings.addItem')}</GlassButton>
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
              onClick={() => navigate('/')}
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
        <GlassButton className="py-2 px-4 rounded-full text-xs">{t('settings.save')}</GlassButton>
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

        <button onClick={() => navigate('/')} className="w-full p-5 glass rounded-[24px] text-red-500 font-black text-xs uppercase tracking-widest">
          {t('settings.signOut')}
        </button>
      </div>
    </motion.div>
  );
};

export default AccountSettingsScreen;
