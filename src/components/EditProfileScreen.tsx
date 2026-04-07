import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, ChevronLeft, Trash2, GripVertical } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import GlassButton from './ui/GlassButton';
import { useI18n } from '../i18n/I18nProvider';
import { authApi } from '../services';
import { useAuth } from '../auth/AuthProvider';

type UploadedPhoto = {
  id: string;
  path: string;
  url: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

const PHOTO_SLOTS = 6;

const EditProfileScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromOnboarding = Boolean((location.state as { fromOnboarding?: boolean } | null)?.fromOnboarding);
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const { t } = useI18n();
  const { user } = useAuth();
  const isLarge = isDesktop || isTablet;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');
  const [about, setAbout] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasFreePhotoSlot = photos.length < PHOTO_SLOTS;
  const displayedPhotos = useMemo<(UploadedPhoto | null)[]>(
    () => [...photos, ...Array(Math.max(0, PHOTO_SLOTS - photos.length)).fill(null)],
    [photos],
  );

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      setIsLoading(true);
      setErrorText('');
      try {
        const [profilePayload, photosPayload] = await Promise.all([
          authApi.getProfileMe(),
          authApi.getProfilePhotos(),
        ]);

        if (isCancelled) return;

        if (profilePayload.ok && profilePayload.data?.profile) {
          const profile = profilePayload.data.profile;
          const sessionProfile = user?.profile as Record<string, unknown> | null | undefined;
          const fallbackFirstName =
            typeof sessionProfile?.first_name === 'string'
              ? sessionProfile.first_name
              : typeof sessionProfile?.given_name === 'string'
                ? sessionProfile.given_name
                : typeof sessionProfile?.name === 'string'
                  ? sessionProfile.name
                  : '';
          setFirstName((profile.first_name ?? fallbackFirstName ?? '').trim());
          setCity((profile.city ?? '').trim());
          setAbout((profile.bio ?? '').trim());
          setInterests(Array.isArray(profile.interests) ? profile.interests : []);
        }

        if (photosPayload.ok) {
          const sortedPhotos = [...(photosPayload.data?.photos ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          setPhotos(sortedPhotos);
        }
      } catch {
        if (!isCancelled) {
          setErrorText('Unable to load profile data.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, []);

  const saveProfile = async () => {
    setIsSaving(true);
    setErrorText('');
    setSuccessText('');
    try {
      const response = await authApi.patchProfileMe({
        first_name: firstName.trim(),
        city: city.trim(),
        bio: about.trim(),
      });
      if (!response.ok) {
        setErrorText(response.message || 'Unable to save profile.');
        return;
      }
      setSuccessText('Profile updated.');
    } catch {
      setErrorText('Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    setErrorText('');
    const response = await authApi.uploadProfilePhoto(file);
    if (!response.ok || !response.data?.photo) {
      setErrorText(response.message || 'Unable to upload photo.');
      return;
    }
    setPhotos((prev) => [...prev, response.data!.photo].sort((a, b) => a.sort_order - b.sort_order));
  };

  const onSelectPhotoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void uploadPhoto(file);
  };

  const removePhoto = async (photoId: string) => {
    setErrorText('');
    try {
      const response = await authApi.deleteProfilePhoto(photoId);
      if (!response.ok) {
        setErrorText(response.message || 'Unable to remove photo.');
        return;
      }
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    } catch {
      setErrorText('Unable to remove photo.');
    }
  };

  return (
    <div
      className={`screen-safe h-full flex flex-col bg-black ${isLarge ? 'p-12' : 'p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]'} overflow-y-auto no-scrollbar`}
      style={isTouch && isKeyboardOpen ? { paddingBottom: `calc(5.5rem + ${keyboardInset}px)` } : undefined}
    >
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              if (fromOnboarding) {
                navigate('/onboarding');
                return;
              }
              navigate(-1);
            }}
            className="p-3 rounded-2xl glass hover-effect"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">{t('editProfile.title')}</h1>
            <p className="text-secondary text-[10px] uppercase tracking-[0.2em] font-bold">{t('editProfile.subtitle')}</p>
          </div>
        </div>
        <GlassButton
          onClick={saveProfile}
          disabled={isSaving || isLoading}
          className="py-3 px-8 rounded-2xl text-xs font-black uppercase tracking-widest bg-pink-500 text-white border-none disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : t('editProfile.save')}
        </GlassButton>
      </header>

      {errorText && <p className="mb-4 text-xs text-red-300">{errorText}</p>}
      {successText && <p className="mb-4 text-xs text-emerald-300">{successText}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelectPhotoFile}
      />

      <div className={`grid ${isLarge ? 'grid-cols-12 gap-12' : 'grid-cols-1 gap-10'}`}>
        <div className={`${isLarge ? 'col-span-7' : ''} space-y-6`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t('editProfile.photos', { count: photos.length })}</h3>
            <span className="text-[10px] text-secondary font-bold">{t('editProfile.dragReorder')}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {displayedPhotos.map((photo, i) => (
              <div key={photo?.id ?? `slot-${i}`} className={`${i === 0 ? 'col-span-2 row-span-2' : ''} aspect-square rounded-[32px] relative group overflow-hidden border border-white/5 bg-white/[0.02]`}>
                {photo?.url ? (
                  <>
                    <img src={photo.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => void removePhoto(photo.id)}
                        className="p-2 glass rounded-xl text-white hover:bg-red-500/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button className="p-2 glass rounded-xl text-white cursor-grab active:cursor-grabbing">
                        <GripVertical size={18} />
                      </button>
                    </div>
                    {i === 0 && <div className="absolute top-4 left-4 px-3 py-1 glass rounded-full text-[8px] font-black uppercase tracking-widest text-white">{t('editProfile.main')}</div>}
                  </>
                ) : (
                  <button
                    disabled={!hasFreePhotoSlot}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/20 hover:text-pink-500 hover:bg-pink-500/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-current flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">{t('editProfile.add')}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={`${isLarge ? 'col-span-5' : ''} space-y-10`}>
          <section className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black px-2 block">{t('editProfile.about')}</label>
            <div className="glass rounded-[32px] p-1 focus-within:border-pink-500/30 transition-colors border border-transparent">
              <textarea
                className="w-full bg-transparent outline-none p-6 text-sm leading-relaxed min-h-[160px] no-scrollbar resize-none"
                placeholder={t('editProfile.aboutPlaceholder')}
                value={about}
                onChange={(event) => setAbout(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black px-2 block">First name</label>
            <div className="glass rounded-[20px] p-4 border border-white/10">
              <input
                className="w-full bg-transparent outline-none text-sm"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black px-2 block">City</label>
            <div className="glass rounded-[20px] p-4 border border-white/10">
              <input
                className="w-full bg-transparent outline-none text-sm"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black px-2 block">{t('editProfile.interests')}</label>
            <div className="flex flex-wrap gap-3">
              {interests.map((tag) => (
                <div key={tag} className="px-5 py-3 rounded-2xl glass border border-white/5 text-xs font-bold flex items-center gap-3">
                  {tag}
                </div>
              ))}
              {interests.length === 0 && (
                <span className="text-xs text-white/50">No interests saved yet.</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;
