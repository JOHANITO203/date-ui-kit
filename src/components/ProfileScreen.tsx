import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import { motion } from 'motion/react';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';
import { appApi, authApi, getTrackedEvents } from '../services';
import { useRuntimeSelector } from '../state';
import { resolveTravelPassServerAccess } from '../domain/travelPass';
import { resolveShadowGhostAccess } from '../domain/shadowGhost';
import { useAuth } from '../auth/AuthProvider';
import { getOnboardingProfileSnapshot, hydrateProfileSeed } from '../domain/profileHydration';
import { computeVisibilityScore } from '../domain/visibilityScore';

const calculateAge = (birthDateIso: string | null | undefined) => {
  if (!birthDateIso) return undefined;
  const birthDate = new Date(birthDateIso);
  if (Number.isNaN(birthDate.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 18 ? age : undefined;
};

const CITY_COORDINATES: Record<'moscow' | 'voronezh' | 'saint-petersburg' | 'sochi', { lat: number; lng: number }> = {
  moscow: { lat: 55.7558, lng: 37.6173 },
  voronezh: { lat: 51.6608, lng: 39.2003 },
  'saint-petersburg': { lat: 59.9311, lng: 30.3609 },
  sochi: { lat: 43.5855, lng: 39.7231 },
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusKm * c;
};

const normalizeCityLabel = (value: string, t: (key: string) => string) => {
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (normalized === 'voronezh') return t('settings.cities.voronezh');
  if (normalized === 'moscow') return t('settings.cities.moscow');
  if (normalized === 'saint-petersburg') return t('settings.cities.saintPetersburg');
  if (normalized === 'sochi') return t('settings.cities.sochi');
  return value;
};

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { isDesktop, isTouch } = useDevice();
  const { t } = useI18n();
  const { user } = useAuth();
  const isLarge = isDesktop;
  const showDesktopRail = isDesktop && !isTouch;
  const previewPlan = useRuntimeSelector((payload) => payload.planTier);
  const boostActiveUntilIso = useRuntimeSelector((payload) => payload.boost.activeUntilIso);
  const balances = useRuntimeSelector((payload) => ({
    superlikes: payload.balances.superlikesLeft,
    boosts: payload.balances.boostsLeft,
    rewinds: payload.balances.rewindsLeft,
  }));
  const settings = useRuntimeSelector((payload) => payload.settings);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [verifiedIdentity, setVerifiedIdentity] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAge, setProfileAge] = useState<number | undefined>(undefined);
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotosCount, setProfilePhotosCount] = useState(0);
  const [profileViewsCount, setProfileViewsCount] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const shadowGhostAccess = resolveShadowGhostAccess({
    planTier: previewPlan,
    entitlementSource: settings.preferences.shadowGhostEntitlementSource,
    entitlementExpiresAtIso: settings.preferences.shadowGhostEntitlementExpiresAtIso,
  });
  const shadowGhostLocked = !shadowGhostAccess.canUse;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [profileScrollProgress, setProfileScrollProgress] = useState(0);
  const [profileScrollThumb, setProfileScrollThumb] = useState(28);
  const planTitle = t(`settings.plan.${previewPlan}`);
  const planBadgeLabel =
    previewPlan === 'elite'
      ? t('badges.premiumPlus')
      : previewPlan === 'platinum'
        ? t('badges.platinum')
        : previewPlan === 'free'
          ? t('settings.plan.free')
          : t('badges.premium');
  const planToneClass =
    previewPlan === 'elite'
      ? 'border-fuchsia-300/32 bg-[radial-gradient(circle_at_88%_0%,rgba(217,70,239,0.24)_0%,transparent_58%),linear-gradient(160deg,rgba(15,10,18,0.96),rgba(10,8,14,0.92))] shadow-[0_0_34px_rgba(217,70,239,0.28)]'
      : previewPlan === 'platinum'
        ? 'border-cyan-300/32 bg-[radial-gradient(circle_at_88%_0%,rgba(56,189,248,0.22)_0%,transparent_58%),linear-gradient(160deg,rgba(10,14,18,0.96),rgba(7,10,14,0.92))] shadow-[0_0_34px_rgba(34,211,238,0.24)]'
        : previewPlan === 'free'
          ? 'border-slate-300/28 bg-[radial-gradient(circle_at_88%_0%,rgba(148,163,184,0.16)_0%,transparent_58%),linear-gradient(160deg,rgba(14,14,18,0.96),rgba(9,10,14,0.92))] shadow-[0_0_24px_rgba(148,163,184,0.15)]'
          : 'border-amber-300/34 bg-[radial-gradient(circle_at_88%_0%,rgba(245,158,11,0.2)_0%,transparent_58%),linear-gradient(160deg,rgba(10,10,14,0.96),rgba(7,7,10,0.92))] shadow-[0_0_34px_rgba(245,158,11,0.24)]';
  const planPillClass =
    previewPlan === 'elite'
      ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white'
      : previewPlan === 'platinum'
        ? 'border border-cyan-300/40 bg-cyan-500/16 text-cyan-100'
        : previewPlan === 'free'
          ? 'border border-slate-300/35 bg-slate-500/12 text-slate-100'
          : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black';
  const planIconClass =
    previewPlan === 'elite'
      ? 'border-fuchsia-300/24 text-fuchsia-300 shadow-[0_0_14px_rgba(217,70,239,0.26)]'
      : previewPlan === 'platinum'
        ? 'border-cyan-300/24 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.24)]'
        : previewPlan === 'free'
          ? 'border-slate-300/24 text-slate-300'
          : 'border-amber-300/20 text-amber-400';
  const planSubtitle = previewPlan === 'free' ? t('profile.premiumSubtitle') : t('profile.planGoldSubtitle');
  const hideAge = settings.privacy.hideAge;
  const hideDistance = settings.privacy.hideDistance;
  const travelPassServerAccess = resolveTravelPassServerAccess({
    planTier: previewPlan,
    entitlementSource: settings.preferences.travelPassEntitlementSource,
    entitlementExpiresAtIso: settings.preferences.travelPassEntitlementExpiresAtIso,
  });
  const travelPassCityLabel =
    settings.preferences.travelPassCity === 'voronezh'
      ? t('settings.cities.voronezh')
      : settings.preferences.travelPassCity === 'saint-petersburg'
        ? t('settings.cities.saintPetersburg')
        : settings.preferences.travelPassCity === 'sochi'
          ? t('settings.cities.sochi')
          : settings.preferences.travelPassCity === 'moscow'
            ? t('settings.cities.moscow')
            : null;
  const onboardingLaunchCityLabel = useMemo(() => {
    const snapshot = getOnboardingProfileSnapshot();
    const launchCity = snapshot?.city?.trim();
    return launchCity ? normalizeCityLabel(launchCity, t) : null;
  }, [t, user?.id]);
  const currentServerCityLabel =
    (travelPassServerAccess.canChangeServer ? travelPassCityLabel : null) ??
    profileCity ??
    onboardingLaunchCityLabel ??
    t('settings.cities.moscow');
  const travelPassSourceLabel = t(`settings.travelPass.sources.${travelPassServerAccess.source}`);
  const boostActive = useMemo(() => {
    if (!boostActiveUntilIso) return false;
    const activeUntilMs = new Date(boostActiveUntilIso).getTime();
    return Number.isFinite(activeUntilMs) && activeUntilMs > Date.now();
  }, [boostActiveUntilIso]);
  const visibilityScore = useMemo(
    () =>
      computeVisibilityScore({
        photosCount: profilePhotosCount,
        hasFirstName: profileName.trim().length > 0,
        hasCity: Boolean(profileCity?.trim()),
        hasBio: profileBio.trim().length > 0,
        verifiedIdentity,
        planTier: previewPlan,
        boostActive,
        boostTokens: balances.boosts,
        superlikesTokens: balances.superlikes,
        rewindTokens: balances.rewinds,
        travelPassSource: travelPassServerAccess.source,
        shadowGhostActive: !shadowGhostLocked && settings.privacy.shadowGhost,
      }),
    [
      balances.boosts,
      balances.rewinds,
      balances.superlikes,
      boostActive,
      previewPlan,
      profileBio,
      profileCity,
      profileName,
      profilePhotosCount,
      settings.privacy.shadowGhost,
      shadowGhostLocked,
      travelPassServerAccess.source,
      verifiedIdentity,
    ],
  );
  const openServerSettings = () => {
    if (travelPassServerAccess.canChangeServer) {
      navigate('/settings/privacy/travel-pass-city');
      return;
    }
    navigate('/boost');
  };

  useEffect(() => {
    let isCancelled = false;

    const fallbackNameFromSession = (() => {
      const profile = user?.profile as Record<string, unknown> | null | undefined;
      if (!profile || typeof profile !== 'object') return '';
      const directName = [profile.first_name, profile.given_name, profile.name].find(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      );
      if (directName) return directName.trim();
      if (typeof user?.email === 'string' && user.email.includes('@')) {
        return user.email.split('@')[0]?.trim() ?? '';
      }
      return '';
    })();

    const optimisticSeed = hydrateProfileSeed(
      null,
      user?.profile as Record<string, unknown> | null | undefined,
    );
    const optimisticName = optimisticSeed.firstName || fallbackNameFromSession || 'User';
    if (optimisticName) setProfileName(optimisticName);
    if (optimisticSeed.bio) setProfileBio(optimisticSeed.bio);
    const optimisticAge = calculateAge(optimisticSeed.birthDate);
    if (optimisticAge) setProfileAge(optimisticAge);
    if (optimisticSeed.city) {
      setProfileCity(normalizeCityLabel(optimisticSeed.city, t));
    }
    if (optimisticSeed.verifiedOptIn) {
      setVerifiedIdentity(true);
    }

    const hydrateProfileState = async () => {
      try {
        const photosPromise = authApi.getProfilePhotos().then((photosPayload) => {
          if (isCancelled || !photosPayload.ok) return;
          const photos = photosPayload.data?.photos ?? [];
          const firstPhotoUrl = photos.find((photo) => Boolean(photo.url))?.url ?? null;
          setProfilePhotosCount(photos.length);
          setProfilePhotoUrl(firstPhotoUrl);
        });

        const [profileResult, conversationsResult, likesResult] = await Promise.allSettled([
          authApi.getProfileMe(),
          appApi.getConversations(),
          appApi.getLikes(),
        ]);

        if (isCancelled) return;

        const trackedEvents = getTrackedEvents();
        const ownDiscoverViews = trackedEvents.filter((event) => event.name === 'profile_impression').length;
        const fallbackMatches = trackedEvents.filter((event) => event.name === 'match_created').length;
        const matches =
          conversationsResult.status === 'fulfilled'
            ? conversationsResult.value.items.filter((item) => item.relationState === 'active').length
            : fallbackMatches;
        const viewedByOthers =
          likesResult.status === 'fulfilled'
            ? likesResult.value.inventory.visibleLikes.length + likesResult.value.inventory.hiddenCount
            : 0;
        const computedViews = Math.round((ownDiscoverViews + viewedByOthers) * 1.35);

        setProfileViewsCount(computedViews);
        setMatchesCount(matches);

        if (profileResult.status === 'fulfilled' && profileResult.value.ok && profileResult.value.data?.profile) {
          const profile = profileResult.value.data.profile;
          const seed = hydrateProfileSeed(profile, user?.profile as Record<string, unknown> | null | undefined);
          setVerifiedIdentity(seed.verifiedOptIn);
          setProfileName(seed.firstName || fallbackNameFromSession || 'User');
          setProfileBio(seed.bio);
          setProfileAge(calculateAge(seed.birthDate));
          const persistedCity = seed.city;
          if (persistedCity) {
            setProfileCity(normalizeCityLabel(persistedCity, t));
          } else if (travelPassServerAccess.canChangeServer && travelPassCityLabel) {
            const cityId = settings.preferences.travelPassCity;
            const cityLabel =
              cityId === 'voronezh'
                ? t('settings.cities.voronezh')
                : cityId === 'saint-petersburg'
                  ? t('settings.cities.saintPetersburg')
                  : cityId === 'sochi'
                    ? t('settings.cities.sochi')
                  : cityId === 'moscow'
                      ? t('settings.cities.moscow')
                      : null;
            setProfileCity(cityLabel);
          } else if (onboardingLaunchCityLabel) {
            setProfileCity(onboardingLaunchCityLabel);
          } else if (settings.privacy.preciseLocation && typeof window !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const point = { lat: position.coords.latitude, lng: position.coords.longitude };
                const nearest = (Object.entries(CITY_COORDINATES) as Array<
                  ['moscow' | 'voronezh' | 'saint-petersburg' | 'sochi', { lat: number; lng: number }]
                >).sort((a, b) => haversineKm(point, a[1]) - haversineKm(point, b[1]))[0]?.[0];
                const cityLabel =
                  nearest === 'voronezh'
                    ? t('settings.cities.voronezh')
                    : nearest === 'saint-petersburg'
                      ? t('settings.cities.saintPetersburg')
                      : nearest === 'sochi'
                        ? t('settings.cities.sochi')
                        : t('settings.cities.moscow');
                setProfileCity(cityLabel);
              },
              () => {
                setProfileCity(onboardingLaunchCityLabel ?? t('settings.cities.moscow'));
              },
              { enableHighAccuracy: true, timeout: 3000, maximumAge: 10 * 60 * 1000 },
            );
          } else {
            setProfileCity(onboardingLaunchCityLabel ?? t('settings.cities.moscow'));
          }
        } else {
          setProfileName(fallbackNameFromSession || 'User');
        }

        await photosPromise;
      } catch {
        if (!isCancelled) {
          setProfileName((prev) => prev || fallbackNameFromSession || 'User');
          setProfileCity((prev) => prev || onboardingLaunchCityLabel || t('settings.cities.moscow'));
        }
      }
    };

    void hydrateProfileState();

    return () => {
      isCancelled = true;
    };
  }, [
    onboardingLaunchCityLabel,
    settings.preferences.travelPassCity,
    settings.privacy.preciseLocation,
    t,
    travelPassCityLabel,
    travelPassServerAccess.canChangeServer,
    user?.email,
    user?.id,
    user?.profile,
  ]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!showDesktopRail || !node) return;

    const updateScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      const progress = max <= 0 ? 0 : node.scrollTop / max;
      const size = node.scrollHeight <= 0 ? 100 : (node.clientHeight / node.scrollHeight) * 100;
      setProfileScrollProgress(Math.min(1, Math.max(0, progress)));
      setProfileScrollThumb(Math.max(20, Math.min(100, size)));
    };

    updateScroll();
    node.addEventListener('scroll', updateScroll);
    window.addEventListener('resize', updateScroll);

    return () => {
      node.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [showDesktopRail]);

  const jumpToSection = (index: number) => {
    const node = sectionRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={scrollRef} className={`relative group/profile h-full flex flex-col ${isLarge ? 'py-10 pr-8' : 'py-6 pb-nav'} overflow-y-auto no-scrollbar bg-black`}>
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8 md:mb-10 px-[var(--page-x)]">
        <div>
          <h2 className="text-4xl font-black tracking-tighter mb-1">{t('profile.title')}</h2>
          <p className="text-secondary text-xs uppercase tracking-[0.3em] font-bold">{t('profile.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {isDesktop && (
            <button
              onClick={openServerSettings}
              className="hidden xl:flex items-center gap-2 mr-6 px-4 py-2 glass rounded-full border border-white/5 hover:border-cyan-300/35 transition-colors"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-secondary uppercase tracking-widest font-black">
                {t('profile.serverCity', { city: currentServerCityLabel })}
              </span>
              <span className="text-[9px] text-cyan-100/75 uppercase tracking-[0.14em] font-black">
                {travelPassSourceLabel}
              </span>
              {!travelPassServerAccess.canChangeServer && <ICONS.Lock size={12} className="text-amber-300" />}
            </button>
          )}
          <button 
            onClick={() => navigate('/settings')} 
            className="w-12 h-12 glass rounded-full flex items-center justify-center hover-effect transition-all"
          >
            <ICONS.Settings size={22} className="text-white" />
          </button>
        </div>
      </div>

      <div className={`${isLarge ? 'container-dashboard screen-template-dashboard density-comfortable' : ''}`}>
      <div className={`grid px-[var(--page-x)] ${isLarge ? 'grid-cols-12 gap-[var(--grid-gap)] density-comfortable' : 'grid-cols-1 gap-[var(--section-gap)]'}`}>
        {/* Left Column: Identity & Status */}
        <div className={`${isLarge ? 'col-span-5' : ''} space-y-10`}>
          <div
            ref={(el) => {
              sectionRefs.current[0] = el;
            }}
            className="relative group"
          >
            <motion.div 
              whileHover={!isTouch ? { scale: 1.02 } : {}}
              className="relative z-10"
            >
              <div className="aspect-square rounded-[var(--card-radius)] overflow-hidden border border-white/10 shadow-2xl">
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                    alt="Me"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-fuchsia-700/35 via-zinc-900 to-sky-700/30 flex items-center justify-center">
                    <ICONS.Profile size={56} className="text-white/70" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                  <div>
                    <div className="mb-1">
                      <NameWithBadge
                        name={profileName}
                        age={profileAge}
                        ageMasked={hideAge}
                        verified={verifiedIdentity}
                        premiumTier={previewPlan}
                        size="xl"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-widest">
                      <ICONS.MapPin size={12} className="text-pink-500" /> {profileCity || t('settings.cities.moscow')}
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/profile/edit')}
                    className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                  >
                    <ICONS.Edit size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
            {/* Decorative background element */}
            <div className="absolute -inset-4 bg-pink-500/5 blur-3xl rounded-full -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </div>

          {/* Current Plan Card (Gold Theme) */}
          <div
            ref={(el) => {
              sectionRefs.current[1] = el;
            }}
            className={`relative overflow-hidden product-card-base cursor-pointer ${planToneClass}`}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.16em] ${planPillClass}`}>
                  {planBadgeLabel}
                </span>
                <div className={`ml-auto w-10 h-10 rounded-2xl glass-panel-soft flex items-center justify-center ${planIconClass}`}>
                  <ICONS.Star size={16} />
                </div>
              </div>
              <h4 className="font-black italic tracking-tighter text-[clamp(2rem,3vw,2.6rem)] leading-[0.92] text-white mb-2">{planTitle}</h4>
              <p className="text-secondary text-sm leading-relaxed mb-5">{planSubtitle}</p>

              <div className="grid grid-cols-3 gap-2 mb-5">
                {([
                  { id: 'superlikes', label: t('settings.tokens.superlikes'), value: balances.superlikes, glow: 'rgb(var(--glow-pink) / 0.18)' },
                  { id: 'boosts', label: t('settings.tokens.boosts'), value: balances.boosts, glow: 'rgb(var(--glow-gold) / 0.18)' },
                  { id: 'rewinds', label: t('settings.tokens.rewinds'), value: balances.rewinds, glow: 'rgb(var(--glow-blue) / 0.18)' },
                ] as const).map((item) => (
                  <div key={item.id} className="rounded-xl glass-panel-soft p-2 text-center" style={{ boxShadow: `0 0 16px ${item.glow}` }}>
                    <motion.div
                      key={`${item.id}-${item.value}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-lg font-black leading-none"
                    >
                      {item.value}
                    </motion.div>
                    <div className="text-[9px] uppercase tracking-widest text-secondary font-bold mt-1 line-clamp-1">{item.label}</div>
                  </div>
                ))}
              </div>

              <GlassButton
                onClick={() => navigate('/boost')}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black border-0"
              >
                {t('settings.plan.manage')}
              </GlassButton>
            </div>
          </div>
        </div>

        {/* Right Column: Performance & Insights */}
        <div className={`${isLarge ? 'col-span-7' : ''} space-y-6 md:space-y-8`}>
          {/* Stats Bento Grid */}
          <div
            ref={(el) => {
              sectionRefs.current[2] = el;
            }}
            className={`grid gap-[var(--grid-gap)] ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <div
              className="p-8 rounded-[var(--card-radius)] glass-panel glass-panel-float space-y-4 group hover:border-blue-400/35 transition-colors"
              style={{ boxShadow: '0 0 18px rgb(var(--glow-blue) / 0.16)' }}
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-blue-500/12 text-blue-300 group-hover:scale-110 transition-transform">
                  <ICONS.Eye size={24} />
                </div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">+35%</span>
              </div>
              <div>
                <span className="text-4xl font-black tracking-tighter block">{profileViewsCount.toLocaleString()}</span>
                <span className="text-[10px] text-secondary uppercase tracking-[0.2em] font-bold">{t('profile.profileViews')}</span>
              </div>
            </div>
            
            <div
              className="p-8 rounded-[var(--card-radius)] glass-panel glass-panel-float space-y-4 group hover:border-pink-400/35 transition-colors"
              style={{ boxShadow: '0 0 18px rgb(var(--glow-pink) / 0.16)' }}
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-pink-500/12 text-pink-300 group-hover:scale-110 transition-transform">
                  <ICONS.Heart size={24} />
                </div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Exact</span>
              </div>
              <div>
                <span className="text-4xl font-black tracking-tighter block">{matchesCount.toLocaleString()}</span>
                <span className="text-[10px] text-secondary uppercase tracking-[0.2em] font-bold">{t('profile.newMatches')}</span>
              </div>
            </div>
          </div>

          {/* Profile Completion */}
          <div
            ref={(el) => {
              sectionRefs.current[3] = el;
            }}
            className="p-6 md:p-8 rounded-[var(--card-radius)] glass-panel glass-panel-float hover:border-violet-400/30 space-y-8 relative overflow-hidden transition-colors"
            style={{ boxShadow: '0 0 18px rgb(var(--glow-silver) / 0.14)' }}
          >
            <div className="flex justify-between items-end relative z-10">
              <div className="space-y-2">
                <h4 className="text-2xl font-bold">{t('profile.visibilityTitle')}</h4>
                <p className="text-secondary text-sm">{t('profile.visibilitySubtitle')}</p>
              </div>
              <div className="text-right">
                <span className="text-5xl font-black tracking-tighter text-pink-500">{visibilityScore}%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative z-10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${visibilityScore}%` }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.3)]" 
              />
            </div>
            <div className="flex gap-4 relative z-10">
              <button
                onClick={() => navigate('/profile/edit')}
                className="flex-1 py-4 rounded-2xl glass-panel-soft text-[10px] font-black uppercase tracking-widest hover:border-pink-400/35 hover:shadow-[0_0_16px_rgba(236,72,153,0.25)] transition-all"
              >
                {t('profile.improve')}
              </button>
              <button
                onClick={() => navigate('/discover')}
                className="flex-1 py-4 rounded-2xl glass-panel-soft text-[10px] font-black uppercase tracking-widest hover:border-blue-400/35 hover:shadow-[0_0_16px_rgba(59,130,246,0.25)] transition-all"
              >
                {t('profile.preview')}
              </button>
            </div>
          </div>

          {/* Special Access Panel */}
          <div className="p-6 md:p-8 rounded-[var(--card-radius)] glass-panel glass-panel-float hover:border-cyan-400/30 space-y-6 transition-colors" style={{ boxShadow: '0 0 16px rgb(var(--glow-blue) / 0.1)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-black italic uppercase tracking-tight">{t('profile.controlTitle')}</h4>
              </div>
            </div>

            <div className={`grid gap-4 ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="rounded-2xl glass-panel-soft p-4 space-y-4 hover:border-pink-400/25 transition-colors">
                <div className="text-[10px] uppercase tracking-[0.18em] font-black text-secondary">{t('profile.privacyLabel')}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{t('settings.items.hideAge')}</span>
                  <button
                    onClick={() => {
                      void appApi.patchSettings({
                        patch: {
                          privacy: {
                            hideAge: !hideAge,
                          },
                        },
                      });
                    }}
                    aria-pressed={hideAge}
                    className={`group relative inline-flex h-7 w-12 rounded-full border transition-colors ${
                      hideAge ? 'bg-white border-white/30' : 'bg-white/10 border-white/20 hover:border-white/35'
                    }`}
                  >
                    <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all ${hideAge ? 'left-[25px] bg-black shadow-[0_0_14px_rgba(236,72,153,0.45)] group-hover:shadow-[0_0_18px_rgba(236,72,153,0.65)]' : 'left-[3px] bg-black/90'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{t('settings.items.hideDistance')}</span>
                  <button
                    onClick={() => {
                      void appApi.patchSettings({
                        patch: {
                          privacy: {
                            hideDistance: !hideDistance,
                          },
                        },
                      });
                    }}
                    aria-pressed={hideDistance}
                    className={`group relative inline-flex h-7 w-12 rounded-full border transition-colors ${
                      hideDistance ? 'bg-white border-white/30' : 'bg-white/10 border-white/20 hover:border-white/35'
                    }`}
                  >
                    <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all ${hideDistance ? 'left-[25px] bg-black shadow-[0_0_14px_rgba(59,130,246,0.45)] group-hover:shadow-[0_0_18px_rgba(59,130,246,0.65)]' : 'left-[3px] bg-black/90'}`} />
                  </button>
                </div>
                <button
                  onClick={() => navigate('/settings/privacy')}
                  className="w-full mt-2 py-2.5 rounded-xl glass-panel-soft text-[10px] uppercase tracking-[0.16em] font-black hover:border-pink-400/35 hover:shadow-[0_0_14px_rgba(236,72,153,0.2)] transition-all"
                >
                  {t('settings.sections.privacy')}
                </button>
              </div>

              <div className="rounded-2xl glass-panel-soft p-4 space-y-4 hover:border-blue-400/25 transition-colors">
                <div className="text-[10px] uppercase tracking-[0.18em] font-black text-secondary">{t('profile.benefits')}</div>
                <div className="flex items-center justify-between rounded-xl glass-panel-soft px-3 py-2">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/12 border border-violet-300/25 shadow-[0_0_14px_rgba(167,139,250,0.35)]">
                    <ICONS.Ghost size={22} className="text-violet-200" />
                  </span>
                  <button
                    onClick={() => {
                      if (shadowGhostLocked) {
                        navigate('/boost');
                        return;
                      }
                      void appApi.patchSettings({
                        patch: {
                          privacy: {
                            shadowGhost: !settings.privacy.shadowGhost,
                          },
                        },
                      });
                    }}
                    className="h-8 px-3 rounded-full bg-white/8 border border-white/18 text-[10px] uppercase tracking-[0.14em] font-black text-secondary hover:bg-white/12 transition-colors inline-flex items-center gap-1.5"
                  >
                    {shadowGhostLocked && <ICONS.Lock size={12} className="text-amber-300" />}
                    {shadowGhostLocked
                      ? t('profile.locked')
                      : settings.privacy.shadowGhost
                        ? t('profile.stateOn')
                        : t('profile.stateOff')}
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{t('profile.onlineFilter')}</span>
                  <button
                    onClick={() => setOnlineOnly((v) => !v)}
                    aria-pressed={onlineOnly}
                    className={`group relative inline-flex h-7 w-12 rounded-full border transition-colors ${
                      onlineOnly ? 'bg-white border-white/30' : 'bg-white/10 border-white/20 hover:border-white/35'
                    }`}
                  >
                    <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all ${onlineOnly ? 'left-[25px] bg-black shadow-[0_0_14px_rgba(34,211,238,0.45)] group-hover:shadow-[0_0_18px_rgba(34,211,238,0.65)]' : 'left-[3px] bg-black/90'}`} />
                  </button>
                </div>
                <div className="rounded-xl glass-panel-soft px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/55 font-black">
                        {t('settings.items.travelPass')}
                      </span>
                      <span className="text-sm font-bold text-white">{currentServerCityLabel}</span>
                    </div>
                    <button
                      onClick={openServerSettings}
                      className="h-8 px-3 rounded-full bg-white/8 border border-white/18 text-[10px] uppercase tracking-[0.14em] font-black text-secondary hover:bg-white/12 transition-colors inline-flex items-center gap-1.5"
                    >
                      {!travelPassServerAccess.canChangeServer && <ICONS.Lock size={12} className="text-amber-300" />}
                      {t('settings.travelPass.changeServerCta')}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-cyan-100/70 font-black">
                    {travelPassSourceLabel}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/discover')}
                  className="w-full mt-2 py-2.5 rounded-xl glass-panel-soft text-[10px] uppercase tracking-[0.16em] font-black text-white/90 hover:border-cyan-400/35 hover:shadow-[0_0_14px_rgba(34,211,238,0.2)] transition-all"
                >
                  {t('profile.openDiscover')}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div
            ref={(el) => {
              sectionRefs.current[4] = el;
            }}
            className="grid grid-cols-2 md:grid-cols-3 gap-[var(--grid-gap)]"
          >
            {[
              { icon: <ICONS.Shield size={20} />, label: t('profile.quickActions.security'), color: 'text-blue-400', to: '/settings/privacy' },
              { icon: <ICONS.Zap size={20} />, label: t('profile.quickActions.boost'), color: 'text-orange-400', to: '/boost' },
              { icon: <ICONS.HelpCircle size={20} />, label: t('profile.quickActions.help'), color: 'text-green-400', to: '/settings/account' }
            ].map((action, i) => (
              <button 
                key={i}
                onClick={() => navigate(action.to)}
                className="p-6 rounded-[var(--card-radius)] glass-panel glass-panel-float flex flex-col items-center gap-3 transition-all group hover:border-white/30"
              >
                <div className={`p-3 rounded-2xl bg-white/5 ${action.color} group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="rounded-[var(--card-radius)] glass-panel glass-panel-float hover:border-white/25 overflow-hidden transition-colors">
            {[
              { icon: <ICONS.Profile size={16} />, label: t('settings.sections.account'), to: '/settings/account' },
              { icon: <ICONS.Shield size={16} />, label: t('settings.sections.privacy'), to: '/settings/privacy' },
              { icon: <ICONS.Bell size={16} />, label: t('settings.sections.notifications'), to: '/settings/notifications' },
              { icon: <ICONS.Settings size={16} />, label: t('settings.sections.preferences'), to: '/settings/preferences' },
            ].map((item, index, arr) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/6 transition-colors ${
                  index < arr.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <span className="text-white/70">{item.icon}</span>
                  {item.label}
                </span>
                <ICONS.ChevronLeft size={16} className="text-white/35 rotate-180" />
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>

      {showDesktopRail && (
        <div className="fixed right-0 top-0 bottom-0 w-20 z-30 pointer-events-none">
          <div className="group/profile-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-200 group-hover/profile:opacity-100 group-focus-within/profile:opacity-100 group-hover/profile-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-blue-500 shadow-[0_0_14px_rgba(168,85,247,0.28)]">
                <div className="relative w-3 h-52 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-pink-400 via-fuchsia-400 to-blue-400"
                    style={{
                      height: `${profileScrollThumb}%`,
                      top: `${profileScrollProgress * (100 - profileScrollThumb)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-2 flex flex-col gap-2.5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <button
                    key={`profile-jump-${index}`}
                    onClick={() => jumpToSection(index)}
                    className="w-3 h-3 rounded-full bg-white/35 hover:bg-white/70 transition-colors"
                    aria-label={`Aller a la section ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
