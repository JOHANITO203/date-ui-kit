import React from 'react';
import { Plus, ChevronLeft, Trash2, GripVertical } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import GlassButton from './ui/GlassButton';
import { useI18n } from '../i18n/I18nProvider';

const EditProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromOnboarding = Boolean((location.state as { fromOnboarding?: boolean } | null)?.fromOnboarding);
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;

  const photos = ['https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80', null, null, null, null, null];
  const interests = ['travel', 'photography', 'coffee', 'music', 'hiking'] as const;

  return (
    <div
      className={`h-full flex flex-col bg-black ${isLarge ? 'p-12' : 'p-6 pb-28'} overflow-y-auto no-scrollbar`}
      style={isTouch && isKeyboardOpen ? { paddingBottom: `calc(7rem + ${keyboardInset}px)` } : undefined}
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
        <GlassButton className="py-3 px-8 rounded-2xl text-xs font-black uppercase tracking-widest bg-pink-500 text-white border-none">{t('editProfile.save')}</GlassButton>
      </header>

      <div className={`grid ${isLarge ? 'grid-cols-12 gap-12' : 'grid-cols-1 gap-10'}`}>
        <div className={`${isLarge ? 'col-span-7' : ''} space-y-6`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t('editProfile.photos', { count: 1 })}</h3>
            <span className="text-[10px] text-secondary font-bold">{t('editProfile.dragReorder')}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {photos.map((photo, i) => (
              <div key={i} className={`${i === 0 ? 'col-span-2 row-span-2' : ''} aspect-square rounded-[32px] relative group overflow-hidden border border-white/5 bg-white/[0.02]`}>
                {photo ? (
                  <>
                    <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button className="p-2 glass rounded-xl text-white hover:bg-red-500/20 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                      <button className="p-2 glass rounded-xl text-white cursor-grab active:cursor-grabbing">
                        <GripVertical size={18} />
                      </button>
                    </div>
                    {i === 0 && <div className="absolute top-4 left-4 px-3 py-1 glass rounded-full text-[8px] font-black uppercase tracking-widest text-white">{t('editProfile.main')}</div>}
                  </>
                ) : (
                  <button className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/20 hover:text-pink-500 hover:bg-pink-500/5 transition-all">
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
                defaultValue={t('editProfile.aboutValue')}
              />
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black px-2 block">{t('editProfile.interests')}</label>
            <div className="flex flex-wrap gap-3">
              {interests.map((tag) => (
                <div key={tag} className="px-5 py-3 rounded-2xl glass border border-white/5 text-xs font-bold flex items-center gap-3 group hover:border-pink-500/30 transition-colors cursor-pointer">
                  {t(`editProfile.tags.${tag}`)}
                  <button className="text-white/20 group-hover:text-red-500 transition-colors">
                    <Plus size={14} className="rotate-45" />
                  </button>
                </div>
              ))}
              <button className="px-5 py-3 rounded-2xl border border-dashed border-white/20 text-xs font-bold text-secondary hover:text-white hover:border-white/40 transition-all flex items-center gap-2">
                <Plus size={14} /> {t('editProfile.addInterest')}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black px-2 block">{t('editProfile.verifiedDetails')}</label>
            <div className="glass rounded-[32px] overflow-hidden">
              {[
                { label: t('editProfile.details.height'), value: '182 cm' },
                { label: t('editProfile.details.sport'), value: t('editProfile.details.often') },
                { label: t('editProfile.details.smoker'), value: t('editProfile.details.no') },
                { label: t('editProfile.details.languages'), value: t('editProfile.details.languagesValue') },
              ].map((item, i, arr) => (
                <button key={item.label} className={`w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors ${i !== arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <span className="text-xs font-bold text-secondary">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black">{item.value}</span>
                    <ChevronLeft size={14} className="rotate-180 text-white/20" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;
