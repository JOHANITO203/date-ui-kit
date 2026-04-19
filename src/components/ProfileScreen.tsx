import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import { useDevice } from '../hooks/useDevice';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nProvider';
import { appApi, authApi, getTrackedEvents } from '../services';
import { useRuntimeSelector } from '../state';
import {
  resolveTravelPassServerAccess,
  TRAVEL_PASS_ENABLED,
  TRAVEL_PASS_LOCKED_CITY,
} from '../domain/travelPass';
import { resolveShadowGhostAccess } from '../domain/shadowGhost';
import { useAuth } from '../auth/AuthProvider';
import {
  clearOnboardingDraft,
  clearOnboardingProfileSnapshot,
  hydrateProfileSeed,
} from '../domain/profileHydration';
import { computeVisibilityScore } from '../domain/visibilityScore';
import { hasSubscriptionBenefit } from '../domain/subscriptionBenefits';
import { buildResponsiveImageAttrs } from '../utils/imageDelivery';
import VerticalPageRail from './ui/VerticalPageRail';

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
    icebreakers: payload.balances.icebreakersLeft,
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
  const shadowGhostActive = !shadowGhostLocked && settings.privacy.shadowGhost;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [profileScrollProgress, setProfileScrollProgress] = useState(0);
  const [profileScrollThumb, setProfileScrollThumb] = useState(28);
  const planTitle = t(`settings.plan.${previewPlan}`);
  const planPalette = useMemo(() => {
    if (previewPlan === 'elite') {
      return { hue: 292, comp: 192, sat: '78%', light: '60%' };
    }
    if (previewPlan === 'platinum') {
      return { hue: 192, comp: 305, sat: '74%', light: '56%' };
    }
    if (previewPlan === 'free') {
      return { hue: 220, comp: 20, sat: '12%', light: '58%' };
    }
    return { hue: 40, comp: 210, sat: '82%', light: '56%' };
  }, [previewPlan]);
  const planColorVars = useMemo(
    () =>
      ({
        '--plan-hue': String(planPalette.hue),
        '--plan-comp-hue': String(planPalette.comp),
        '--plan-sat': planPalette.sat,
        '--plan-light': planPalette.light,
      }) as CSSProperties,
    [planPalette],
  );
  const planBadgeLabel =
    previewPlan === 'elite'
      ? t('badges.premiumPlus')
      : previewPlan === 'platinum'
        ? t('badges.platinum')
        : previewPlan === 'free'
          ? t('settings.plan.free')
          : t('badges.premium');
  const planSubtitle = previewPlan === 'free' ? t('profile.premiumSubtitle') : t('profile.planGoldSubtitle');
  const hideAge = settings.privacy.hideAge;
  const hideDistance = settings.privacy.hideDistance;
  const profileNameLabel =
    profileAge !== undefined && !hideAge ? `${profileName}, ${profileAge}` : profileName;
  const planBadgeTone = useMemo<CSSProperties>(
    () => ({
      background:
        'linear-gradient(90deg, hsl(var(--plan-hue) var(--plan-sat) 66% / 0.95), hsl(var(--plan-comp-hue) 68% 60% / 0.92))',
      borderColor: 'hsl(var(--plan-hue) var(--plan-sat) 78% / 0.42)',
      boxShadow: '0 8px 18px hsl(var(--plan-hue) var(--plan-sat) 55% / 0.28)',
      color: 'hsl(0 0% 8% / 0.96)',
    }),
    [],
  );
  const accentTone = useMemo<CSSProperties>(
    () => ({
      color: 'hsl(var(--plan-hue) var(--plan-sat) 72% / 0.95)',
    }),
    [],
  );
  const accentCompTone = useMemo<CSSProperties>(
    () => ({
      color: 'hsl(var(--plan-comp-hue) 68% 68% / 0.92)',
    }),
    [],
  );
  const planCardToneStyle = useMemo<CSSProperties>(
    () => ({
      background:
        'radial-gradient(circle at 88% 0%, hsl(var(--plan-hue) var(--plan-sat) 56% / 0.2) 0%, transparent 58%), linear-gradient(160deg, rgba(12,12,16,0.96), rgba(8,8,12,0.92))',
      boxShadow: '0 0 34px hsl(var(--plan-hue) var(--plan-sat) 52% / 0.24)',
      borderColor: 'hsl(var(--plan-hue) var(--plan-sat) 62% / 0.28)',
    }),
    [],
  );
  const planIconToneStyle = useMemo<CSSProperties>(
    () => ({
      borderColor: 'hsl(var(--plan-hue) var(--plan-sat) 68% / 0.28)',
      color: 'hsl(var(--plan-hue) var(--plan-sat) 72% / 0.92)',
      boxShadow: '0 0 14px hsl(var(--plan-hue) var(--plan-sat) 52% / 0.24)',
    }),
    [],
  );
  const warningToneStyle = useMemo<CSSProperties>(
    () => ({
      color: 'hsl(var(--plan-comp-hue) 68% 72% / 0.88)',
    }),
    [],
  );
  const canManagePrivacyControls = hasSubscriptionBenefit(previewPlan, 'profile_hide_age_distance');
  const travelPassServerAccess = resolveTravelPassServerAccess({
    planTier: previewPlan,
    entitlementSource: settings.preferences.travelPassEntitlementSource,
    entitlementExpiresAtIso: settings.preferences.travelPassEntitlementExpiresAtIso,
  });
  const travelPassUiLocked = !TRAVEL_PASS_ENABLED || !travelPassServerAccess.canChangeServer;
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
  const lockedServerCityLabel =
    TRAVEL_PASS_LOCKED_CITY === 'voronezh'
      ? t('settings.cities.voronezh')
      : t('settings.cities.moscow');
  const currentServerCityLabel = TRAVEL_PASS_ENABLED
    ? (travelPassServerAccess.canChangeServer ? travelPassCityLabel : null) ??
      profileCity ??
      t('settings.cities.moscow')
    : lockedServerCityLabel;
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
  const profilePhotoAttrs = useMemo(
    () =>
      buildResponsiveImageAttrs(
        profilePhotoUrl,
        'profile',
        '(max-width: 1024px) 100vw, 520px',
      ),
    [profilePhotoUrl],
  );
  const openServerSettings = () => {
    if (TRAVEL_PASS_ENABLED && travelPassServerAccess.canChangeServer) {
      navigate('/settings/privacy/travel-pass-city');
      return;
    }
  };

  useEffect(() => {
    let isCancelled = false;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('bench') === '1') {
        setProfilePhotoUrl(
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80',
        );
      }
    }

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
      { allowOnboardingFallback: true },
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
            ? conversationsResult.value.filter((item) => item.relationState === 'active').length
            : fallbackMatches;
        const viewedByOthers =
          likesResult.status === 'fulfilled'
            ? likesResult.value.inventory.visibleLikes.length
            : 0;
        const computedViews = Math.round((ownDiscoverViews + viewedByOthers) * 1.35);

        setProfileViewsCount(computedViews);
        setMatchesCount(matches);

        if (profileResult.status === 'fulfilled' && profileResult.value.ok && profileResult.value.data?.profile) {
          clearOnboardingProfileSnapshot();
          clearOnboardingDraft();
          const profile = profileResult.value.data.profile;
          const seed = hydrateProfileSeed(
            profile,
            user?.profile as Record<string, unknown> | null | undefined,
            { allowOnboardingFallback: false },
          );
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
                setProfileCity(t('settings.cities.moscow'));
              },
              { enableHighAccuracy: true, timeout: 3000, maximumAge: 10 * 60 * 1000 },
            );
          } else {
            setProfileCity(t('settings.cities.moscow'));
          }
        } else {
          setProfileName(fallbackNameFromSession || 'User');
        }

        await photosPromise;
      } catch {
        if (!isCancelled) {
          setProfileName((prev) => prev || fallbackNameFromSession || 'User');
          setProfileCity((prev) => prev || t('settings.cities.moscow'));
        }
      }
    };

    void hydrateProfileState();

    return () => {
      isCancelled = true;
    };
  }, [
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
  const seekToRatio = (ratio: number) => {
    const node = scrollRef.current;
    if (!node) return;
    const max = node.scrollHeight - node.clientHeight;
    if (max <= 0) return;
    node.scrollTo({ top: Math.max(0, Math.min(1, ratio)) * max, behavior: 'smooth' });
  };

  return (
    <div
      ref={scrollRef}
      style={planColorVars}
      className={`relative group/profile h-full flex flex-col ${isLarge ? 'py-10 pr-8' : 'py-6 pb-nav'} overflow-y-auto no-scrollbar bg-black`}
    >
      <div
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -top-40 left-1/2 h-80 w-[72rem] -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(255,20,147,0.15),transparent_68%)]" />
        <div className="absolute top-28 right-[-12rem] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,191,255,0.16),transparent_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.35),rgba(0,0,0,0.9)_62%)]" />
      </div>
      {/* Header Section */}
      <div className="relative z-10 px-[var(--page-x)] mb-6 md:mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none">{t('profile.title')}</h2>
            <p
              className="mt-2 text-[11px] uppercase tracking-[0.22em] font-bold"
              style={{ color: 'hsl(var(--plan-hue) var(--plan-sat) 72% / 0.72)' }}
            >
              {t('profile.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/profile/edit')}
              className="ui21-btn ui21-btn-ghost inline-flex items-center gap-2 h-11 px-4 rounded-2xl"
            >
              <ICONS.Edit size={14} />
              {t('profile.improve')}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="ui21-card-soft w-11 h-11 rounded-2xl flex items-center justify-center"
            >
              <ICONS.Settings size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className={`${isLarge ? 'container-dashboard screen-template-dashboard density-comfortable' : ''} relative z-10`}>
        <div className={`grid px-[var(--page-x)] ${isLarge ? 'grid-cols-12 gap-[var(--grid-gap)]' : 'grid-cols-1 gap-5'}`}>
          {/* Left Column: Identity + Plan */}
          <div className={`${isLarge ? 'col-span-4' : ''} space-y-5`}>
            <section
              ref={(el) => {
                sectionRefs.current[0] = el;
              }}
              className="ui21-card rounded-[var(--card-radius)] overflow-hidden"
              style={{ borderColor: 'hsl(var(--plan-hue) var(--plan-sat) 62% / 0.25)' }}
            >
              <div className="relative aspect-[0.95]">
                {shadowGhostActive ? (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(145deg, hsl(var(--plan-hue) var(--plan-sat) 24% / 0.34), rgba(5,5,8,0.78), hsl(var(--plan-comp-hue) 68% 26% / 0.24))',
                    }}
                  >
                    <ICONS.Ghost size={54} style={accentCompTone} />
                    <span className="sr-only">{t('profile.stateOn')}</span>
                  </div>
                ) : profilePhotoUrl ? (
                  <img
                    src={profilePhotoAttrs.src}
                    srcSet={profilePhotoAttrs.srcSet}
                    sizes={profilePhotoAttrs.sizes}
                    className="w-full h-full object-cover"
                    alt="Me"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(145deg, hsl(var(--plan-hue) var(--plan-sat) 24% / 0.32), rgba(11,11,14,0.96), hsl(var(--plan-comp-hue) 68% 24% / 0.22))',
                    }}
                  >
                    <ICONS.Profile size={58} className="text-white/65" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute top-4 left-4 right-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => navigate('/profile/edit')}
                    className="ui21-card-soft w-9 h-9 rounded-xl inline-flex items-center justify-center"
                  >
                    <ICONS.Edit size={14} />
                  </button>
                </div>
                <div className="absolute bottom-5 left-5 right-5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[length:var(--name-xl)] min-w-0 font-black tracking-tight leading-none whitespace-nowrap">
                      {profileNameLabel}
                    </span>
                    {verifiedIdentity && (
                      <span
                        className="w-[var(--verified-badge-size)] h-[var(--verified-badge-size)] rounded-full border border-white/45 flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'hsl(var(--plan-comp-hue) 68% 56% / 0.9)',
                          boxShadow: '0 6px 16px hsl(var(--plan-comp-hue) 68% 54% / 0.32)',
                        }}
                        aria-label={t('badges.verified')}
                        title={t('badges.verified')}
                      >
                        <svg viewBox="0 0 12 12" className="w-[9px] h-[9px] text-white" aria-hidden>
                          <path
                            d="M2.2 6.2 4.8 8.7 9.8 3.7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                    {previewPlan !== 'free' && (
                      <span
                        className="h-[var(--verified-badge-size)] rounded-full border px-2.5 inline-flex items-center justify-center text-[9px] font-black uppercase tracking-[0.12em] shrink-0"
                        style={planBadgeTone}
                      >
                        {planBadgeLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-white/70 text-[11px] font-bold uppercase tracking-[0.16em]">
                    <ICONS.MapPin size={12} style={accentTone} />
                    {profileCity || t('settings.cities.moscow')}
                  </div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2 bg-black/20">
                <button
                  onClick={() => navigate('/discover')}
                  className="ui21-btn ui21-btn-ghost h-10 rounded-xl"
                >
                  {t('profile.preview')}
                </button>
                <button
                  onClick={() => navigate('/boost')}
                  className="ui21-btn ui21-btn-primary h-10 rounded-xl"
                >
                  {t('settings.plan.manage')}
                </button>
              </div>
            </section>

            <section
              ref={(el) => {
                sectionRefs.current[1] = el;
              }}
              className="ui21-card rounded-[var(--card-radius)] p-5 md:p-6 space-y-5 border"
              style={planCardToneStyle}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-black">Active plan</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight">{planTitle}</h3>
                  <p className="text-xs text-white/65 mt-1 leading-relaxed">{planSubtitle}</p>
                </div>
                <span className="w-10 h-10 rounded-2xl glass-panel-soft inline-flex items-center justify-center border" style={planIconToneStyle}>
                  <ICONS.Star size={16} />
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {([
                  {
                    id: 'superlikes',
                    label: t('settings.tokens.superlikes'),
                    value: balances.superlikes,
                    Icon: ICONS.Heart,
                    iconStyle: accentCompTone,
                  },
                  {
                    id: 'boosts',
                    label: t('settings.tokens.boosts'),
                    value: balances.boosts,
                    Icon: ICONS.Zap,
                    iconStyle: accentTone,
                  },
                  {
                    id: 'rewinds',
                    label: t('settings.tokens.rewinds'),
                    value: balances.rewinds,
                    Icon: ICONS.Rewind,
                    iconStyle: { color: 'hsl(var(--plan-hue) var(--plan-sat) 78% / 0.86)' },
                  },
                  {
                    id: 'icebreakers',
                    label: t('likes.iceBreakerTitle'),
                    value: balances.icebreakers,
                    Icon: ICONS.Star,
                    iconStyle: { color: 'hsl(var(--plan-comp-hue) 68% 72% / 0.9)' },
                  },
                ] as const).map((item) => (
                  <div key={item.id} className="ui21-card-soft rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5" style={item.iconStyle}>
                        <item.Icon size={12} />
                      </span>
                      <motion.span
                        key={`${item.id}-${item.value}`}
                        initial={{ opacity: 0, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg font-black leading-none"
                      >
                        {item.value}
                      </motion.span>
                    </div>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/55 font-black">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Metrics + Controls */}
          <div className={`${isLarge ? 'col-span-8' : ''} space-y-5`}>
            <section
              ref={(el) => {
                sectionRefs.current[2] = el;
              }}
              className={`grid gap-3 ${isDesktop ? 'grid-cols-3' : 'grid-cols-1'}`}
            >
              <div className="ui21-card p-5 rounded-[var(--card-radius)]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex p-2 rounded-xl bg-white/6" style={accentTone}>
                    <ICONS.Eye size={16} />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-black">{t('profile.profileViews')}</span>
                </div>
                <p className="mt-4 text-3xl font-black tracking-tight">{profileViewsCount.toLocaleString()}</p>
              </div>

              <div className="ui21-card p-5 rounded-[var(--card-radius)]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex p-2 rounded-xl bg-white/6" style={accentCompTone}>
                    <ICONS.Heart size={16} />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-black">{t('profile.newMatches')}</span>
                </div>
                <p className="mt-4 text-3xl font-black tracking-tight">{matchesCount.toLocaleString()}</p>
              </div>

              <div
                ref={(el) => {
                  sectionRefs.current[3] = el;
                }}
                className="ui21-card p-5 rounded-[var(--card-radius)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-black">{t('profile.visibilityTitle')}</span>
                  <span
                    className="text-2xl font-black tracking-tight"
                    style={{ color: 'hsl(var(--plan-hue) var(--plan-sat) 72% / 0.96)' }}
                  >
                    {visibilityScore}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/55">{t('profile.visibilitySubtitle')}</p>
                <div className="mt-4 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${visibilityScore}%` }}
                    transition={{ duration: 1.2, ease: 'circOut' }}
                    className="h-full rounded-full"
                    style={{
                      background:
                        'linear-gradient(90deg, hsl(var(--plan-hue) var(--plan-sat) 62% / 0.95), hsl(var(--plan-comp-hue) 68% 60% / 0.95))',
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="ui21-card rounded-[var(--card-radius)] p-5 md:p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-lg font-black uppercase tracking-[0.08em]">{t('profile.controlTitle')}</h4>
                {isDesktop && (
                  <button
                    onClick={openServerSettings}
                    disabled={travelPassUiLocked}
                    aria-disabled={travelPassUiLocked}
                    className={`h-9 px-3 rounded-xl bg-white/8 border border-white/15 text-[10px] uppercase tracking-[0.14em] font-black inline-flex items-center gap-1.5 ${
                      travelPassUiLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/12'
                    }`}
                  >
                    {travelPassUiLocked && <ICONS.Lock size={11} style={warningToneStyle} />}
                    {t('profile.serverCity', { city: currentServerCityLabel })}
                  </button>
                )}
              </div>

              <div className={`grid gap-3 ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="ui21-card-soft rounded-2xl p-4 space-y-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50 font-black">{t('profile.privacyLabel')}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t('settings.items.hideAge')}</span>
                    <button
                      onClick={() => {
                        if (!canManagePrivacyControls) {
                          navigate('/boost');
                          return;
                        }
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
                      <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all ${hideAge ? 'left-[25px] bg-black' : 'left-[3px] bg-black/90'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t('settings.items.hideDistance')}</span>
                    <button
                      onClick={() => {
                        if (!canManagePrivacyControls) {
                          navigate('/boost');
                          return;
                        }
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
                      <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all ${hideDistance ? 'left-[25px] bg-black' : 'left-[3px] bg-black/90'}`} />
                    </button>
                  </div>
                  <button onClick={() => navigate('/settings/privacy')} className="ui21-btn ui21-btn-ghost w-full h-9 rounded-xl inline-flex items-center justify-center gap-1.5">
                    {!canManagePrivacyControls && <ICONS.Lock size={11} style={warningToneStyle} />}
                    {t('settings.sections.privacy')}
                  </button>
                </div>

                <div className="ui21-card-soft rounded-2xl p-4 space-y-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50 font-black">{t('profile.benefits')}</p>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <ICONS.Ghost size={14} style={accentCompTone} />
                      ShadowGhost
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
                      className="ui21-btn ui21-btn-ghost h-8 px-3 inline-flex items-center gap-1.5"
                    >
                      {shadowGhostLocked && <ICONS.Lock size={11} style={warningToneStyle} />}
                      {settings.privacy.shadowGhost ? t('profile.stateOn') : t('profile.stateOff')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <span className="text-sm font-semibold">{t('profile.onlineFilter')}</span>
                    <button
                      onClick={() => setOnlineOnly((v) => !v)}
                      aria-pressed={onlineOnly}
                      className={`group relative inline-flex h-7 w-12 rounded-full border transition-colors ${
                        onlineOnly ? 'bg-white border-white/30' : 'bg-white/10 border-white/20 hover:border-white/35'
                      }`}
                    >
                      <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all ${onlineOnly ? 'left-[25px] bg-black' : 'left-[3px] bg-black/90'}`} />
                    </button>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-white/55 font-black">
                        {t('settings.items.travelPass')}
                      </span>
                      <button
                        onClick={openServerSettings}
                        disabled={travelPassUiLocked}
                        aria-disabled={travelPassUiLocked}
                        className={`ui21-btn ui21-btn-ghost h-7 px-2.5 rounded-lg ${travelPassUiLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {t('settings.travelPass.changeServerCta')}
                      </button>
                    </div>
                    <p className="text-sm font-bold text-white">{currentServerCityLabel}</p>
                    <p
                      className="text-[10px] uppercase tracking-[0.12em] font-black"
                      style={{ color: 'hsl(var(--plan-comp-hue) 68% 76% / 0.72)' }}
                    >
                      {travelPassSourceLabel}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              ref={(el) => {
                sectionRefs.current[4] = el;
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: <ICONS.Shield size={18} />, label: t('profile.quickActions.security'), to: '/settings/privacy' },
                  { icon: <ICONS.Zap size={18} />, label: t('profile.quickActions.boost'), to: '/boost' },
                  { icon: <ICONS.HelpCircle size={18} />, label: t('profile.quickActions.help'), to: '/settings/account' },
                ].map((action) => (
                  <button
                    key={action.to}
                    onClick={() => navigate(action.to)}
                    className="h-20 ui21-card rounded-2xl flex flex-col items-center justify-center gap-2"
                  >
                    <span className="text-white/80">{action.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/70">{action.label}</span>
                  </button>
                ))}
              </div>

              <div className="ui21-card rounded-2xl overflow-hidden">
                {[
                  { icon: <ICONS.Profile size={16} />, label: t('settings.sections.account'), to: '/settings/account' },
                  { icon: <ICONS.Shield size={16} />, label: t('settings.sections.privacy'), to: '/settings/privacy' },
                  { icon: <ICONS.Bell size={16} />, label: t('settings.sections.notifications'), to: '/settings/notifications' },
                  { icon: <ICONS.Settings size={16} />, label: t('settings.sections.preferences'), to: '/settings/preferences' },
                ].map((item, index, arr) => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/6 transition-colors ${
                      index < arr.length - 1 ? 'border-b border-white/5' : ''
                    }`}
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-white/90">
                      <span className="text-white/65">{item.icon}</span>
                      {item.label}
                    </span>
                    <ICONS.ChevronLeft size={14} className="text-white/35 rotate-180" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <VerticalPageRail
        visible={showDesktopRail}
        progress={profileScrollProgress}
        thumb={profileScrollThumb}
        tone="profile"
        sections={[0, 1, 2, 3, 4].map((index) => ({
          id: `profile-section-${index}`,
          label: `Section ${index + 1}`,
        }))}
        onJump={jumpToSection}
        onSeekRatio={seekToRatio}
      />
    </div>
  );
};

export default ProfileScreen;
