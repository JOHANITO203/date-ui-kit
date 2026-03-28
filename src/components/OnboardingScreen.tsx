import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useI18n } from '../i18n/I18nProvider';

type ZodiacKey =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

const ZODIAC_SIGNS: Array<{ key: ZodiacKey; symbol: string; start: [number, number]; end: [number, number] }> = [
  { key: 'aries', symbol: '♈', start: [3, 21], end: [4, 19] },
  { key: 'taurus', symbol: '♉', start: [4, 20], end: [5, 20] },
  { key: 'gemini', symbol: '♊', start: [5, 21], end: [6, 20] },
  { key: 'cancer', symbol: '♋', start: [6, 21], end: [7, 22] },
  { key: 'leo', symbol: '♌', start: [7, 23], end: [8, 22] },
  { key: 'virgo', symbol: '♍', start: [8, 23], end: [9, 22] },
  { key: 'libra', symbol: '♎', start: [9, 23], end: [10, 22] },
  { key: 'scorpio', symbol: '♏', start: [10, 23], end: [11, 21] },
  { key: 'sagittarius', symbol: '♐', start: [11, 22], end: [12, 21] },
  { key: 'capricorn', symbol: '♑', start: [12, 22], end: [1, 19] },
  { key: 'aquarius', symbol: '♒', start: [1, 20], end: [2, 18] },
  { key: 'pisces', symbol: '♓', start: [2, 19], end: [3, 20] },
];

const getZodiacSign = (dateString: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return (
    ZODIAC_SIGNS.find((sign) => {
      const [sMonth, sDay] = sign.start;
      const [eMonth, eDay] = sign.end;

      if (month === sMonth) return day >= sDay;
      if (month === eMonth) return day <= eDay;
      return false;
    }) || ZODIAC_SIGNS[9]
  );
};

