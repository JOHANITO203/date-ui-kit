import { useNavigate } from 'react-router-dom';
import GlassButton from './ui/GlassButton';
import Logo from './ui/Logo';
import LanguageSwitch from './ui/LanguageSwitch';
import { useI18n } from '../i18n/I18nProvider';

const SplashScreen = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="screen-safe relative h-full w-full flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video
          className="w-full h-full object-cover opacity-70"
          src="/videos/city-night.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="fixed top-3 right-3 z-50">
        <LanguageSwitch />
      </div>

      <div className="relative z-10 container-narrow w-full px-[var(--page-x)] py-[clamp(1rem,4vh,2.5rem)] md:py-8 flex flex-col items-center gap-[clamp(1rem,2.5vh,1.75rem)]">
        <Logo size={56} showText className="justify-center" />

        <div className="text-center space-y-3">
          <h1 className="fluid-title font-bold tracking-tight">
            {t('splash.titleLine1')}<br />
            <span className="text-transparent bg-clip-text gradient-premium">{t('splash.titleLine2')}</span>
          </h1>
          <p className="text-secondary fluid-subtitle">
            {t('splash.subtitle')}
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <GlassButton variant="premium" onClick={() => navigate('/onboarding')} className="w-full h-[var(--cta-height)] text-base md:text-lg font-semibold">
            {t('splash.start')}
          </GlassButton>
          <GlassButton onClick={() => navigate('/login')} className="w-full h-[var(--cta-height)] text-base md:text-lg">
            {t('splash.signIn')}
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
