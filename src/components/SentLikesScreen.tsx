import React, { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Sparkles, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { appApi } from '../services';
import type { SentLike } from '../contracts';
import { buildResponsiveImageAttrs } from '../utils/imageDelivery';
import { useI18n } from '../i18n/I18nProvider';

const SentLikesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [likes, setLikes] = useState<SentLike[]>([]);
  const [superlikeSentIds, setSuperlikeSentIds] = useState<Set<string>>(new Set());
  const [superlikesLeft, setSuperlikesLeft] = useState<number | null>(null);
  const [composerTarget, setComposerTarget] = useState<SentLike | null>(null);
  const [composerText, setComposerText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async (withLoader = false) => {
    if (withLoader) setIsLoading(true);
    setHasError(false);
    try {
      const [outgoing, settings] = await Promise.all([
        appApi.getSentLikes(),
        appApi.getSettings().catch(() => null),
      ]);
      setLikes(outgoing.likes);
      setSuperlikeSentIds(
        new Set(outgoing.likes.filter((entry) => entry.wasSuperLike).map((entry) => entry.profile.id)),
      );
      if (settings) {
        setSuperlikesLeft(settings.balances.superlikesLeft);
      }
    } catch {
      setHasError(true);
    } finally {
      if (withLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(false);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const pendingCount = useMemo(
    () => likes.filter((entry) => entry.status === 'pending').length,
    [likes],
  );

  const sendSuperLike = async () => {
    if (!composerTarget || isSending) return;
    const text = composerText.trim();
    if (!text) {
      setFeedback(t('discover.superLikeComposerMessageRequired'));
      return;
    }
    setIsSending(true);
    try {
      const response = await appApi.sendSuperLikeDirectMessage({
        profileId: composerTarget.profile.id,
        text,
        feedCursor: `likes-outgoing-${Date.now()}`,
      });
      setSuperlikesLeft(response.superlikesLeft);
      setFeedback(response.confirmation);
      if (response.status === 'sent') {
        setSuperlikeSentIds((prev) => new Set(prev).add(composerTarget.profile.id));
      }
      setComposerTarget(null);
      setComposerText('');
    } catch {
      setFeedback(t('discover.superLikeComposerError'));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <section className="glass-panel rounded-[var(--card-radius)] p-7 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/20 border-t-white/75 animate-spin" />
        <p className="mt-4 text-lg font-black text-white">{t('likes.outgoing.loadingTitle')}</p>
      </section>
    );
  }

  if (hasError) {
    return (
      <section className="glass-panel rounded-[var(--card-radius)] p-8 text-center border border-red-400/35 bg-red-500/5">
        <p className="text-lg font-black text-white">{t('likes.outgoing.errorTitle')}</p>
        <button
          onClick={() => void load(true)}
          className="mt-4 h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
        >
          {t('discover.retry')}
        </button>
      </section>
    );
  }

  if (likes.length === 0) {
    return (
      <section className="glass-panel rounded-[var(--card-radius)] p-8 text-center">
        <Heart size={26} className="mx-auto text-white/40" />
        <p className="mt-4 text-lg font-black text-white">{t('likes.outgoing.emptyTitle')}</p>
        <p className="mt-2 text-sm text-white/55">{t('likes.outgoing.emptySubtitle')}</p>
      </section>
    );
  }

  return (
    <div className="layout-stack">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(150deg,rgba(20,24,33,0.88),rgba(8,9,14,0.92))] backdrop-blur-xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">{t('likes.outgoing.eyebrow')}</p>
            <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">{t('likes.outgoing.title')}</h2>
            <p className="text-xs text-white/55 mt-1">{t('likes.outgoing.subtitle', { count: pendingCount })}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/12 px-3 py-1.5">
            <Sparkles size={12} className="text-cyan-200" />
            <span className="text-[10px] font-black tracking-[0.12em] uppercase text-cyan-100">
              {t('likes.outgoing.superlikesLeft', { count: superlikesLeft ?? 0 })}
            </span>
          </div>
        </div>
      </section>

      {feedback ? <p className="text-xs text-cyan-200 font-bold">{feedback}</p> : null}

      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,21,31,0.84),rgba(8,9,14,0.9))] p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[var(--grid-gap)]">
        {likes.map((entry) => {
          const alreadySent = superlikeSentIds.has(entry.profile.id);
          const showSend = entry.status === 'pending' && !alreadySent;
          const img = buildResponsiveImageAttrs(entry.profile.photos[0] ?? '/placeholder.svg', 'card', '(max-width: 768px) 100vw, 380px');
          return (
            <article
              key={entry.id}
              className="relative overflow-hidden rounded-[var(--card-radius)] glass-panel glass-panel-float aspect-[3/4] border border-white/12"
            >
              <img
                src={img.src}
                srcSet={img.srcSet}
                sizes={img.sizes}
                alt={entry.profile.name}
                className="absolute inset-0 w-full h-full object-cover object-center scale-105"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-panel-soft text-[9px] font-black uppercase tracking-[0.14em] border border-white/20 bg-white/8 text-white/80">
                <span>{entry.status}</span>
              </div>
              {alreadySent ? (
                <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cyan-300/35 bg-cyan-500/15 text-cyan-100 text-[9px] font-black uppercase tracking-[0.14em]">
                  <Star size={10} />
                  <span>{t('discover.superLikeSent')}</span>
                </div>
              ) : null}
              <div className="absolute left-3 right-3 bottom-4 space-y-2">
                <p className="text-base font-black text-white">
                  {entry.profile.flags.hideAge ? entry.profile.name : `${entry.profile.name}, ${entry.profile.age}`}
                </p>
                <p className="text-xs text-white/65">{entry.profile.city}</p>
                <div className="grid grid-cols-2 gap-2">
                  {showSend ? (
                    <button
                      onClick={() => {
                        setComposerTarget(entry);
                        setComposerText('');
                      }}
                      className="h-9 rounded-lg gradient-premium text-white text-[10px] font-black uppercase tracking-[0.12em] inline-flex items-center justify-center gap-1.5"
                    >
                      <Star size={12} />
                      <span>{t('likes.outgoing.sendSuperLike')}</span>
                    </button>
                  ) : (
                    <div className="h-9 rounded-lg border border-white/20 bg-white/5 text-white/70 text-[10px] font-black uppercase tracking-[0.12em] inline-flex items-center justify-center">
                      {alreadySent ? t('discover.superLikeSent') : entry.status}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      void appApi.openChat(entry.profile.id, true).then(() => {
                        navigate(`/chat/${entry.profile.id}`);
                      });
                    }}
                    className="h-9 rounded-lg border border-white/20 bg-black/35 text-white/80 text-[10px] font-black uppercase tracking-[0.12em] inline-flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle size={12} />
                    <span>{t('likes.openChat')}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {composerTarget ? (
        <div className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-white/15 bg-[linear-gradient(160deg,rgba(20,24,33,0.96),rgba(8,9,14,0.96))] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/90">
              {t('discover.superLikeComposerEyebrow')}
            </p>
            <h3 className="mt-2 text-xl font-black text-white">
              {t('discover.superLikeComposerTitle', { name: composerTarget.profile.name })}
            </h3>
            <p className="mt-2 text-sm text-white/70">{t('discover.superLikeComposerSubtitle')}</p>
            <textarea
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-fuchsia-300/50"
              placeholder={t('discover.superLikeComposerPlaceholder')}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setComposerTarget(null);
                  setComposerText('');
                }}
                className="flex-1 h-10 rounded-xl border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.12em] font-black text-white/80"
              >
                {t('discover.superLikeComposerCancel')}
              </button>
              <button
                onClick={() => void sendSuperLike()}
                disabled={isSending}
                className="flex-1 h-10 rounded-xl gradient-premium text-[10px] uppercase tracking-[0.12em] font-black text-white disabled:opacity-60"
              >
                {isSending ? t('discover.superLikeComposerSending') : t('discover.superLikeComposerSend')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SentLikesScreen;

