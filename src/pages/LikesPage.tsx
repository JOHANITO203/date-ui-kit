import React, { useState } from 'react';
import MatchesScreen from '../components/MatchesScreen';
import SentLikesScreen from '../components/SentLikesScreen';
import { useI18n } from '../i18n/I18nProvider';

const LikesPage: React.FC = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'inbound' | 'outbound'>('inbound');

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-[var(--page-x)] pt-4 pb-2">
        <div className="inline-flex rounded-2xl border border-white/15 bg-white/5 p-1 gap-1">
          <button
            onClick={() => setTab('inbound')}
            className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
              tab === 'inbound'
                ? 'bg-white text-black'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('likes.tabs.theyLikedMe')}
          </button>
          <button
            onClick={() => setTab('outbound')}
            className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
              tab === 'outbound'
                ? 'bg-white text-black'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('likes.tabs.iLiked')}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">{tab === 'inbound' ? <MatchesScreen /> : <SentLikesScreen />}</div>
    </div>
  );
};

export default LikesPage;