const OnboardingScreen = () => {
  const navigate = useNavigate();
  const { isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [birthDate, setBirthDate] = useState('');
  const [zodiac, setZodiac] = useState<{ key: ZodiacKey; symbol: string } | null>(null);
  const totalSteps = 4;

  useEffect(() => {
    const sign = getZodiacSign(birthDate);
    if (sign) setZodiac({ key: sign.key, symbol: sign.symbol });
  }, [birthDate]);

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
    else navigate('/discover');
  };

  return (
    <div className="screen-safe h-full w-full flex flex-col px-[var(--page-x)] pt-10 md:pt-14 overflow-hidden bg-black">
      <div className="container-content w-full mx-auto flex gap-2 mb-8 sm:mb-12 shrink-0">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i + 1 <= step ? 'gradient-premium' : 'bg-white/10'}`} />
        ))}
      </div>

      <div
        className="container-content w-full mx-auto flex-1 overflow-y-auto no-scrollbar min-h-0"
        style={isTouch ? { paddingBottom: `calc(${isKeyboardOpen ? `${keyboardInset}px + ` : ''}0.75rem)` } : undefined}
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
              <div className="mb-6 sm:mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{t('onboarding.step1.title')}</h2>
                <p className="text-white/50 text-base sm:text-lg leading-relaxed">
                  {t('onboarding.step1.subtitle1')} <span className="text-white font-semibold">{t('onboarding.step1.subtitle2')}</span>
                  {t('onboarding.step1.subtitle3')}
                </p>
              </div>

              <div className="grid grid-cols-3 grid-rows-2 gap-3 aspect-square sm:aspect-auto sm:h-[380px] mb-6">
                <div className="col-span-2 row-span-2 relative group cursor-pointer overflow-hidden rounded-[24px] sm:rounded-[32px] border-2 border-dashed border-white/10 hover:border-pink-500/50 transition-all duration-500 bg-white/[0.02]">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-4 group-hover:scale-110 transition-transform duration-500">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-xl">
                      <ICONS.Camera size={24} className="sm:text-white/40" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/30">{t('onboarding.step1.mainPhoto')}</span>
                  </div>
                  <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 gradient-premium rounded-full flex items-center justify-center shadow-lg shadow-pink-500/30">
                    <span className="text-xl sm:text-2xl font-light">+</span>
                  </div>
                </div>

                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="relative group cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[24px] border border-dashed border-white/10 hover:border-pink-500/30 transition-all duration-500 bg-white/[0.01]"
                  >
                    <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <ICONS.Camera size={18} className="text-white/10" />
                    </div>
                    <div className="absolute bottom-2 right-2 w-5 h-5 sm:w-6 sm:h-6 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 group-hover:bg-white/20 transition-colors">
                      <span className="text-xs sm:text-sm font-light text-white/60">+</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 p-4 glass rounded-[20px] sm:rounded-[24px] border border-white/5 mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <ICONS.Star size={18} />
                </div>
                <p className="text-[10px] sm:text-[11px] text-white/40 leading-tight">
                  <span className="text-white/60 font-bold block mb-0.5 uppercase tracking-wider">{t('onboarding.step1.expertTip')}</span>
                  {t('onboarding.step1.expertBody')}
                </p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 space-y-6 sm:space-y-8">
              <div className="mb-4">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">{t('onboarding.step2.title')}</h2>
                <p className="text-white/50">{t('onboarding.step2.subtitle')}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-4">{t('onboarding.step2.firstName')}</label>
                  <input type="text" placeholder={t('onboarding.step2.firstNamePlaceholder')} className="w-full glass rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 outline-none focus:border-pink-500/50 transition-colors" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-4">{t('onboarding.step2.lastName')}</label>
                  <input type="text" placeholder={t('onboarding.step2.lastNamePlaceholder')} className="w-full glass rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 outline-none focus:border-pink-500/50 transition-colors" />
                </div>

                <div className="space-y-2 relative">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-4">{t('onboarding.step2.birthDate')}</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full glass rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 outline-none focus:border-pink-500/50 transition-colors"
                  />

                  <AnimatePresence>
                    {zodiac && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute right-4 top-[42px] flex items-center gap-2 px-3 py-1.5 glass rounded-full border border-pink-500/20">
                        <span className="text-lg">{zodiac.symbol}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">{t(`onboarding.zodiac.${zodiac.key}`)}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 space-y-8">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('onboarding.step3.title')}</h2>
              <div className="space-y-6">
                <GlassButton className="w-full py-5 sm:py-6">
                  <ICONS.MapPin size={20} />
                  {t('onboarding.step3.useLocation')}
                </GlassButton>
                <div className="relative">
                  <input type="text" placeholder={t('onboarding.step3.cityPlaceholder')} className="w-full glass rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 pl-12 outline-none" />
                  <ICONS.Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex-1 text-center flex flex-col items-center justify-center relative min-h-0 py-4 sm:py-6 md:py-8 gap-6 sm:gap-7 md:gap-8">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5], x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400, rotate: Math.random() * 360 }}
                    transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                    className="absolute left-1/2 top-1/2"
                  >
                    {i % 3 === 0 ? <ICONS.Star className="text-yellow-400" size={12 + Math.random() * 12} /> : i % 3 === 1 ? <ICONS.Heart className="text-pink-500" size={12 + Math.random() * 12} /> : <div className="w-2 h-2 rounded-full bg-blue-400" />}
                  </motion.div>
                ))}
              </div>

              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }} className="relative shrink-0">
                <div className="w-[clamp(5.75rem,11vw,8rem)] h-[clamp(5.75rem,11vw,8rem)] gradient-premium rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(236,72,153,0.3)] relative z-10">
                  <ICONS.CheckCircle2 className="text-white w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)]" />
                </div>
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 border-2 border-pink-500/30 rounded-full" />
                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 3, repeat: Infinity, delay: 0.5 }} className="absolute inset-[-10px] border border-blue-500/20 rounded-full" />
              </motion.div>

              <div className="space-y-3 sm:space-y-4 relative z-10 max-w-[36rem]">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <span className="inline-block px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-3 sm:mb-4">
                    {t('onboarding.step4.badge')}
                  </span>
                  <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                    {t('onboarding.step4.title')}
                  </h2>
                </motion.div>

                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-white/50 text-[1.05rem] sm:text-[1.15rem] max-w-[26ch] sm:max-w-[30ch] md:max-w-[34ch] mx-auto leading-[1.55] px-2 sm:px-0">
                  {t('onboarding.step4.subtitle')}
                </motion.p>
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="w-full max-w-[280px] p-4 glass rounded-[32px] border border-white/10 flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl gradient-premium flex items-center justify-center shrink-0 shadow-lg">
                  <ICONS.Zap size={24} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{t('onboarding.step4.rewardTitle')}</h4>
                  <p className="text-[10px] text-white/40">{t('onboarding.step4.rewardSubtitle')}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="container-content w-full mx-auto mt-6 pb-safe shrink-0" style={isTouch && isKeyboardOpen ? { marginBottom: `${keyboardInset}px` } : undefined}>
        <GlassButton variant="premium" onClick={nextStep} className="w-full py-4 sm:py-5 text-lg font-bold">
          {step === totalSteps ? t('onboarding.finish') : t('onboarding.continue')}
        </GlassButton>
      </div>
    </div>
  );
};

export default OnboardingScreen;

